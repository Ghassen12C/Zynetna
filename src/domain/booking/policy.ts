import type { ReservationStatus } from '@prisma/client';
import { isActive } from './stateMachine';

/**
 * Booking policy — the rules a business configures and the customer sees
 * before confirming. Evaluated server-side; the UI only mirrors the outcome.
 */

export type BookingPolicy = {
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  cancellationWindowHours: number;
  allowCustomerCancel: boolean;
  allowCustomerReschedule: boolean;
};

export type PolicyCheck = { allowed: true } | { allowed: false; reason: string };

const ok: PolicyCheck = { allowed: true };
const deny = (reason: string): PolicyCheck => ({ allowed: false, reason });

/** May a customer still cancel this reservation themselves? */
export function canCustomerCancel(
  reservation: { status: ReservationStatus; startAt: Date },
  policy: BookingPolicy,
  now: Date,
): PolicyCheck {
  if (!isActive(reservation.status)) {
    return deny('This appointment can no longer be cancelled.');
  }
  if (!policy.allowCustomerCancel) {
    return deny('This business asks you to contact them directly to cancel.');
  }
  const hoursUntil = (reservation.startAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntil < 0) return deny('This appointment has already started.');
  if (hoursUntil < policy.cancellationWindowHours) {
    return deny(
      `Cancellation closes ${policy.cancellationWindowHours} hours before the appointment. Please contact the business.`,
    );
  }
  return ok;
}

/** May a customer move this reservation themselves? */
export function canCustomerReschedule(
  reservation: { status: ReservationStatus; startAt: Date },
  policy: BookingPolicy,
  now: Date,
): PolicyCheck {
  if (!isActive(reservation.status)) {
    return deny('This appointment can no longer be changed.');
  }
  if (!policy.allowCustomerReschedule) {
    return deny('This business asks you to contact them directly to reschedule.');
  }
  const hoursUntil = (reservation.startAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntil < 0) return deny('This appointment has already started.');
  if (hoursUntil < policy.cancellationWindowHours) {
    return deny(
      `Changes close ${policy.cancellationWindowHours} hours before the appointment. Please contact the business.`,
    );
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
  if (minutesAhead < 0) return deny('That time is in the past.');
  if (minutesAhead < policy.minNoticeMinutes) {
    const h = Math.round((policy.minNoticeMinutes / 60) * 10) / 10;
    return deny(`This business needs at least ${h} hours notice.`);
  }
  const daysAhead = minutesAhead / 1440;
  if (daysAhead > policy.maxAdvanceDays) {
    return deny(`Bookings open ${policy.maxAdvanceDays} days ahead at most.`);
  }
  return ok;
}

/** A review is only possible on a completed appointment. */
export function canReview(
  reservation: { status: ReservationStatus; customerId: string | null },
  actorId: string,
): PolicyCheck {
  if (reservation.customerId !== actorId) {
    return deny('You can only review your own appointments.');
  }
  if (reservation.status !== 'COMPLETED') {
    return deny('You can review once your appointment is completed.');
  }
  return ok;
}
