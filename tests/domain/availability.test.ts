import { describe, expect, it } from 'vitest';
import {
  type AvailabilityRequest,
  type StaffInput,
  computeDayAvailability,
  computeRangeAvailability,
} from '@/domain/scheduling/availability';
import { instantAt } from '@/domain/scheduling/time';

const TZ = 'Africa/Tunis';
const MONDAY = '2026-11-02';

/** Reference scenario from the specification: 09:00–13:00, 30-minute service. */
function scenario(over: Partial<AvailabilityRequest> = {}): AvailabilityRequest {
  const staff: StaffInput = {
    id: 'sarah',
    displayName: 'Sarah',
    hours: [],
    isBookable: true,
  };
  return {
    day: MONDAY,
    business: {
      timezone: TZ,
      hours: [{ weekday: 1, startMin: 540, endMin: 780 }], // Mon 09:00–13:00
      slotGranularityMinutes: 30,
      minNoticeMinutes: 0,
      maxAdvanceDays: 60,
    },
    service: {
      id: 'haircut',
      durationMinutes: 30,
      bufferMinutes: 0,
      prepMinutes: 0,
      minNoticeMinutes: null,
    },
    staff: [staff],
    exceptions: [],
    busy: [],
    now: new Date('2026-11-01T08:00:00Z'),
    ...over,
  };
}

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return instantAt(TZ, MONDAY, h * 60 + m);
};

describe('availability engine — specification scenario', () => {
  it('generates 09:00…12:30 for a 30-minute service in a 09:00–13:00 window', () => {
    const result = computeDayAvailability(scenario());
    expect(result.isOpen).toBe(true);
    expect(result.slots.map((s) => s.time)).toEqual([
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    ]);
  });

  it('removes exactly the booked slot — the spec example', () => {
    // Existing reservation 10:00–10:30 ⇒ 09:00, 09:30, 10:30, 11:00 …
    const result = computeDayAvailability(
      scenario({
        busy: [{ staffMemberId: 'sarah', startAt: at('10:00'), endAt: at('10:30') }],
      }),
    );
    expect(result.slots.map((s) => s.time)).toEqual([
      '09:00', '09:30', '10:30', '11:00', '11:30', '12:00', '12:30',
    ]);
  });

  it('never offers a slot that would run past closing time', () => {
    const result = computeDayAvailability(
      scenario({ service: { id: 'long', durationMinutes: 90, bufferMinutes: 0, prepMinutes: 0 } }),
    );
    // Last 90-minute start inside 09:00–13:00 is 11:30.
    expect(result.slots.at(-1)?.time).toBe('11:30');
  });
});

describe('availability engine — multiple working periods', () => {
  it('honours a lunch split of 09:00–13:00 and 14:00–19:00', () => {
    const result = computeDayAvailability(
      scenario({
        business: {
          timezone: TZ,
          hours: [
            { weekday: 1, startMin: 540, endMin: 780 },
            { weekday: 1, startMin: 840, endMin: 1140 },
          ],
          slotGranularityMinutes: 60,
          minNoticeMinutes: 0,
          maxAdvanceDays: 60,
        },
      }),
    );
    expect(result.slots.map((s) => s.time)).toEqual([
      '09:00', '10:00', '11:00', '12:00',
      '14:00', '15:00', '16:00', '17:00', '18:00',
    ]);
    // 13:00 is lunch — it must not appear.
    expect(result.slots.map((s) => s.time)).not.toContain('13:00');
  });
});

