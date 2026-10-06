import { beforeEach, describe, expect, it } from 'vitest';
import {
  intervalDaysFor,
  isEntitled,
  resolveStatus,
  trialDaysRemaining,
} from '@/domain/monetization/lifecycle';
import {
  isEntitledToBookings,
  recordPayment,
  runSubscriptionLifecycle,
  startTrial,
} from '@/server/services/subscriptions';
import { createReservation } from '@/server/services/booking';
import { futureSlot, makeBusiness, makeCustomer, resetDatabase, testDb } from '../setup';

const TERMS = { trialDays: 60, gracePeriodDays: 7, intervalDays: 30 };
const now = new Date('2026-06-15T12:00:00Z');
const daysFrom = (base: Date, n: number) => new Date(base.getTime() + n * 86_400_000);

/** The lifecycle rules, as pure functions — no database needed. */
describe('subscription lifecycle — state resolution', () => {
  it('stays in trial until the trial end date', () => {
    expect(
      resolveStatus(
        { status: 'TRIALING', trialEndAt: daysFrom(now, 10), currentEndAt: null, graceEndAt: null },
        TERMS,
        now,
      ),
    ).toBe('TRIALING');
  });

  it('enters grace when the trial ends unpaid, then expires', () => {
    const trialEndAt = daysFrom(now, -1);
    expect(
      resolveStatus({ status: 'TRIALING', trialEndAt, currentEndAt: null, graceEndAt: null }, TERMS, now),
    ).toBe('GRACE');

    // Eight days past the trial, with a seven-day grace.
    expect(
      resolveStatus(
        { status: 'TRIALING', trialEndAt: daysFrom(now, -8), currentEndAt: null, graceEndAt: null },
        TERMS,
        now,
      ),
    ).toBe('EXPIRED');
  });

  it('moves a paid subscription to past due when its period lapses', () => {
    expect(
      resolveStatus(
        { status: 'ACTIVE', trialEndAt: null, currentEndAt: daysFrom(now, 5), graceEndAt: null },
        TERMS,
        now,
      ),
    ).toBe('ACTIVE');

    expect(
      resolveStatus(
        { status: 'ACTIVE', trialEndAt: null, currentEndAt: daysFrom(now, -1), graceEndAt: null },
        TERMS,
        now,
      ),
    ).toBe('PAST_DUE');
  });

  it('treats cancellation and expiry as decisions, not clock states', () => {
    for (const status of ['CANCELLED', 'EXPIRED'] as const) {
      expect(
        resolveStatus({ status, trialEndAt: daysFrom(now, 30), currentEndAt: null, graceEndAt: null }, TERMS, now),
      ).toBe(status);
    }
  });

  it('keeps a business listed during trial, active, past due and grace', () => {
    expect(isEntitled('TRIALING')).toBe(true);
    expect(isEntitled('ACTIVE')).toBe(true);
    expect(isEntitled('PAST_DUE')).toBe(true);
    expect(isEntitled('GRACE')).toBe(true);
    expect(isEntitled('EXPIRED')).toBe(false);
    expect(isEntitled('CANCELLED')).toBe(false);
  });

  it('counts trial days remaining, never below zero', () => {
    expect(
      trialDaysRemaining({ status: 'TRIALING', trialEndAt: daysFrom(now, 14), currentEndAt: null, graceEndAt: null }, now),
    ).toBe(14);
    expect(
      trialDaysRemaining({ status: 'TRIALING', trialEndAt: daysFrom(now, -3), currentEndAt: null, graceEndAt: null }, now),
    ).toBe(0);
    expect(
      trialDaysRemaining({ status: 'ACTIVE', trialEndAt: null, currentEndAt: null, graceEndAt: null }, now),
    ).toBeNull();
  });

  it('derives interval length from the plan', () => {
    expect(intervalDaysFor('MONTH')).toBe(30);
    expect(intervalDaysFor('YEAR')).toBe(365);
  });
});

