import type { SubscriptionStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { notFound } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  type PlanTerms,
  intervalDaysFor,
  isEntitled,
  periodEnd,
  resolveStatus,
  trialDaysRemaining,
} from '@/domain/monetization/lifecycle';
import { type Entitlements, parseEntitlements } from '@/domain/monetization/entitlements';
import { notify } from './notifications';

/** Terms are read from the plan row — never hard-coded here. */
function termsOf(plan: {
  trialDays: number;
  gracePeriodDays: number;
  interval: 'MONTH' | 'YEAR';
}): PlanTerms {
  return {
    trialDays: plan.trialDays,
    gracePeriodDays: plan.gracePeriodDays,
    intervalDays: intervalDaysFor(plan.interval),
  };
}

/** The plan a new business starts on. */
export async function defaultPlan() {
  const plan =
    (await db.subscriptionPlan.findFirst({ where: { isDefault: true, isActive: true } })) ??
    (await db.subscriptionPlan.findFirst({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    }));
  if (!plan) throw notFound('No subscription plan is configured.');
  return plan;
}

/**
 * The plan to advertise on public marketing pages, or null when none is
 * configured. Distinct from `defaultPlan()` deliberately: that one throws,
 * which is right when starting a trial and wrong on the home page — a missing
 * plan row should drop a pricing badge, not take down the marketplace.
 */
export async function publicPlan() {
  return (
    (await db.subscriptionPlan.findFirst({ where: { isDefault: true, isActive: true } })) ??
    (await db.subscriptionPlan.findFirst({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    }))
  );
}

/** Start the free trial when a business is created. */
export async function startTrial(businessId: string, planId?: string) {
  const plan = planId
    ? await db.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } })
    : await defaultPlan();

  const now = new Date();
  const trialEndAt = new Date(now.getTime() + plan.trialDays * 86_400_000);

  return db.subscription.upsert({
    where: { businessId },
    create: {
      businessId,
      planId: plan.id,
      status: plan.trialDays > 0 ? 'TRIALING' : 'PAST_DUE',
      trialStartAt: plan.trialDays > 0 ? now : null,
      trialEndAt: plan.trialDays > 0 ? trialEndAt : null,
      graceEndAt: new Date(trialEndAt.getTime() + plan.gracePeriodDays * 86_400_000),
      events: {
        create: {
          toStatus: plan.trialDays > 0 ? 'TRIALING' : 'PAST_DUE',
          reason: `Trial started on plan ${plan.code}`,
        },
      },
    },
    update: {},
  });
}

/** May this business appear in the marketplace and take bookings? */
export async function isEntitledToBookings(businessId: string): Promise<boolean> {
  const subscription = await db.subscription.findUnique({
    where: { businessId },
    select: {
      status: true,
      trialEndAt: true,
      currentEndAt: true,
      graceEndAt: true,
      plan: { select: { trialDays: true, gracePeriodDays: true, interval: true } },
    },
  });
  // A business with no subscription row predates monetization; allow it rather
  // than silently taking a live business offline.
  if (!subscription) return true;

  const effective = resolveStatus(subscription, termsOf(subscription.plan), new Date());
  return isEntitled(effective);
}

export async function entitlementsFor(businessId: string): Promise<Entitlements> {
  const subscription = await db.subscription.findUnique({
    where: { businessId },
    select: { plan: { select: { features: true } } },
  });
  return parseEntitlements(subscription?.plan.features);
}