describe('availability engine — buffers and preparation', () => {
  it('reserves buffer time after the appointment without showing it to the customer', () => {
    const result = computeDayAvailability(
      scenario({
        service: { id: 'colour', durationMinutes: 30, bufferMinutes: 15, prepMinutes: 0 },
        business: {
          timezone: TZ,
          hours: [{ weekday: 1, startMin: 540, endMin: 660 }], // 09:00–11:00
          slotGranularityMinutes: 45,
          minNoticeMinutes: 0,
          maxAdvanceDays: 60,
        },
      }),
    );
    // Occupied block is 30 + 15 = 45 min on a 45-minute grid: 09:00 (ends
    // 09:45) and 09:45 (ends 10:30) fit; 10:30 would end at 11:15, past close.
    expect(result.slots.map((s) => s.time)).toEqual(['09:00', '09:45']);
    // Customer-visible appointment is still 30 minutes.
    expect(result.slots[0]!.endAt.getTime() - result.slots[0]!.startAt.getTime()).toBe(
      30 * 60000,
    );
  });

  it('shifts the customer start by preparation time', () => {
    const result = computeDayAvailability(
      scenario({
        service: { id: 'spa', durationMinutes: 60, bufferMinutes: 0, prepMinutes: 10 },
        business: {
          timezone: TZ,
          hours: [{ weekday: 1, startMin: 540, endMin: 660 }],
          slotGranularityMinutes: 30,
          minNoticeMinutes: 0,
          maxAdvanceDays: 60,
        },
      }),
    );
    expect(result.slots[0]!.time).toBe('09:10');
  });
});

describe('availability engine — exceptions', () => {
  it('closes the day for a holiday', () => {
    const result = computeDayAvailability(
      scenario({ exceptions: [{ kind: 'HOLIDAY', date: MONDAY }] }),
    );
    expect(result.isOpen).toBe(false);
    expect(result.closedReason).toBe('CLOSED');
    expect(result.slots).toEqual([]);
  });

  it('closes a multi-day vacation range', () => {
    const result = computeDayAvailability(
      scenario({
        exceptions: [{ kind: 'VACATION', date: '2026-10-30', endDate: '2026-11-05' }],
      }),
    );
    expect(result.isOpen).toBe(false);
  });

  it('carves a break out of the middle of the day', () => {
    const result = computeDayAvailability(
      scenario({
        exceptions: [
          { kind: 'BREAK', date: MONDAY, startMin: 630, endMin: 690 }, // 10:30–11:30
        ],
      }),
    );
    expect(result.slots.map((s) => s.time)).toEqual([
      '09:00', '09:30', '10:00', '11:30', '12:00', '12:30',
    ]);
  });

  it('replaces regular hours with exceptional opening hours', () => {
    const result = computeDayAvailability(
      scenario({
        exceptions: [
          { kind: 'SPECIAL_HOURS', date: MONDAY, startMin: 600, endMin: 720 }, // 10:00–12:00
        ],
      }),
    );
    expect(result.slots.map((s) => s.time)).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });

  it('applies a staff-scoped vacation to that professional only', () => {
    const result = computeDayAvailability(
      scenario({
        staff: [
          { id: 'sarah', displayName: 'Sarah', hours: [], isBookable: true },
          { id: 'amel', displayName: 'Amel', hours: [], isBookable: true },
        ],
        exceptions: [{ kind: 'VACATION', date: MONDAY, staffMemberId: 'sarah' }],
      }),
    );
    expect(result.isOpen).toBe(true);
    for (const slot of result.slots) {
      expect(slot.staffMemberIds).toEqual(['amel']);
    }
  });
});

