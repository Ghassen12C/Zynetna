'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { invalid } from '@/lib/errors';
import { recordAudit } from '@/server/audit';
import { burnTime, hashPassword, verifyPassword } from '@/server/auth/hash';
import { createSession, destroySession, revokeAllSessions } from '@/server/auth/session';
import { requireActor } from '@/server/auth/guard';
import { consume } from '@/server/rateLimit';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
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
