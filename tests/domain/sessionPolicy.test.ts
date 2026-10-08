import { describe, expect, it } from 'vitest';
import { idleLimitMs, isIdleExpired } from '@/domain/identity/sessionPolicy';

const LIMITS = { adminMinutes: 30, proMinutes: 720, customerMinutes: 10_080 };
const MIN = 60_000;

describe('session idle limits', () => {
  it('is strictest for platform admins, then salons, then customers', () => {
    expect(idleLimitMs({ globalRoles: ['SUPER_ADMIN'], businessRoles: {} }, LIMITS)).toBe(30 * MIN);
    expect(
      idleLimitMs({ globalRoles: ['CUSTOMER'], businessRoles: { b1: ['BUSINESS_OWNER'] } }, LIMITS),
    ).toBe(720 * MIN);
    expect(
      idleLimitMs({ globalRoles: [], businessRoles: { b1: ['BUSINESS_EMPLOYEE'] } }, LIMITS),
    ).toBe(720 * MIN);
    expect(idleLimitMs({ globalRoles: ['CUSTOMER'], businessRoles: {} }, LIMITS)).toBe(10_080 * MIN);
  });

  it('an admin who also owns a salon gets the admin limit', () => {
    expect(
      idleLimitMs({ globalRoles: ['SUPER_ADMIN'], businessRoles: { b1: ['BUSINESS_OWNER'] } }, LIMITS),
    ).toBe(30 * MIN);
  });

  it('expires strictly after the limit', () => {
    const seen = new Date('2026-10-08T10:00:00Z');
    expect(isIdleExpired(seen, new Date('2026-10-08T10:30:00Z'), 30 * MIN)).toBe(false);
    expect(isIdleExpired(seen, new Date('2026-10-08T10:30:01Z'), 30 * MIN)).toBe(true);
  });
});
