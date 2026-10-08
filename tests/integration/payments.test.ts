import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '@/domain/identity/actor';
import { startTrial } from '@/server/services/subscriptions';
import {
  confirmD17Payment,
  d17QrImage,
  getD17Settings,
  paymentProofFor,
  rejectD17Payment,
  saveD17Settings,
  submitD17Payment,
} from '@/server/services/payments';
import { makeBusiness, makeCustomer, resetDatabase, testDb } from '../setup';

/**
 * Subscription payment by D17: the business sends a screenshot, nothing moves
 * until an admin confirms, and nobody outside the business (or the platform
 * team) can see the screenshot.
 */

let png: Buffer;

function actorFor(userId: string, extra: Partial<Actor> = {}): Actor {
  return {
    userId,
    email: `${userId}@test.tn`,
    firstName: 'T',
    lastName: 'T',
    locale: 'fr',
    globalRoles: [],
    businessRoles: {},
    ...extra,
  };
}

async function setup() {
  const admin = await makeCustomer('admin@test.tn');
  await testDb.roleAssignment.create({ data: { userId: admin.id, role: 'SUPER_ADMIN' } });
  const monthly = await testDb.subscriptionPlan.create({
    data: {
      code: 'pro-monthly', name: 'Pro', priceAmount: 30, currency: 'TND',
      interval: 'MONTH', trialDays: 60, gracePeriodDays: 7, isDefault: true,
    },
  });
  const yearly = await testDb.subscriptionPlan.create({
    data: {
      code: 'pro-yearly', name: 'Pro annuel', priceAmount: 300, currency: 'TND',
      interval: 'YEAR', trialDays: 60, gracePeriodDays: 7,
    },
  });
  const { business, owner } = await makeBusiness({ slug: 'pay-a', ownerEmail: 'pay-a@test.tn' });
  await startTrial(business.id, monthly.id);
  await saveD17Settings({
    enabled: true,
    holder: 'Zynetna',
    phone: '',
    qr: { buffer: png, declaredType: 'image/png' },
    actorId: admin.id,
  });
  return { admin, monthly, yearly, business, owner };
}

