import type { Actor } from './actor';

/**
 * How long a session survives without any activity, by who holds it. The
 * more an account can see, the sooner an unattended screen signs itself out:
 * a platform admin after half an hour, a salon after a working day, a
 * customer after a week. Every session also ends at its absolute expiry
 * (SESSION_TTL_DAYS), active or not.
 */
export type IdleLimits = { adminMinutes: number; proMinutes: number; customerMinutes: number };

export function idleLimitMs(
  actor: Pick<Actor, 'globalRoles' | 'businessRoles'>,
  limits: IdleLimits,
): number {
  const minutes = actor.globalRoles.includes('SUPER_ADMIN')
    ? limits.adminMinutes
    : Object.keys(actor.businessRoles).length > 0
      ? limits.proMinutes
      : limits.customerMinutes;
  return minutes * 60_000;
}

/**
 * `lastSeenAt` is written at most once per TOUCH_INTERVAL_MS, so a session can
 * end up to that much earlier than its limit; never later.
 */
export const TOUCH_INTERVAL_MS = 5 * 60_000;

export function isIdleExpired(lastSeenAt: Date, now: Date, limitMs: number): boolean {
  return now.getTime() - lastSeenAt.getTime() > limitMs;
}