describe('availability engine — professional schedules', () => {
  it('uses the professional’s own hours when defined', () => {
    const result = computeDayAvailability(
      scenario({
        staff: [
          {
            id: 'sarah',
            displayName: 'Sarah',
            hours: [{ weekday: 1, startMin: 600, endMin: 720 }], // 10:00–12:00
            isBookable: true,
          },
        ],
      }),
    );
    expect(result.slots.map((s) => s.time)).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });

  it('never lets a professional work outside the business’s opening hours', () => {
    const result = computeDayAvailability(
      scenario({
        staff: [
          {
            id: 'sarah',
            displayName: 'Sarah',
            hours: [{ weekday: 1, startMin: 420, endMin: 1260 }], // 07:00–21:00
            isBookable: true,
          },
        ],
      }),
    );
    // Business closes at 13:00, so the last 30-minute start is 12:30.
    expect(result.slots[0]!.time).toBe('09:00');
    expect(result.slots.at(-1)!.time).toBe('12:30');
  });

  it('merges availability across professionals and lists who is free', () => {
    const result = computeDayAvailability(
      scenario({
        staff: [
          { id: 'sarah', displayName: 'Sarah', hours: [], isBookable: true },
          { id: 'amel', displayName: 'Amel', hours: [], isBookable: true },
        ],
        busy: [{ staffMemberId: 'sarah', startAt: at('10:00'), endAt: at('10:30') }],
      }),
    );
    const ten = result.slots.find((s) => s.time === '10:00')!;
    // Sarah is busy at 10:00 but Amel is not — the slot survives.
    expect(ten.staffMemberIds).toEqual(['amel']);
    expect(result.slots.find((s) => s.time === '09:00')!.staffMemberIds.sort()).toEqual([
      'amel',
      'sarah',
    ]);
  });

  it('excludes non-bookable staff', () => {
    const result = computeDayAvailability(
      scenario({
        staff: [{ id: 'sarah', displayName: 'Sarah', hours: [], isBookable: false }],
      }),
    );
    expect(result.isOpen).toBe(false);
    expect(result.closedReason).toBe('NO_STAFF');
  });
});

describe('availability engine — booking window', () => {
  it('rejects a day in the past', () => {
    const result = computeDayAvailability(
      scenario({ now: new Date('2026-11-05T08:00:00Z') }),
    );
    expect(result.closedReason).toBe('PAST');
  });

  it('rejects a day beyond the advance limit', () => {
    const result = computeDayAvailability(
      scenario({
        business: {
          timezone: TZ,
          hours: [{ weekday: 1, startMin: 540, endMin: 780 }],
          slotGranularityMinutes: 30,
          minNoticeMinutes: 0,
          maxAdvanceDays: 1,
        },
        now: new Date('2026-10-20T08:00:00Z'),
      }),
    );
    expect(result.closedReason).toBe('TOO_FAR');
  });

  it('drops slots inside the minimum-notice window', () => {
    // 09:00 Tunis on the day itself, with 2 h notice ⇒ first slot is 11:00.
    const result = computeDayAvailability(
      scenario({
        business: {
          timezone: TZ,
          hours: [{ weekday: 1, startMin: 540, endMin: 780 }],
          slotGranularityMinutes: 30,
          minNoticeMinutes: 120,
          maxAdvanceDays: 60,
        },
        now: new Date('2026-11-02T08:00:00Z'), // 09:00 local
      }),
    );
    expect(result.slots[0]!.time).toBe('11:00');
  });

  it('lets a service override the business minimum notice', () => {
    const result = computeDayAvailability(
      scenario({
        service: {
          id: 'haircut',
          durationMinutes: 30,
          bufferMinutes: 0,
          prepMinutes: 0,
          minNoticeMinutes: 0,
        },
        business: {
          timezone: TZ,
          hours: [{ weekday: 1, startMin: 540, endMin: 780 }],
          slotGranularityMinutes: 30,
          minNoticeMinutes: 240,
          maxAdvanceDays: 60,
        },
        now: new Date('2026-11-02T08:00:00Z'),
      }),
    );
    expect(result.slots[0]!.time).toBe('09:00');
  });
});

describe('availability engine — range', () => {
  it('returns one entry per day and closes days with no hours', () => {
    const days = computeRangeAvailability({ ...scenario(), from: MONDAY, days: 7 });
    expect(days).toHaveLength(7);
    expect(days[0]!.day).toBe(MONDAY);
    expect(days[0]!.isOpen).toBe(true);
    // Only Monday has opening hours in the fixture.
    expect(days.slice(1).every((d) => !d.isOpen)).toBe(true);
  });
});
