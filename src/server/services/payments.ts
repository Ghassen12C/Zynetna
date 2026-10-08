import 'server-only';
import { db } from '@/lib/db';
import { conflict, forbidden, invalid, notFound } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { type Actor, can, isSuperAdmin } from '@/domain/identity/actor';
import { ingestPrivateImage, readPrivateImage } from './media';
import { recordPayment } from './subscriptions';
import { notify } from './notifications';

/**
 * Subscription payments by D17 (La Poste Tunisienne's wallet).
 *
 * Nothing is charged by Zynetna: the business pays the platform's D17 account
 * with its own phone, then sends the screenshot. The payment stays PENDING
 * until a platform admin has checked the money arrived and confirms it; only
 * then is the subscription extended. A rejected payment changes nothing.
 */

export const D17_SETTING = 'payments.d17';
export const D17_PROVIDER = 'd17';

export type D17Settings = {
  enabled: boolean;
  /** Storage key of the D17 "receive money" QR code; private, served by route. */
  qrKey: string | null;
  holder: string;
  phone: string;
};

export async function getD17Settings(): Promise<D17Settings> {
  const row = await db.platformSetting.findUnique({ where: { key: D17_SETTING } });
  const value = (row?.value ?? {}) as Partial<D17Settings>;
  return {
    enabled: value.enabled === true,
    qrKey: typeof value.qrKey === 'string' ? value.qrKey : null,
    holder: typeof value.holder === 'string' ? value.holder : '',
    phone: typeof value.phone === 'string' ? value.phone : '',
  };
}

/** Admin only (checked by the caller). A new QR replaces the old one. */
export async function saveD17Settings(input: {
  enabled: boolean;
  holder: string;
  phone: string;
  qr?: { buffer: Buffer; declaredType: string } | null;
  actorId: string;
}) {
  const current = await getD17Settings();
  const qrKey = input.qr
    ? await ingestPrivateImage({ ...input.qr, uploadedById: input.actorId, prefix: 'payments/d17-qr' })
    : current.qrKey;
  if (input.enabled && !qrKey) throw invalid('d17QrRequired');

  const value: D17Settings = {
    enabled: input.enabled,
    qrKey,
    holder: input.holder.trim().slice(0, 80),
    phone: input.phone.trim().slice(0, 20),
  };
  await db.platformSetting.upsert({
    where: { key: D17_SETTING },
    create: { key: D17_SETTING, value, description: 'D17 payment details', updatedById: input.actorId },
    update: { value, updatedById: input.actorId },
  });
  return value;
}

/** The note a business writes on its D17 transfer, so the admin can match it. */
export function paymentReference(businessId: string): string {
  return `ZYN-${businessId.slice(-6).toUpperCase()}`;
}

/**
 * A business sends a D17 payment for a plan. One pending payment at a time:
 * a second would only confuse the check.
 */
export async function submitD17Payment(input: {
  businessId: string;
  planId: string;
  transactionRef: string | null;
  proof: { buffer: Buffer; declaredType: string };
  submittedById: string;
}) {
  const settings = await getD17Settings();
  if (!settings.enabled || !settings.qrKey) throw conflict('d17Unavailable');

  const subscription = await db.subscription.findUnique({
    where: { businessId: input.businessId },
    select: { id: true, business: { select: { name: true } } },
  });
  if (!subscription) throw notFound('subscriptionNotFound');

  const plan = await db.subscriptionPlan.findFirst({
    where: { id: input.planId, isActive: true },
  });
  if (!plan) throw notFound('planNotFound');

  const pending = await db.payment.count({
    where: { subscriptionId: subscription.id, provider: D17_PROVIDER, status: 'PENDING' },
  });
  if (pending > 0) throw conflict('paymentAlreadyPending');

  const proofKey = await ingestPrivateImage({
    ...input.proof,
    uploadedById: input.submittedById,
    prefix: `payments/${input.businessId}`,
  });

  const payment = await db.payment.create({
    data: {
      subscriptionId: subscription.id,
      amount: plan.priceAmount,
      currency: plan.currency,
      status: 'PENDING',
      provider: D17_PROVIDER,
      providerRef: input.transactionRef?.trim().slice(0, 60) || null,
      planId: plan.id,
      submittedById: input.submittedById,
      proofKey,
      metadata: { reference: paymentReference(input.businessId) },
    },
    select: { id: true },
  });

  await notify
    .paymentSubmitted(subscription.business.name, `${plan.priceAmount.toString()} ${plan.currency}`)
    .catch((error) => logger.warn('payment notification failed', { error: (error as Error).message }));
  return payment;
}

/** Admin: the money arrived. Extends the subscription on the paid plan. */
export async function confirmD17Payment(paymentId: string, adminId: string) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      status: true,
      amount: true,
      planId: true,
      provider: true,
      subscription: { select: { businessId: true, business: { select: { name: true, ownerId: true } } } },
    },
  });
  if (!payment || payment.provider !== D17_PROVIDER) throw notFound('paymentNotFound');
  if (payment.status !== 'PENDING') throw conflict('paymentNotPending');

  const updated = await recordPayment({
    businessId: payment.subscription.businessId,
    amount: Number(payment.amount),
    provider: D17_PROVIDER,
    recordedById: adminId,
    pendingPaymentId: paymentId,
    planId: payment.planId,
  });

  await notify
    .paymentConfirmed(payment.subscription.business.ownerId, payment.subscription.business.name, updated.currentEndAt!)
    .catch((error) => logger.warn('payment notification failed', { error: (error as Error).message }));
  return updated;
}

/** Admin: the money did not arrive, or not the right amount. Nothing changes. */
export async function rejectD17Payment(paymentId: string, adminId: string, reason: string) {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      provider: true,
      subscription: { select: { business: { select: { name: true, ownerId: true } } } },
    },
  });
  if (!payment || payment.provider !== D17_PROVIDER) throw notFound('paymentNotFound');

  const { count } = await db.payment.updateMany({
    where: { id: paymentId, status: 'PENDING' },
    data: {
      status: 'FAILED',
      failureReason: reason.trim().slice(0, 300) || null,
      reviewedAt: new Date(),
      recordedById: adminId,
    },
  });
  if (count !== 1) throw conflict('paymentNotPending');

  await notify
    .paymentRejected(payment.subscription.business.ownerId, payment.subscription.business.name, reason.trim())
    .catch((error) => logger.warn('payment notification failed', { error: (error as Error).message }));
}

/**
 * The screenshot of a payment, for the people allowed to see it: a platform
 * admin, or someone who can read that business's subscription. Anyone else
 * gets "not found", so the route does not even confirm the payment exists.
 */
export async function paymentProofFor(paymentId: string, actor: Actor): Promise<Buffer> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { proofKey: true, subscription: { select: { businessId: true } } },
  });
  if (!payment?.proofKey) throw notFound('paymentNotFound');
  if (!can(actor, 'business.subscription.read', { businessId: payment.subscription.businessId })) {
    throw notFound('paymentNotFound');
  }
  return readPrivateImage(payment.proofKey);
}

/**
 * The D17 QR code, for signed-in professionals about to pay. Admins also see
 * it while payment by D17 is switched off, to check it before opening it.
 */
export async function d17QrImage(actor: Actor): Promise<Buffer> {
  const settings = await getD17Settings();
  if (!settings.qrKey || (!settings.enabled && !isSuperAdmin(actor))) throw forbidden();
  return readPrivateImage(settings.qrKey);
}
