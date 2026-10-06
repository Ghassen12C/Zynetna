import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayKeyOf,
  daysBetween,
  hhmmToMinutes,
  instantAt,
  minutesToHHMM,
  offsetMinutes,
  weekdayOf,
} from '@/domain/scheduling/time';

const TUNIS = 'Africa/Tunis';

describe('timezone-aware scheduling time', () => {
  it('resolves local wall-clock to the right instant in Tunisia (UTC+1)', () => {
    // Tunisia is UTC+1 year-round — 09:00 local is 08:00Z.
    expect(instantAt(TUNIS, '2026-11-02', 540).toISOString()).toBe(
      '2026-11-02T08:00:00.000Z',
    );
  });

  it('stays correct across a European DST boundary', () => {
    // Paris: 09:00 local is 07:00Z in summer, 08:00Z in winter.
    expect(instantAt('Europe/Paris', '2026-07-15', 540).toISOString()).toBe(
      '2026-07-15T07:00:00.000Z',
    );
    expect(instantAt('Europe/Paris', '2026-12-15', 540).toISOString()).toBe(
      '2026-12-15T08:00:00.000Z',
    );
  });

  it('round-trips an instant back to its local day', () => {
    // 23:30Z on the 1st is already the 2nd in Tunis.
    expect(dayKeyOf(TUNIS, new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
    expect(dayKeyOf(TUNIS, new Date('2026-11-02T22:59:00Z'))).toBe('2026-11-02');
  });

  it('reports the offset', () => {
    expect(offsetMinutes(TUNIS, new Date('2026-07-01T12:00:00Z'))).toBe(60);
    expect(offsetMinutes('UTC', new Date('2026-07-01T12:00:00Z'))).toBe(0);
  });

  it('computes weekdays, day arithmetic and differences', () => {
    expect(weekdayOf('2026-11-02')).toBe(1); // Monday
    expect(weekdayOf('2026-11-08')).toBe(0); // Sunday
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-02', '2026-11-09')).toBe(7);
    expect(daysBetween('2026-11-09', '2026-11-02')).toBe(-7);
  });

  it('converts between minutes and HH:MM', () => {
    expect(minutesToHHMM(540)).toBe('09:00');
    expect(minutesToHHMM(1140)).toBe('19:00');
    expect(hhmmToMinutes('09:30')).toBe(570);
    expect(() => hhmmToMinutes('25:00')).toThrow();
    expect(() => hhmmToMinutes('9h30')).toThrow();
  });
});
