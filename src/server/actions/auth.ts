'use server';

import { headers } from 'next/headers';
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
import { requireActor } from '@/server/auth/guard';
import { consume } from '@/server/rateLimit';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestResetSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@/lib/validation/auth';
import { type FormState, parseForm, toFormState } from './formState';

async function clientIp(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerList.get('x-real-ip') ??
    'unknown'
  );
}

/** Only allow redirects to our own paths — never an absolute URL from a form. */
function safeRedirect(target: string | undefined, fallback: string): string {
  if (!target) return fallback;
  if (!target.startsWith('/') || target.startsWith('//')) return fallback;
  return target;
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(loginSchema, formData);
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
      select: { id: true, passwordHash: true, status: true, roles: { select: { role: true } } },
    });

    if (!user) {
      // Same work as a real verification, so timing does not reveal whether
      // the account exists.
      await burnTime(parsed.data.password);
      return { status: 'error', message: 'E-mail ou mot de passe incorrect.' };
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return { status: 'error', message: 'E-mail ou mot de passe incorrect.' };
    }
    if (user.status !== 'ACTIVE') {
      return {
        status: 'error',
        message: 'Ce compte est suspendu. Contactez le support Zynetna.',
      };
    }

    await createSession(user.id);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await recordAudit({
      action: 'auth.login',
      targetType: 'User',
      targetId: user.id,
      ipAddress: ip,
    });

    // Send people where their work is.
    const roles = user.roles.map((r) => r.role);
    const fallback = roles.includes('SUPER_ADMIN')
      ? '/admin'
      : roles.includes('BUSINESS_OWNER') || roles.includes('BUSINESS_EMPLOYEE')
        ? '/pro/dashboard'
        : '/account';
    destination = safeRedirect(parsed.data.redirectTo, fallback);
  } catch (error) {
    return toFormState(error, 'loginAction');
  }

  redirect(destination);
}

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(registerSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const ip = await clientIp();
    await consume('register', ip);

    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return {
        status: 'error',
        message: 'Un compte existe déjà avec cet e-mail.',
        fieldErrors: { email: 'Déjà utilisé.' },
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
  const parsed = parseForm(changePasswordSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    const user = await db.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
      return {
        status: 'error',
        message: 'Mot de passe actuel incorrect.',
        fieldErrors: { current: 'Incorrect.' },
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

    return { status: 'success', message: 'Mot de passe mis à jour. Vos autres sessions ont été déconnectées.' };
  } catch (error) {
    return toFormState(error, 'changePasswordAction');
  }
}

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(updateProfileSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();

    if (parsed.data.phone) {
      const taken = await db.user.findFirst({
        where: { phone: parsed.data.phone, id: { not: actor.userId } },
        select: { id: true },
      });
      if (taken) throw invalid('Ce numéro est déjà associé à un autre compte.');
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

    return { status: 'success', message: 'Profil enregistré.' };
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
  const parsed = parseForm(requestResetSchema, formData);
  if (!parsed.ok) return parsed.state;

  const generic = {
    status: 'success' as const,
    message:
      'Si un compte existe avec cette adresse, un lien de réinitialisation vient d’être envoyé.',
  };

  try {
    const ip = await clientIp();
    await consume('passwordReset', ip);
    await consume('passwordReset', parsed.data.email);

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, firstName: true, status: true },
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
  const parsed = parseForm(resetPasswordSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(parsed.data.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    const invalidLink = {
      status: 'error' as const,
      message: 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.',
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

    return {
      status: 'success',
      message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.',
    };
  } catch (error) {
    return toFormState(error, 'resetPasswordAction');
  }
}
