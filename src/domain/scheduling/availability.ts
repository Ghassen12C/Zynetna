import {
  type Interval,
  intersect,
  normalise,
  subtract,
} from './intervals';
import {
  type DayKey,
  addDays,
  dayKeyOf,
  daysBetween,
  instantAt,
  weekdayOf,
} from './time';

/**
 * The availability engine.
 *
 * Pure: it takes a snapshot of schedule data and returns slots. It performs no
 * I/O, knows nothing about Prisma or HTTP, and is therefore exhaustively unit
 * tested. The API layer loads the snapshot and calls `computeDayAvailability`.
 *
 * The frontend never computes availability — it renders what this returns.
 */

export type WorkingPeriod = { weekday: number; startMin: number; endMin: number };

export type ExceptionKind =
  | 'CLOSED'
  | 'HOLIDAY'
  | 'VACATION'
  | 'BREAK'
  | 'SPECIAL_HOURS';

export type ScheduleExceptionInput = {
  kind: ExceptionKind;
  /** Inclusive first day. */
  date: DayKey;
  /** Inclusive last day; defaults to `date`. */
  endDate?: DayKey | null;
  startMin?: number | null;
  endMin?: number | null;
  /** null → applies to the whole business. */
  staffMemberId?: string | null;
};

export type BusyInterval = { staffMemberId: string; startAt: Date; endAt: Date };

export type StaffInput = {
  id: string;
  displayName: string;
  /** Empty → the professional inherits business hours. */
  hours: WorkingPeriod[];
  isBookable: boolean;
};

export type ServiceInput = {
  id: string;
  durationMinutes: number;
  bufferMinutes: number;
  prepMinutes: number;
  minNoticeMinutes?: number | null;
};

export type BusinessScheduleInput = {
  timezone: string;
  hours: WorkingPeriod[];
  slotGranularityMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
};

export type AvailabilityRequest = {
  day: DayKey;
  business: BusinessScheduleInput;
  service: ServiceInput;
  /** Already filtered to professionals who perform this service. */
  staff: StaffInput[];
  exceptions: ScheduleExceptionInput[];
  busy: BusyInterval[];
  /** Injected so tests are deterministic. */
  now: Date;
};

export type Slot = {
  /** Local wall-clock start, 'HH:MM'. */
  time: string;
  startMin: number;
  startAt: Date;
  endAt: Date;
  /** Every professional free for this slot, so the UI can offer a choice. */
  staffMemberIds: string[];
};

export type DayAvailability = {
  day: DayKey;
  /** False when the day is outside the booking window or fully closed. */
  isOpen: boolean;
  closedReason?: 'PAST' | 'TOO_SOON' | 'TOO_FAR' | 'CLOSED' | 'NO_STAFF';
  slots: Slot[];
};

function appliesOn(exception: ScheduleExceptionInput, day: DayKey): boolean {
  const last = exception.endDate ?? exception.date;
  return day >= exception.date && day <= last;
}

/** Working periods for one weekday, as minute intervals. */
function periodsFor(periods: WorkingPeriod[], weekday: number): Interval[] {
  return normalise(
    periods
      .filter((p) => p.weekday === weekday)
      .map((p) => ({ start: p.startMin, end: p.endMin })),
  );
}

/**
 * Resolve one professional's bookable windows for a day:
 * their own hours if defined, otherwise the business's; minus closures,
 * holidays, vacations and breaks; replaced by special hours when present.
 */
function windowsForStaff(
  staff: StaffInput,
  day: DayKey,
  business: BusinessScheduleInput,
  exceptions: ScheduleExceptionInput[],
): Interval[] {
  const weekday = weekdayOf(day);
  const todays = exceptions.filter((e) => appliesOn(e, day));

  const scoped = (e: ScheduleExceptionInput) =>
    e.staffMemberId == null || e.staffMemberId === staff.id;

  // A full-day closure beats everything else.
  const fullClosure = todays.some(
    (e) =>
      scoped(e) &&
      (e.kind === 'CLOSED' || e.kind === 'HOLIDAY' || e.kind === 'VACATION') &&
      e.startMin == null,
  );
  if (fullClosure) return [];

  // Special hours replace the regular schedule for that day.
  const special = todays.filter(
    (e) => scoped(e) && e.kind === 'SPECIAL_HOURS' && e.startMin != null && e.endMin != null,
  );

  let base: Interval[];
  if (special.length > 0) {
    base = normalise(special.map((e) => ({ start: e.startMin!, end: e.endMin! })));
    // A professional with their own hours is still bound by them.
    const own = periodsFor(staff.hours, weekday);
    if (own.length > 0) base = intersect(base, own);
  } else {
    const own = periodsFor(staff.hours, weekday);
    base = own.length > 0 ? own : periodsFor(business.hours, weekday);
    // A professional never works outside the business's own opening hours.
    if (own.length > 0) {
      const businessWindows = periodsFor(business.hours, weekday);
      if (businessWindows.length > 0) base = intersect(base, businessWindows);
    }
  }

  // Breaks and partial closures carve out of whatever remains.
  const cuts = todays
    .filter(
      (e) =>
        scoped(e) &&
        e.kind !== 'SPECIAL_HOURS' &&
        e.startMin != null &&
        e.endMin != null,
    )
    .map((e) => ({ start: e.startMin!, end: e.endMin! }));

  return subtract(base, cuts);
}

