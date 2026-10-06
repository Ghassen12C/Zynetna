/**
 * Timezone-correct conversion between a wall-clock day in a business's
 * timezone and absolute instants.
 *
 * Recurring rules (opening hours) are wall-clock: "Monday 09:00" means 09:00
 * local, whatever the UTC offset is that week. Reservations are instants.
 * Everything below converts between the two explicitly, which is why the
 * availability engine does not drift across a DST boundary.
 */

export const MINUTES_PER_DAY = 1440;

/** A calendar day in a given timezone, e.g. '2026-11-02'. */
export type DayKey = string;

export function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const offsetCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = offsetCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    offsetCache.set(timeZone, f);
  }
  return f;
}

function partsIn(timeZone: string, instant: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  // Intl renders midnight as hour 24 in some ICU versions.
  if (out.hour === 24) out.hour = 0;
  return out;
}

/** Offset of `timeZone` from UTC, in minutes, at a given instant. */
export function offsetMinutes(timeZone: string, instant: Date): number {
  const p = partsIn(timeZone, instant);
  const asUtc = Date.UTC(
    p.year!,
    p.month! - 1,
    p.day!,
    p.hour!,
    p.minute!,
    p.second!,
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** The calendar day an instant falls on, in the given timezone. */
export function dayKeyOf(timeZone: string, instant: Date): DayKey {
  const p = partsIn(timeZone, instant);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * The absolute instant of `minutes` past local midnight on `day`.
 *
 * Resolved in two passes: a first guess using the offset at the UTC-midnight
 * of that day, then a correction using the offset actually in force at the
 * guessed instant. That second pass is what makes DST transitions correct.
 */
export function instantAt(timeZone: string, day: DayKey, minutes: number): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0) + minutes * 60000;
  const guess = new Date(naive - offsetMinutes(timeZone, new Date(naive)) * 60000);
  const corrected = new Date(naive - offsetMinutes(timeZone, guess) * 60000);
  return corrected;
}

/** 0 = Sunday … 6 = Saturday, for a calendar day. */
export function weekdayOf(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Calendar day `n` days after `day`. */
export function addDays(day: DayKey, n: number): DayKey {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Whole days between two calendar days (b − a). */
export function daysBetween(a: DayKey, b: DayKey): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000,
  );
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}", expected HH:MM`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || h * 60 + min > MINUTES_PER_DAY) {
    throw new Error(`Time "${value}" is out of range`);
  }
  return h * 60 + min;
}
