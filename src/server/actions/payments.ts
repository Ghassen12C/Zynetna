'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { invalid } from '@/lib/errors';
import { recordAudit } from '@/server/audit';
import { requireBusinessAccess, requireSuperAdmin } from '@/server/auth/guard';
import { consume } from '@/server/rateLimit';
import {
  confirmD17Payment,
  rejectD17Payment,
  saveD17Settings,
  submitD17Payment,
} from '@/server/services/payments';
import { cuidSchema } from '@/lib/validation/common';
import { type FormState, done, parseForm, toFormState } from './formState';

/**
 * Pro: send a D17 payment for a plan, with its screenshot.
 * Who: the business owner (business.subscription.manage on that business,
 * checked server-side); the business comes from the form and is verified
 * against the caller's grants, never trusted.
 */
export async function submitD17PaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(
    z.object({
      businessId: cuidSchema,
      planId: cuidSchema,
      transactionRef: z.string().trim().max(60).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const { actor, businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.subscription.manage',
    );
    await consume('mediaUpload', actor.userId);

    const file = formData.get('proof');
    if (!(file instanceof File) || file.size === 0) throw invalid('proofRequired');

    const payment = await submitD17Payment({
      businessId,
      planId: parsed.data.planId,
      transactionRef: parsed.data.transactionRef || null,
      proof: { buffer: Buffer.from(await file.arrayBuffer()), declaredType: file.type },
      submittedById: actor.userId,
    });
    await recordAudit({
      actor, action: 'payment.submitted', targetType: 'Payment',
      targetId: payment.id, businessId,
    });

    revalidatePath('/pro/dashboard/subscription');
    return { status: 'success', message: await done('paymentSubmitted') };
  } catch (error) {
    return toFormState(error, 'submitD17PaymentAction');
  }
}

/** Admin: confirm or refuse a D17 payment. Who: super admins only. */
export async function reviewD17PaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(
    z.object({
      paymentId: cuidSchema,
      decision: z.enum(['confirm', 'reject']),
      reason: z.string().trim().max(300).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();
    if (parsed.data.decision === 'confirm') {
      await confirmD17Payment(parsed.data.paymentId, actor.userId);
      await recordAudit({
        actor, action: 'payment.confirmed', targetType: 'Payment', targetId: parsed.data.paymentId,
      });
    } else {
      if (!parsed.data.reason) throw invalid('reasonRequired');
      await rejectD17Payment(parsed.data.paymentId, actor.userId, parsed.data.reason);
      await recordAudit({
        actor, action: 'payment.rejected', targetType: 'Payment', targetId: parsed.data.paymentId,
        metadata: { reason: parsed.data.reason },
      });
    }
    revalidatePath('/admin/subscriptions');
    return {
      status: 'success',
      message: await done(parsed.data.decision === 'confirm' ? 'paymentConfirmed' : 'paymentRejected'),
    };
  } catch (error) {
    return toFormState(error, 'reviewD17PaymentAction');
  }
}

/** Admin: the D17 QR code and account details. Who: super admins only. */
export async function saveD17SettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireSuperAdmin();
    const file = formData.get('qr');
    const qr =
      file instanceof File && file.size > 0
        ? { buffer: Buffer.from(await file.arrayBuffer()), declaredType: file.type }
        : null;
    await saveD17Settings({
      enabled: formData.get('enabled') === 'on',
      holder: String(formData.get('holder') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      qr,
      actorId: actor.userId,
    });
    await recordAudit({ actor, action: 'setting.updated', targetType: 'PlatformSetting', metadata: { key: 'payments.d17' } });
    revalidatePath('/admin/settings');
    revalidatePath('/pro/dashboard/subscription');
    return { status: 'success', message: await done('d17Saved') };
  } catch (error) {
    return toFormState(error, 'saveD17SettingsAction');
  }
}