/**
 * Compute bookable slots for one day.
 *
 * A slot is offered only when `prep + duration + buffer` fits entirely inside
 * a single working window with no overlap against existing reservations. The
 * customer-visible appointment is `duration` long; prep and buffer are the
 * business's own padding and are never shown as busy time to the customer.
 */
export function computeDayAvailability(req: AvailabilityRequest): DayAvailability {
  const { day, business, service, staff, exceptions, busy, now } = req;
  const today = dayKeyOf(business.timezone, now);

  if (daysBetween(today, day) < 0) {
    return { day, isOpen: false, closedReason: 'PAST', slots: [] };
  }
  if (daysBetween(today, day) > business.maxAdvanceDays) {
    return { day, isOpen: false, closedReason: 'TOO_FAR', slots: [] };
  }

  const bookable = staff.filter((s) => s.isBookable);
  if (bookable.length === 0) {
    return { day, isOpen: false, closedReason: 'NO_STAFF', slots: [] };
  }

  const granularity = Math.max(5, business.slotGranularityMinutes);
  const minNotice = service.minNoticeMinutes ?? business.minNoticeMinutes;
  const earliest = new Date(now.getTime() + minNotice * 60000);

  const occupied = Math.max(
    1,
    service.prepMinutes + service.durationMinutes + service.bufferMinutes,
  );

  /** startMin → professionals free to take it. */
  const byStart = new Map<number, string[]>();
  let anyWindow = false;

  for (const member of bookable) {
    const windows = windowsForStaff(member, day, business, exceptions);
    if (windows.length > 0) anyWindow = true;

    const theirBusy = busy
      .filter((b) => b.staffMemberId === member.id)
      .map((b) => ({ startAt: b.startAt, endAt: b.endAt }));

    for (const window of windows) {
      // Align the first candidate to the grid relative to the window start,
      // so a window starting at 09:10 offers 09:10, not 09:15.
      for (let start = window.start; start + occupied <= window.end; start += granularity) {
        const serviceStart = start + service.prepMinutes;
        const startAt = instantAt(business.timezone, day, serviceStart);
        const endAt = instantAt(
          business.timezone,
          day,
          serviceStart + service.durationMinutes,
        );

        if (startAt.getTime() < earliest.getTime()) continue;

        // Block against the full occupied range, padding included.
        const blockStart = instantAt(business.timezone, day, start);
        const blockEnd = instantAt(business.timezone, day, start + occupied);
        const clashes = theirBusy.some(
          (b) => blockStart < b.endAt && b.startAt < blockEnd,
        );
        if (clashes) continue;

        const list = byStart.get(serviceStart);
        if (list) list.push(member.id);
        else byStart.set(serviceStart, [member.id]);
      }
    }
  }

  if (!anyWindow) {
    return { day, isOpen: false, closedReason: 'CLOSED', slots: [] };
  }

  const slots: Slot[] = [...byStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([startMin, staffMemberIds]) => ({
      time: `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(
        startMin % 60,
      ).padStart(2, '0')}`,
      startMin,
      startAt: instantAt(business.timezone, day, startMin),
      endAt: instantAt(business.timezone, day, startMin + service.durationMinutes),
      staffMemberIds,
    }));

  return {
    day,
    isOpen: slots.length > 0,
    closedReason: slots.length === 0 ? 'TOO_SOON' : undefined,
    slots,
  };
}

/** Availability across a range of days, for the booking calendar strip. */
export function computeRangeAvailability(
  req: Omit<AvailabilityRequest, 'day'> & { from: DayKey; days: number },
): DayAvailability[] {
  const out: DayAvailability[] = [];
  for (let i = 0; i < req.days; i += 1) {
    out.push(computeDayAvailability({ ...req, day: addDays(req.from, i) }));
  }
  return out;
}