/** Full subscription view for the professional dashboard. */
export async function getSubscriptionView(businessId: string) {
  const subscription = await db.subscription.findUnique({
    where: { businessId },
    include: {
      plan: true,
      payments: { orderBy: { createdAt: 'desc' }, take: 12 },
      events: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!subscription) return null;

  const now = new Date();
  const effective = resolveStatus(subscription, termsOf(subscription.plan), now);

  return {
    ...subscription,
    effectiveStatus: effective,
    entitled: isEntitled(effective),
    trialDaysLeft: trialDaysRemaining(subscription, now),
    entitlements: parseEntitlements(subscription.plan.features),
  };
}

/** Record a payment and move the subscription into its next paid period. */
export async function recordPayment(opts: {
  businessId: string;
  amount: number;
  provider?: string;
  providerRef?: string | null;
  recordedById?: string | null;
}) {
  const subscription = await db.subscription.findUnique({
    where: { businessId: opts.businessId },
    include: { plan: true },
  });
  if (!subscription) throw notFound('No subscription for this business.');

  const terms = termsOf(subscription.plan);
  const now = new Date();
  // Extend from the current period end when still in credit, else from now.
  const start =
    subscription.currentEndAt && subscription.currentEndAt > now
      ? subscription.currentEndAt
      : now;
  const end = periodEnd(start, terms);

  return db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        subscriptionId: subscription.id,
        amount: opts.amount,
        currency: subscription.plan.currency,
        status: 'SUCCEEDED',
        provider: opts.provider ?? 'manual',
        providerRef: opts.providerRef ?? null,
        periodStart: start,
        periodEnd: end,
        paidAt: now,
        recordedById: opts.recordedById ?? null,
      },
    });

    const updated = await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentStartAt: start,
        currentEndAt: end,
        graceEndAt: new Date(end.getTime() + terms.gracePeriodDays * 86_400_000),
      },
    });

    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        fromStatus: subscription.status,
        toStatus: 'ACTIVE',
        reason: `Payment recorded (${opts.amount} ${subscription.plan.currency})`,
        actorId: opts.recordedById ?? null,
      },
    });

    return updated;
  });
}

export async function cancelSubscription(businessId: string, reason?: string) {
  const subscription = await db.subscription.findUnique({ where: { businessId } });
  if (!subscription) throw notFound('No subscription for this business.');

  return db.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason ?? null },
    });
    await tx.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        fromStatus: subscription.status,
        toStatus: 'CANCELLED',
        reason: reason ?? 'Cancelled',
      },
    });
    return updated;
  });
}

/**
 * Idempotent lifecycle sweep, run by the scheduled job.
 * Advances TRIALING → GRACE → EXPIRED, ACTIVE → PAST_DUE → GRACE → EXPIRED,
 * and emits trial-ending / expiry notifications exactly once per transition.
 */
export async function runSubscriptionLifecycle(now = new Date()) {
  const subscriptions = await db.subscription.findMany({
    where: { status: { notIn: ['CANCELLED', 'EXPIRED'] } },
    include: { plan: true, business: { select: { id: true, ownerId: true, name: true } } },
  });

  let transitioned = 0;
  let warned = 0;

  for (const subscription of subscriptions) {
    const terms = termsOf(subscription.plan);
    const next = resolveStatus(subscription, terms, now);

    if (next !== subscription.status) {
      await db.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: next as SubscriptionStatus },
        });
        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: subscription.id,
            fromStatus: subscription.status,
            toStatus: next as SubscriptionStatus,
            reason: 'Lifecycle job',
          },
        });
      });
      transitioned += 1;

      if (next === 'EXPIRED') {
        await notify.subscriptionExpired(subscription.business.ownerId, subscription.business.name);
      }
      continue;
    }

    // Warn once when a trial has a week or less left.
    const left = trialDaysRemaining(subscription, now);
    if (left !== null && left <= 7) {
      const already = await db.notification.findFirst({
        where: {
          userId: subscription.business.ownerId,
          type: 'TRIAL_ENDING',
          createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        },
        select: { id: true },
      });
      if (!already) {
        await notify.trialEnding(subscription.business.ownerId, subscription.business.name, left);
        warned += 1;
      }
    }
  }

  logger.info('subscription lifecycle complete', {
    examined: subscriptions.length,
    transitioned,
    warned,
  });
  return { examined: subscriptions.length, transitioned, warned };
}
