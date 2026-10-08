'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { AppError, invalid } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { recordAudit } from '@/server/audit';
import {
  burnTime,
  generateToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '@/server/auth/hash';
import { sendPasswordResetEmail } from '@/server/services/notifications';
import { createSession, destroySession, revokeAllSessions } from '@/server/auth/session';
import {
  TWO_FACTOR_COOKIE,
  TWO_FACTOR_COOKIE_MAX_AGE,
  completeLoginChallenge,
  createLoginChallenge,
} from '@/server/auth/twoFactor';
import { isProd } from '@/lib/env';
import { requireActor } from '@/server/auth/guard';
import { landingFor, safeRedirect } from '@/server/auth/landing';
import { consume } from '@/server/rateLimit';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestResetSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@/lib/validation/auth';
import { type FormState, done, feedbackFor, parseForm, toFormState } from './formState';

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip') ??
    'unknown'
  );
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(loginSchema, formData);
  if (!parsed.ok) return parsed.state;

  let destination = '/account';
  try {
    const ip = await clientIp();
    // Rate-limit by IP and by account, so neither a single attacker nor a
    // distributed one can grind one account.
    await consume('login', ip);
    await consume('login', parsed.data.email);

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        totpEnabledAt: true,
        roles: { select: { role: true } },
      },
    });

    if (!user) {
      // Same work as a real verification, so timing does not reveal whether
      // the account exists.
      await burnTime(parsed.data.password);
      return { status: 'error', message: (await feedbackFor()).errors.badCredentials };
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return { status: 'error', message: (await feedbackFor()).errors.badCredentials };
    }
    if (user.status !== 'ACTIVE') {
      return { status: 'error', message: (await feedbackFor()).errors.accountSuspended };
    }

    // Two-step login: the password alone opens no session, only a short-lived
    // challenge that the authenticator code completes.
    if (user.totpEnabledAt) {
      const token = await createLoginChallenge(
        user.id,
        parsed.data.redirectTo ? safeRedirect(parsed.data.redirectTo, '') || null : null,
      );
      const store = await cookies();
      store.set(TWO_FACTOR_COOKIE, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: TWO_FACTOR_COOKIE_MAX_AGE,
      });
      destination = '/login/verify';
    } else {
      await createSession(user.id);
      await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await recordAudit({
        action: 'auth.login',
        targetType: 'User',
        targetId: user.id,
        ipAddress: ip,
      });
      destination = safeRedirect(parsed.data.redirectTo, landingFor(user.roles.map((r) => r.role)));
    }
  } catch (error) {
    return toFormState(error, 'loginAction');
  }

  redirect(destination);
}

/**
 * Second step of a two-step login: the 6-digit code from the authenticator
 * app, or a one-time recovery code. Rate-limited by IP, and each pending login
 * allows only a few attempts before the password must be entered again.
 */
export async function verifyLoginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let destination = '/account';
  try {
    const store = await cookies();
    const token = store.get(TWO_FACTOR_COOKIE)?.value;
    if (!token) throw invalid('twoFactorExpired');

    const ip = await clientIp();
    await consume('twoFactor', ip);

    const code = String(formData.get('code') ?? '').trim().slice(0, 32);
    if (!code) throw invalid('twoFactorCodeInvalid');

    let result;
    try {
      result = await completeLoginChallenge(token, code);
    } catch (error) {
      // An expired or exhausted challenge cannot be retried: drop the cookie.
      if (
        error instanceof AppError &&
        ['twoFactorExpired', 'twoFactorTooManyAttempts'].includes(error.i18n?.key ?? '')
      ) {
        store.delete(TWO_FACTOR_COOKIE);
      }
      throw error;
    }

    const user = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: { status: true, roles: { select: { role: true } } },
    });
    if (user.status !== 'ACTIVE') {
      store.delete(TWO_FACTOR_COOKIE);
      return { status: 'error', message: (await feedbackFor()).errors.accountSuspended };
    }

    store.delete(TWO_FACTOR_COOKIE);
    await createSession(result.userId);
    await db.user.update({ where: { id: result.userId }, data: { lastLoginAt: new Date() } });
    await recordAudit({
      action: result.method === 'recovery' ? 'auth.2fa_recovery_used' : 'auth.login',
      targetType: 'User',
      targetId: result.userId,
      ipAddress: ip,
    });

    destination = safeRedirect(result.redirectTo ?? undefined, landingFor(user.roles.map((r) => r.role)));
  } catch (error) {
    return toFormState(error, 'verifyLoginAction');
  }

  redirect(destination);
}