/** The consequence that makes the subscription real. */
describe('subscription lifecycle — effect on the marketplace', () => {
  beforeEach(async () => {
    await resetDatabase();
    await testDb.subscriptionPlan.create({
      data: {
        code: 'pro-monthly',
        name: 'Pro',
        priceAmount: 30,
        currency: 'TND',
        interval: 'MONTH',
        trialDays: 60,
        gracePeriodDays: 7,
        isDefault: true,
      },
    });
  });

  it('starts a 60-day trial from the plan, not from a constant', async () => {
    const { business } = await makeBusiness({ slug: 'sub-a', ownerEmail: 'sub-a@test.tn' });
    const subscription = await startTrial(business.id);

    expect(subscription.status).toBe('TRIALING');
    const days = Math.round(
      (subscription.trialEndAt!.getTime() - subscription.trialStartAt!.getTime()) / 86_400_000,
    );
    expect(days).toBe(60);
    expect(await isEntitledToBookings(business.id)).toBe(true);
  });

  it('blocks new bookings once the subscription has expired', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'sub-b',
      ownerEmail: 'sub-b@test.tn',
    });
    const customer = await makeCustomer('sub-cust@test.tn');
    const plan = await testDb.subscriptionPlan.findFirstOrThrow();

    await testDb.subscription.create({
      data: {
        businessId: business.id,
        planId: plan.id,
        status: 'EXPIRED',
        trialStartAt: new Date(Date.now() - 120 * 86_400_000),
        trialEndAt: new Date(Date.now() - 60 * 86_400_000),
      },
    });

    expect(await isEntitledToBookings(business.id)).toBe(false);
    await expect(
      createReservation({
        businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
        startAt: futureSlot(3, 15), customerId: customer.id,
      }),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_INACTIVE' });
  });

  it('restores bookings when a payment is recorded', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'sub-c',
      ownerEmail: 'sub-c@test.tn',
    });
    const customer = await makeCustomer('sub-cust-c@test.tn');
    const plan = await testDb.subscriptionPlan.findFirstOrThrow();

    await testDb.subscription.create({
      data: {
        businessId: business.id,
        planId: plan.id,
        status: 'EXPIRED',
        trialEndAt: new Date(Date.now() - 90 * 86_400_000),
      },
    });
    expect(await isEntitledToBookings(business.id)).toBe(false);

    await recordPayment({ businessId: business.id, amount: 30 });

    expect(await isEntitledToBookings(business.id)).toBe(true);
    const booking = await createReservation({
      businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
      startAt: futureSlot(3, 15), customerId: customer.id,
    });
    expect(booking.status).toBe('CONFIRMED');

    const payment = await testDb.payment.findFirstOrThrow();
    expect(payment.status).toBe('SUCCEEDED');
    expect(Number(payment.amount)).toBe(30);
  });

  it('sweeps a lapsed trial into grace, then expiry, and is idempotent', async () => {
    const { business } = await makeBusiness({ slug: 'sub-d', ownerEmail: 'sub-d@test.tn' });
    const plan = await testDb.subscriptionPlan.findFirstOrThrow();

    // Trial ended ten days ago; grace is seven, so this is past expiry.
    await testDb.subscription.create({
      data: {
        businessId: business.id,
        planId: plan.id,
        status: 'TRIALING',
        trialStartAt: new Date(Date.now() - 70 * 86_400_000),
        trialEndAt: new Date(Date.now() - 10 * 86_400_000),
        graceEndAt: new Date(Date.now() - 3 * 86_400_000),
      },
    });

    const first = await runSubscriptionLifecycle();
    expect(first.transitioned).toBe(1);

    const after = await testDb.subscription.findUniqueOrThrow({
      where: { businessId: business.id },
    });
    expect(after.status).toBe('EXPIRED');
    expect(await isEntitledToBookings(business.id)).toBe(false);

    // Running it again must change nothing — the job is retry-safe.
    const second = await runSubscriptionLifecycle();
    expect(second.transitioned).toBe(0);

    const events = await testDb.subscriptionEvent.findMany({
      where: { subscription: { businessId: business.id } },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.toStatus).toBe('EXPIRED');
  });

  it('honours appointments already booked when a subscription expires', async () => {
    const { business, service, staff } = await makeBusiness({
      slug: 'sub-e',
      ownerEmail: 'sub-e@test.tn',
    });
    const customer = await makeCustomer('sub-cust-e@test.tn');
    const plan = await testDb.subscriptionPlan.findFirstOrThrow();

    await testDb.subscription.create({
      data: { businessId: business.id, planId: plan.id, status: 'ACTIVE',
        currentEndAt: new Date(Date.now() + 30 * 86_400_000) },
    });

    const existing = await createReservation({
      businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
      startAt: futureSlot(5, 15), customerId: customer.id,
    });

    await testDb.subscription.update({
      where: { businessId: business.id },
      data: { status: 'EXPIRED' },
    });

    // The existing appointment survives; only new bookings are refused.
    const stillThere = await testDb.reservation.findUniqueOrThrow({ where: { id: existing.id } });
    expect(stillThere.status).toBe('CONFIRMED');

    await expect(
      createReservation({
        businessId: business.id, serviceId: service.id, staffMemberId: staff.id,
        startAt: futureSlot(6, 15), customerId: customer.id,
      }),
    ).rejects.toMatchObject({ code: 'SUBSCRIPTION_INACTIVE' });
  });
});
