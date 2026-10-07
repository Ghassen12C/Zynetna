import { db } from '@/lib/db';
import { notFound } from '@/lib/errors';
import {
  type DayAvailability,
  type ScheduleExceptionInput,
  type StaffInput,
  computeDayAvailability,
  computeRangeAvailability,
} from '@/domain/scheduling/availability';
import { type DayKey, addDays, dayKeyOf, instantAt } from '@/domain/scheduling/time';

/**
 * Loads the schedule snapshot and hands it to the pure availability engine.
 * This is the only module that knows both Prisma and the engine.
 */

export type AvailabilityQuery = {
  businessId: string;
  serviceId: string;
  /** Narrow to one professional; omit to search across all who perform it. */
  staffMemberId?: string | null;
  from: DayKey;
  days: number;
  now?: Date;
  /** Walk-in / phone bookings taken at the counter skip minimum notice. */
  ignoreMinNotice?: boolean;
};

async function loadSnapshot(q: AvailabilityQuery) {
  const business = await db.business.findUnique({
    where: { id: q.businessId },
    select: {
      id: true,
      status: true,
      timezone: true,
      slotGranularityMinutes: true,
      minNoticeMinutes: true,
      maxAdvanceDays: true,
      hours: { select: { weekday: true, startMin: true, endMin: true } },
      subscription: { select: { status: true } },
    },
  });
  if (!business) throw notFound('businessNotFound');

  const service = await db.service.findFirst({
    where: { id: q.serviceId, businessId: q.businessId, isActive: true },
    select: {
      id: true,
      durationMinutes: true,
      bufferMinutes: true,
      prepMinutes: true,
      minNoticeMinutes: true,
    },
  });
  if (!service) throw notFound('serviceNotFound');

  // Only professionals who actually perform this service — the booking engine
  // must honour the professional↔service relationship.
  const staffRows = await db.staffMember.findMany({
    where: {
      businessId: q.businessId,
      isActive: true,
      isBookable: true,
      ...(q.staffMemberId ? { id: q.staffMemberId } : {}),
      services: { some: { serviceId: q.serviceId } },
    },
    select: {
      id: true,
      displayName: true,
      isBookable: true,
      hours: { select: { weekday: true, startMin: true, endMin: true } },
    },
  });

  const staff: StaffInput[] = staffRows.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    isBookable: s.isBookable,
    hours: s.hours,
  }));

  const until = addDays(q.from, q.days);
  const exceptionRows = await db.scheduleException.findMany({
    where: {
      businessId: q.businessId,
      OR: [
        { endDate: null, date: { gte: new Date(`${q.from}T00:00:00Z`), lt: new Date(`${until}T00:00:00Z`) } },
        { endDate: { gte: new Date(`${q.from}T00:00:00Z`) }, date: { lt: new Date(`${until}T00:00:00Z`) } },
      ],
    },
    select: {
      kind: true,
      date: true,
      endDate: true,
      startMin: true,
      endMin: true,
      staffMemberId: true,
    },
  });

  const toKey = (d: Date): DayKey => d.toISOString().slice(0, 10);
  const exceptions: ScheduleExceptionInput[] = exceptionRows.map((e) => ({
    kind: e.kind,
    date: toKey(e.date),
    endDate: e.endDate ? toKey(e.endDate) : null,
    startMin: e.startMin,
    endMin: e.endMin,
    staffMemberId: e.staffMemberId,
  }));

  // Existing reservations across the whole requested range, in one query.
  const rangeStart = instantAt(business.timezone, q.from, 0);
  const rangeEnd = instantAt(business.timezone, until, 0);
  const busy = await db.reservation.findMany({
    where: {
      businessId: q.businessId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      startAt: { lt: rangeEnd },
      endAt: { gt: rangeStart },
      ...(staff.length > 0 ? { staffMemberId: { in: staff.map((s) => s.id) } } : {}),
    },
    select: { staffMemberId: true, startAt: true, endAt: true },
  });

  return { business, service, staff, exceptions, busy };
}

/** Availability for a single day. */
export async function getDayAvailability(
  q: Omit<AvailabilityQuery, 'days' | 'from'> & { day: DayKey },
): Promise<DayAvailability> {
  const snapshot = await loadSnapshot({ ...q, from: q.day, days: 1 });
  return computeDayAvailability({
    day: q.day,
    business: {
      timezone: snapshot.business.timezone,
      hours: snapshot.business.hours,
      slotGranularityMinutes: snapshot.business.slotGranularityMinutes,
      minNoticeMinutes: snapshot.business.minNoticeMinutes,
      maxAdvanceDays: snapshot.business.maxAdvanceDays,
    },
    service: snapshot.service,
    staff: snapshot.staff,
    exceptions: snapshot.exceptions,
    busy: snapshot.busy,
    now: q.now ?? new Date(),
    ignoreMinNotice: q.ignoreMinNotice ?? false,
  });
}

/** Availability across a range — powers the date strip in the booking flow. */
export async function getRangeAvailability(
  q: AvailabilityQuery,
): Promise<DayAvailability[]> {
  const snapshot = await loadSnapshot(q);
  return computeRangeAvailability({
    from: q.from,
    days: q.days,
    business: {
      timezone: snapshot.business.timezone,
      hours: snapshot.business.hours,
      slotGranularityMinutes: snapshot.business.slotGranularityMinutes,
      minNoticeMinutes: snapshot.business.minNoticeMinutes,
      maxAdvanceDays: snapshot.business.maxAdvanceDays,
    },
    service: snapshot.service,
    staff: snapshot.staff,
    exceptions: snapshot.exceptions,
    busy: snapshot.busy,
    now: q.now ?? new Date(),
  });
}

/** The next day with at least one free slot — used for "next available". */
export async function findNextAvailableDay(
  businessId: string,
  serviceId: string,
  horizonDays = 30,
): Promise<DayAvailability | null> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { timezone: true },
  });
  if (!business) return null;
  const from = dayKeyOf(business.timezone, new Date());
  const days = await getRangeAvailability({
    businessId,
    serviceId,
    from,
    days: horizonDays,
  });
  return days.find((d) => d.isOpen && d.slots.length > 0) ?? null;
}