/** Give up on a pending two-step login and go back to the password form. */
export async function cancelLoginChallengeAction(): Promise<void> {
  const store = await cookies();
  store.delete(TWO_FACTOR_COOKIE);
  redirect('/login');
}

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(registerSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const ip = await clientIp();
    await consume('register', ip);

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      const f = await feedbackFor();
      return {
        status: 'error',
        message: f.errors.emailTaken,
        fieldErrors: { email: f.validation.alreadyUsed },
      };
    }

    const user = await db.user.create({
      data: {
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone || null,
        locale: parsed.data.locale,
        roles: { create: { role: 'CUSTOMER' } },
      },
      select: { id: true },
    });

    await createSession(user.id);
    await recordAudit({
      action: 'user.updated',
      targetType: 'User',
      targetId: user.id,
      metadata: { event: 'registered' },
      ipAddress: ip,
    });
  } catch (error) {
    return toFormState(error, 'registerAction');
  }

  redirect('/account');
}

export async function logoutAction(): Promise<void> {
  const actor = await requireActor().catch(() => null);
  await destroySession();
  if (actor) {
    await recordAudit({ actor, action: 'auth.logout', targetType: 'User', targetId: actor.userId });
  }
  redirect('/');
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(changePasswordSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    const user = await db.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
      const f = await feedbackFor();
      return {
        status: 'error',
        message: f.errors.currentPasswordWrong,
        fieldErrors: { current: f.validation.incorrect },
      };
    }

    await db.user.update({
      where: { id: actor.userId },
      data: { passwordHash: await hashPassword(parsed.data.password) },
    });

    // A password change invalidates every other session — that is the point of
    // server-side sessions.
    await revokeAllSessions(actor.userId);
    await createSession(actor.userId);
    await recordAudit({
      actor,
      action: 'auth.password_changed',
      targetType: 'User',
      targetId: actor.userId,
    });

    return { status: 'success', message: await done('passwordChanged') };
  } catch (error) {
    return toFormState(error, 'changePasswordAction');
  }
}

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(updateProfileSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();

    if (parsed.data.phone) {
      const taken = await db.user.findFirst({
        where: { phone: parsed.data.phone, id: { not: actor.userId } },
        select: { id: true },
      });
      if (taken) throw invalid('phoneTaken');
    }

    await db.user.update({
      where: { id: actor.userId },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone || null,
        locale: parsed.data.locale,
      },
    });

    return { status: 'success', message: await done('profileSaved') };
  } catch (error) {
    return toFormState(error, 'updateProfileAction');
  }
}

/**
 * Password reset — request step.
 *
 * Always reports success, whether or not the address exists. Telling an
 * attacker which emails are registered is a worse leak than the mild
 * confusion of someone mistyping their own address.
 */
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(requestResetSchema, formData);
  if (!parsed.ok) return parsed.state;

  const generic = { status: 'success' as const, message: await done('resetLinkSent') };

  try {
    const ip = await clientIp();
    await consume('passwordReset', ip);
    await consume('passwordReset', parsed.data.email);

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, firstName: true, status: true, locale: true },
    });
    if (!user || user.status !== 'ACTIVE') return generic;

    // Previous unused links stop working the moment a new one is issued.
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = generateToken();
    await db.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    await sendPasswordResetEmail({
      email: user.email,
      firstName: user.firstName,
      token,
      locale: user.locale,
    });

    return generic;
  } catch (error) {
    // A rate-limit rejection must still surface; anything else stays generic.
    if (error instanceof AppError && error.code === 'RATE_LIMITED') {
      return toFormState(error, 'requestPasswordResetAction');
    }
    logger.error('password reset request failed', { error: (error as Error).message });
    return generic;
  }
}

/** Password reset — completion step. */
export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(resetPasswordSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(parsed.data.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    const invalidLink = {
      status: 'error' as const,
      message: (await feedbackFor()).errors.resetLinkInvalid,
    };
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      return invalidLink;
    }

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(parsed.data.password) },
      }),
      db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Whoever held the old password is signed out everywhere.
    await revokeAllSessions(record.userId);

    await recordAudit({
      action: 'auth.password_reset',
      targetType: 'User',
      targetId: record.userId,
      ipAddress: await clientIp(),
    });

    return { status: 'success', message: await done('passwordReset') };
  } catch (error) {
    return toFormState(error, 'resetPasswordAction');
  }
}
