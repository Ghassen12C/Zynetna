import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STATUSES,
  allowedNext,
  canTransition,
  isActive,
  isTerminal,
} from '@/domain/booking/stateMachine';
import {
  canCustomerCancel,
  canCustomerReschedule,
  canReview,
  isWithinBookingWindow,
} from '@/domain/booking/policy';

const POLICY = {
  minNoticeMinutes: 120,
  maxAdvanceDays: 60,
  cancellationWindowHours: 12,
  allowCustomerCancel: true,
  allowCustomerReschedule: true,
};

const now = new Date('2026-06-15T12:00:00Z');
const hoursFrom = (n: number) => new Date(now.getTime() + n * 3_600_000);

describe('reservation state machine', () => {
  it('allows the legal transitions out of PENDING', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('PENDING', 'CANCELLED_BY_CUSTOMER')).toBe(true);
    expect(canTransition('PENDING', 'EXPIRED')).toBe(true);
    // A pending appointment was never attended, so it cannot be completed.
    expect(canTransition('PENDING', 'COMPLETED')).toBe(false);
    expect(canTransition('PENDING', 'NO_SHOW')).toBe(false);
  });

  it('allows the legal transitions out of CONFIRMED', () => {
    expect(canTransition('CONFIRMED', 'COMPLETED')).toBe(true);
    expect(canTransition('CONFIRMED', 'NO_SHOW')).toBe(true);
    expect(canTransition('CONFIRMED', 'CANCELLED_BY_BUSINESS')).toBe(true);
    // Confirmation is not reversible into pending.
    expect(canTransition('CONFIRMED', 'PENDING')).toBe(false);
    expect(canTransition('CONFIRMED', 'EXPIRED')).toBe(false);
  });

  it('makes every terminal state final', () => {
    for (const status of ['COMPLETED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_BUSINESS', 'RESCHEDULED', 'NO_SHOW', 'EXPIRED'] as const) {
      expect(isTerminal(status)).toBe(true);
      expect(allowedNext(status)).toHaveLength(0);
      expect(canTransition(status, 'CONFIRMED')).toBe(false);
      expect(canTransition(status, 'COMPLETED')).toBe(false);
    }
  });

  it('treats exactly PENDING and CONFIRMED as occupying a slot', () => {
    expect(ACTIVE_STATUSES).toEqual(['PENDING', 'CONFIRMED']);
    expect(isActive('PENDING')).toBe(true);
    expect(isActive('CONFIRMED')).toBe(true);
    expect(isActive('COMPLETED')).toBe(false);
    expect(isActive('CANCELLED_BY_CUSTOMER')).toBe(false);
    expect(isActive('NO_SHOW')).toBe(false);
  });
});

describe('booking policy', () => {
  it('lets a customer cancel outside the cancellation window', () => {
    const check = canCustomerCancel(
      { status: 'CONFIRMED', startAt: hoursFrom(24) },
      POLICY,
      now,
    );
    expect(check.allowed).toBe(true);
  });

  it('refuses a cancellation inside the window, and says why', () => {
    const check = canCustomerCancel(
      { status: 'CONFIRMED', startAt: hoursFrom(6) },
      POLICY,
      now,
    );
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain('12');
  });

  it('refuses when the business handles cancellations itself', () => {
    const check = canCustomerCancel(
      { status: 'CONFIRMED', startAt: hoursFrom(48) },
      { ...POLICY, allowCustomerCancel: false },
      now,
    );
    expect(check.allowed).toBe(false);
  });

  it('refuses to cancel or move an appointment that is already over', () => {
    for (const status of ['COMPLETED', 'CANCELLED_BY_CUSTOMER', 'NO_SHOW'] as const) {
      expect(canCustomerCancel({ status, startAt: hoursFrom(48) }, POLICY, now).allowed).toBe(false);
      expect(canCustomerReschedule({ status, startAt: hoursFrom(48) }, POLICY, now).allowed).toBe(false);
    }
  });

  it('enforces the booking window at both ends', () => {
    expect(isWithinBookingWindow(hoursFrom(-1), POLICY, now).allowed).toBe(false);
    expect(isWithinBookingWindow(hoursFrom(1), POLICY, now).allowed).toBe(false); // under 2 h notice
    expect(isWithinBookingWindow(hoursFrom(3), POLICY, now).allowed).toBe(true);
    expect(isWithinBookingWindow(hoursFrom(24 * 61), POLICY, now).allowed).toBe(false); // past 60 days
  });

  it('only lets the customer review their own completed appointment', () => {
    expect(canReview({ status: 'COMPLETED', customerId: 'u1' }, 'u1').allowed).toBe(true);
    // Someone else's appointment.
    expect(canReview({ status: 'COMPLETED', customerId: 'u2' }, 'u1').allowed).toBe(false);
    // Their own, but not yet attended.
    expect(canReview({ status: 'CONFIRMED', customerId: 'u1' }, 'u1').allowed).toBe(false);
    expect(canReview({ status: 'CANCELLED_BY_CUSTOMER', customerId: 'u1' }, 'u1').allowed).toBe(false);
    expect(canReview({ status: 'NO_SHOW', customerId: 'u1' }, 'u1').allowed).toBe(false);
  });
});
