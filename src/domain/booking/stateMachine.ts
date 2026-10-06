import type { ReservationStatus } from '@prisma/client';

/**
 * Reservation lifecycle. Transitions not listed here are impossible — the
 * guard is called before every status write, so an illegal move is an error,
 * never a silent data corruption.
 */
const TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  PENDING: [
    'CONFIRMED',
    'CANCELLED_BY_CUSTOMER',
    'CANCELLED_BY_BUSINESS',
    'RESCHEDULED',
    'EXPIRED',
  ],
  CONFIRMED: [
    'COMPLETED',
    'CANCELLED_BY_CUSTOMER',
    'CANCELLED_BY_BUSINESS',
    'RESCHEDULED',
    'NO_SHOW',
  ],
  COMPLETED: [],
  CANCELLED_BY_CUSTOMER: [],
  CANCELLED_BY_BUSINESS: [],
  RESCHEDULED: [],
  NO_SHOW: [],
  EXPIRED: [],
};

/** Statuses that occupy a slot — these are what the exclusion constraint covers. */
export const ACTIVE_STATUSES: readonly ReservationStatus[] = ['PENDING', 'CONFIRMED'];

/** Statuses that can never change again. */
export const TERMINAL_STATUSES: readonly ReservationStatus[] = [
  'COMPLETED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_BUSINESS',
  'RESCHEDULED',
  'NO_SHOW',
  'EXPIRED',
];

export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isActive(status: ReservationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isTerminal(status: ReservationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function allowedNext(from: ReservationStatus): readonly ReservationStatus[] {
  return TRANSITIONS[from];
}
