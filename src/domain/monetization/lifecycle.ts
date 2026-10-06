import type { SubscriptionStatus } from '@prisma/client';

/**
 * Subscription lifecycle.
 *
 * The launch offer — first 2 months free, then 30 TND/month — is plan DATA
 * (trialDays: 60, priceAmount: 30), never a constant in this file. Everything
 * here works the same for a future Basic / Premium / Featured / Enterprise
 * plan.
 */

export type SubscriptionSnapshot = {
  status: SubscriptionStatus;
  trialEndAt: Date | null;
  currentEndAt: Date | null;
  graceEndAt: Date | null;
};

export type PlanTerms = {
  trialDays: number;
  gracePeriodDays: number;
  intervalDays: number;
};

/**
 * Statuses that entitle a business to appear in the marketplace and take
 * bookings. GRACE is included deliberately: a business whose payment is a few
 * days late should not lose its customers mid-week.
 */
const ENTITLED: readonly SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE'];

export function isEntitled(status: SubscriptionStatus): boolean {
  return ENTITLED.includes(status);
}

/** The status a subscription should hold right now, given the clock. */
export function resolveStatus(
  snapshot: SubscriptionSnapshot,
  terms: PlanTerms,
  now: Date,
): SubscriptionStatus {
  // Cancelled and expired are decisions, not time-based states.
  if (snapshot.status === 'CANCELLED') return 'CANCELLED';
  if (snapshot.status === 'EXPIRED') return 'EXPIRED';

  if (snapshot.status === 'TRIALING') {
    if (!snapshot.trialEndAt) return 'TRIALING';
    if (now < snapshot.trialEndAt) return 'TRIALING';
    // Trial is over and nothing has been paid: the grace period starts here.
    const graceEnd =
      snapshot.graceEndAt ??
      new Date(snapshot.trialEndAt.getTime() + terms.gracePeriodDays * 86_400_000);
    return now < graceEnd ? 'GRACE' : 'EXPIRED';
  }

  if (snapshot.status === 'ACTIVE') {
    if (!snapshot.currentEndAt || now < snapshot.currentEndAt) return 'ACTIVE';
    return 'PAST_DUE';
  }

  if (snapshot.status === 'PAST_DUE' || snapshot.status === 'GRACE') {
    const anchor = snapshot.currentEndAt ?? snapshot.trialEndAt;
    if (!anchor) return snapshot.status;
    const graceEnd =
      snapshot.graceEndAt ?? new Date(anchor.getTime() + terms.gracePeriodDays * 86_400_000);
    return now < graceEnd ? 'GRACE' : 'EXPIRED';
  }

  return snapshot.status;
}

/** Days until the trial ends — drives the "trial ending" notification. */
export function trialDaysRemaining(snapshot: SubscriptionSnapshot, now: Date): number | null {
  if (snapshot.status !== 'TRIALING' || !snapshot.trialEndAt) return null;
  return Math.max(0, Math.ceil((snapshot.trialEndAt.getTime() - now.getTime()) / 86_400_000));
}

/** The end of a billing period starting at `from`. */
export function periodEnd(from: Date, terms: PlanTerms): Date {
  return new Date(from.getTime() + terms.intervalDays * 86_400_000);
}

export function intervalDaysFor(interval: 'MONTH' | 'YEAR'): number {
  return interval === 'YEAR' ? 365 : 30;
}
