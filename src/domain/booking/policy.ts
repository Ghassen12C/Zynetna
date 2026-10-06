import type { ReservationStatus } from '@prisma/client';
import { isActive } from './stateMachine';

/**
 * Booking policy — the rules a business configures and the customer sees
 * before confirming. Evaluated server-side; the UI only mirrors the outcome.
 *
 * A denial carries a code and its parameters, never a sentence. The domain
 * layer has no locale, and a refusal is read by the customer: baking English
 * prose in here is how an Arabic page ends up explaining itself in English.
 * Rendering happens at the edge, through `policyMessage()`.
 */

export type BookingPolicy = {
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
  allowCustomerCancel: boolean;
  allowCustomerReschedule: boolean;
};

export type PolicyDenial =
  | { code: 'CANCEL_CLOSED' }
  | { code: 'CANCEL_BY_BUSINESS' }
  | { code: 'CHANGE_CLOSED' }
  | { code: 'CHANGE_BY_BUSINESS' }
  | { code: 'ALREADY_STARTED' }
  | { code: 'CANCEL_WINDOW_PASSED'; hours: number }
  | { code: 'CHANGE_WINDOW_PASSED'; hours: number }
  | { code: 'IN_THE_PAST' }
  | { code: 'NOTICE_REQUIRED'; hours: number }
  | { code: 'TOO_FAR_AHEAD'; days: number }
  | { code: 'REVIEW_NOT_YOURS' }
  | { code: 'REVIEW_NOT_COMPLETED' };

export type PolicyCheck = { allowed: true } | { allowed: false; reason: PolicyDenial };

const ok: PolicyCheck = { allowed: true };
const deny = (reason: PolicyDenial): PolicyCheck => ({ allowed: false, reason });

/** May a customer still cancel this reservation themselves? */
export function canCustomerCancel(
  reservation: { status: ReservationStatus; startAt: Date },
  policy: BookingPolicy,
  now: Date,
): PolicyCheck {
  if (!isActive(reservation.status)) return deny({ code: 'CANCEL_CLOSED' });
  if (!policy.allowCustomerCancel) return deny({ code: 'CANCEL_BY_BUSINESS' });

  const hoursUntil = (reservation.startAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntil < 0) return deny({ code: 'ALREADY_STARTED' });
  if (hoursUntil < policy.cancellationWindowHours) {
    return deny({ code: 'CANCEL_WINDOW_PASSED', hours: policy.cancellationWindowHours });
  }
  return ok;
}

/** May a customer move this reservation themselves? */
export function canCustomerReschedule(
  reservation: { status: ReservationStatus; startAt: Date },
  policy: BookingPolicy,
  now: Date,
): PolicyCheck {
  if (!isActive(reservation.status)) return deny({ code: 'CHANGE_CLOSED' });
  if (!policy.allowCustomerReschedule) return deny({ code: 'CHANGE_BY_BUSINESS' });

  const hoursUntil = (reservation.startAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntil < 0) return deny({ code: 'ALREADY_STARTED' });
  if (hoursUntil < policy.cancellationWindowHours) {
    return deny({ code: 'CHANGE_WINDOW_PASSED', hours: policy.cancellationWindowHours });
  }
  return ok;
}

/** Is a requested start instant inside the business's booking window? */
export function isWithinBookingWindow(
  startAt: Date,
  policy: BookingPolicy,
  now: Date,
): PolicyCheck {
  const minutesAhead = (startAt.getTime() - now.getTime()) / 60000;
  if (minutesAhead < 0) return deny({ code: 'IN_THE_PAST' });
  if (minutesAhead < policy.minNoticeMinutes) {
    return deny({
      code: 'NOTICE_REQUIRED',
      hours: Math.round((policy.minNoticeMinutes / 60) * 10) / 10,
    });
  }
  if (minutesAhead / 1440 > policy.maxAdvanceDays) {
    return deny({ code: 'TOO_FAR_AHEAD', days: policy.maxAdvanceDays });
  }
  return ok;
}

/** A review is only possible on a completed appointment. */
export function canReview(
  reservation: { status: ReservationStatus; customerId: string | null },
  actorId: string,
): PolicyCheck {
  if (reservation.customerId !== actorId) return deny({ code: 'REVIEW_NOT_YOURS' });
  if (reservation.status !== 'COMPLETED') return deny({ code: 'REVIEW_NOT_COMPLETED' });
  return ok;
}
