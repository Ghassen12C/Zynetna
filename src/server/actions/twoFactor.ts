'use server';

import { recordAudit } from '@/server/audit';
import { requireActor } from '@/server/auth/guard';
import {
  beginEnrollment,
  confirmEnrollment,
  disableTwoFactor,
  regenerateRecoveryCodes,
} from '@/server/auth/twoFactor';
import { consume } from '@/server/rateLimit';
import { type FormState, done, toFormState } from './formState';

/**
 * Two-step login management, from the account page.
 *
 * Who can call: any signed-in user, for their own account only — every action
 * acts on `requireActor().userId` and never on an id from the form.
 * Code checks are rate-limited per account, like the login step.
 */

function codeFrom(formData: FormData): string {
  return String(formData.get('code') ?? '').trim().slice(0, 32);
}

/** Step 1: a new secret and its QR code, shown once. */
export async function startTwoFactorAction(
  _prev: FormState<{ qrDataUrl: string; secret: string }>,
  _formData: FormData,
): Promise<FormState<{ qrDataUrl: string; secret: string }>> {
  try {
    const actor = await requireActor();
    const { qrDataUrl, secretBase32 } = await beginEnrollment(actor.userId);
    // Grouped by four so it can be typed into an app without a camera.
    return {
      status: 'success',
      data: { qrDataUrl, secret: secretBase32.match(/.{1,4}/g)?.join(' ') ?? secretBase32 },
    };
  } catch (error) {
    return toFormState(error, 'startTwoFactorAction');
  }
}

/** Step 2: the first code from the app turns it on; recovery codes come back once. */
export async function confirmTwoFactorAction(
  _prev: FormState<{ codes: string[] }>,
  formData: FormData,
): Promise<FormState<{ codes: string[] }>> {
  try {
    const actor = await requireActor();
    await consume('twoFactor', actor.userId);
    const codes = await confirmEnrollment(actor.userId, codeFrom(formData));
    await recordAudit({
      actor,
      action: 'auth.2fa_enabled',
      targetType: 'User',
      targetId: actor.userId,
    });
    return { status: 'success', message: await done('twoFactorEnabled'), data: { codes } };
  } catch (error) {
    return toFormState(error, 'confirmTwoFactorAction');
  }
}

/** Turn it off: password + a current code (or a recovery code). */
export async function disableTwoFactorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const actor = await requireActor();
    await consume('twoFactor', actor.userId);
    await disableTwoFactor(
      actor.userId,
      String(formData.get('password') ?? ''),
      codeFrom(formData),
    );
    await recordAudit({
      actor,
      action: 'auth.2fa_disabled',
      targetType: 'User',
      targetId: actor.userId,
    });
    return { status: 'success', message: await done('twoFactorDisabled') };
  } catch (error) {
    return toFormState(error, 'disableTwoFactorAction');
  }
}

/** Fresh recovery codes; the previous ones stop working. */
export async function regenerateRecoveryCodesAction(
  _prev: FormState<{ codes: string[] }>,
  formData: FormData,
): Promise<FormState<{ codes: string[] }>> {
  try {
    const actor = await requireActor();
    await consume('twoFactor', actor.userId);
    const codes = await regenerateRecoveryCodes(actor.userId, codeFrom(formData));
    await recordAudit({
      actor,
      action: 'auth.2fa_recovery_codes',
      targetType: 'User',
      targetId: actor.userId,
    });
    return { status: 'success', message: await done('recoveryCodesRenewed'), data: { codes } };
  } catch (error) {
    return toFormState(error, 'regenerateRecoveryCodesAction');
  }
}