describe('D17 payments', () => {
  beforeAll(async () => {
    png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 40, b: 40 } },
    })
      .png()
      .toBuffer();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('cannot be switched on without a QR code', async () => {
    const admin = await makeCustomer('admin@test.tn');
    await expect(
      saveD17Settings({ enabled: true, holder: '', phone: '', qr: null, actorId: admin.id }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('keeps the payment pending, and the subscription unchanged, until confirmed', async () => {
    const { business, owner, yearly } = await setup();
    const before = await testDb.subscription.findUniqueOrThrow({ where: { businessId: business.id } });

    const payment = await submitD17Payment({
      businessId: business.id,
      planId: yearly.id,
      transactionRef: 'TX-123',
      proof: { buffer: png, declaredType: 'image/png' },
      submittedById: owner.id,
    });

    const stored = await testDb.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe('PENDING');
    expect(Number(stored.amount)).toBe(300);
    expect(stored.planId).toBe(yearly.id);
    expect(stored.proofKey).toMatch(/^private\/payments\//);
    expect(stored.metadata).toMatchObject({ reference: expect.stringMatching(/^ZYN-/) });

    const after = await testDb.subscription.findUniqueOrThrow({ where: { businessId: business.id } });
    expect(after.status).toBe(before.status);
    expect(after.planId).toBe(before.planId);
    expect(after.currentEndAt).toBeNull();
  });

  it('allows one pending payment at a time', async () => {
    const { business, owner, monthly } = await setup();
    const input = {
      businessId: business.id,
      planId: monthly.id,
      transactionRef: null,
      proof: { buffer: png, declaredType: 'image/png' },
      submittedById: owner.id,
    };
    await submitD17Payment(input);
    await expect(submitD17Payment(input)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuses a payment while D17 is switched off', async () => {
    const { business, owner, monthly, admin } = await setup();
    await saveD17Settings({ enabled: false, holder: '', phone: '', actorId: admin.id });
    await expect(
      submitD17Payment({
        businessId: business.id,
        planId: monthly.id,
        transactionRef: null,
        proof: { buffer: png, declaredType: 'image/png' },
        submittedById: owner.id,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuses a file that is not an image', async () => {
    const { business, owner, monthly } = await setup();
    await expect(
      submitD17Payment({
        businessId: business.id,
        planId: monthly.id,
        transactionRef: null,
        proof: { buffer: Buffer.from('<script>alert(1)</script>'), declaredType: 'image/png' },
        submittedById: owner.id,
      }),
    ).rejects.toThrow();
    expect(await testDb.payment.count()).toBe(0);
  });

  it('on confirmation, activates the subscription on the paid plan, once', async () => {
    const { business, owner, yearly, admin } = await setup();
    const payment = await submitD17Payment({
      businessId: business.id,
      planId: yearly.id,
      transactionRef: null,
      proof: { buffer: png, declaredType: 'image/png' },
      submittedById: owner.id,
    });

    await confirmD17Payment(payment.id, admin.id);

    const sub = await testDb.subscription.findUniqueOrThrow({ where: { businessId: business.id } });
    expect(sub.status).toBe('ACTIVE');
    expect(sub.planId).toBe(yearly.id);
    expect(sub.currentEndAt).not.toBeNull();

    const stored = await testDb.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe('SUCCEEDED');
    expect(stored.paidAt).not.toBeNull();
    // The same payment, not a second one.
    expect(await testDb.payment.count()).toBe(1);

    const owners = await testDb.notification.count({ where: { userId: owner.id } });
    expect(owners).toBeGreaterThan(0);

    await expect(confirmD17Payment(payment.id, admin.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(rejectD17Payment(payment.id, admin.id, 'late')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('on refusal, records the reason and changes nothing else', async () => {
    const { business, owner, monthly, admin } = await setup();
    const payment = await submitD17Payment({
      businessId: business.id,
      planId: monthly.id,
      transactionRef: null,
      proof: { buffer: png, declaredType: 'image/png' },
      submittedById: owner.id,
    });

    await rejectD17Payment(payment.id, admin.id, 'Montant non reçu');

    const stored = await testDb.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe('FAILED');
    expect(stored.failureReason).toBe('Montant non reçu');
    const sub = await testDb.subscription.findUniqueOrThrow({ where: { businessId: business.id } });
    expect(sub.status).toBe('TRIALING');
    expect(sub.currentEndAt).toBeNull();

    // A new attempt is possible after a refusal.
    await expect(
      submitD17Payment({
        businessId: business.id,
        planId: monthly.id,
        transactionRef: null,
        proof: { buffer: png, declaredType: 'image/png' },
        submittedById: owner.id,
      }),
    ).resolves.toBeTruthy();
  });

  it('shows the screenshot to its business and the admins only', async () => {
    const { business, owner, monthly, admin } = await setup();
    const other = await makeBusiness({ slug: 'pay-b', ownerEmail: 'pay-b@test.tn' });
    const payment = await submitD17Payment({
      businessId: business.id,
      planId: monthly.id,
      transactionRef: null,
      proof: { buffer: png, declaredType: 'image/png' },
      submittedById: owner.id,
    });

    const ownerActor = actorFor(owner.id, { businessRoles: { [business.id]: ['BUSINESS_OWNER'] } });
    const adminActor = actorFor(admin.id, { globalRoles: ['SUPER_ADMIN'] });
    const otherActor = actorFor(other.owner.id, {
      businessRoles: { [other.business.id]: ['BUSINESS_OWNER'] },
    });
    const customer = actorFor((await makeCustomer('c@test.tn')).id, { globalRoles: ['CUSTOMER'] });

    const image = await paymentProofFor(payment.id, ownerActor);
    expect((await sharp(image).metadata()).format).toBe('webp');
    await expect(paymentProofFor(payment.id, adminActor)).resolves.toBeInstanceOf(Buffer);
    await expect(paymentProofFor(payment.id, otherActor)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(paymentProofFor(payment.id, customer)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('shows the QR only while D17 is on, except to admins', async () => {
    const { admin, owner, business } = await setup();
    const ownerActor = actorFor(owner.id, { businessRoles: { [business.id]: ['BUSINESS_OWNER'] } });
    const adminActor = actorFor(admin.id, { globalRoles: ['SUPER_ADMIN'] });
    await expect(d17QrImage(ownerActor)).resolves.toBeInstanceOf(Buffer);

    await saveD17Settings({ enabled: false, holder: 'Zynetna', phone: '', actorId: admin.id });
    expect((await getD17Settings()).qrKey).not.toBeNull();
    await expect(d17QrImage(ownerActor)).rejects.toThrow();
    await expect(d17QrImage(adminActor)).resolves.toBeInstanceOf(Buffer);
  });
});
