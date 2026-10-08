import { cookies, headers } from 'next/headers';
import type { RoleName } from '@prisma/client';
import { db } from '@/lib/db';
import { env, isProd } from '@/lib/env';
import type { Actor } from '@/domain/identity/actor';
import {
  type IdleLimits,
  TOUCH_INTERVAL_MS,
  idleLimitMs,
  isIdleExpired,
} from '@/domain/identity/sessionPolicy';
import { generateToken, hashToken } from './hash';

/**
 * Database-backed sessions in an HttpOnly cookie.
 *
 * Chosen over a stateless JWT because a marketplace needs real revocation:
 * suspending a user, a password change, or "sign out everywhere" must take
 * effect immediately, which a self-contained token cannot deliver.
 */
export const SESSION_COOKIE = 'zynetna_session';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  path: '/',
};

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);

  const headerList = await headers();
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ipAddress: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: headerList.get('user-agent')?.slice(0, 512) ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, expires: expiresAt });
  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session
      .updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}

export function idleLimits(): IdleLimits {
  return {
    adminMinutes: env.SESSION_IDLE_MINUTES_ADMIN,
    proMinutes: env.SESSION_IDLE_MINUTES_PRO,
    customerMinutes: env.SESSION_IDLE_MINUTES_CUSTOMER,
  };
}

/** How long this person may stay inactive before being signed out. */
export function idleLimitFor(actor: Actor): number {
  return idleLimitMs(actor, idleLimits());
}

/** Sign out everywhere — used after a password change. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function toActor(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  roles: { role: RoleName; businessId: string | null }[];
}): Actor {
  const globalRoles: RoleName[] = [];
  const businessRoles: Record<string, RoleName[]> = {};

  for (const assignment of user.roles) {
    if (assignment.businessId) {
      (businessRoles[assignment.businessId] ??= []).push(assignment.role);
    } else {
      globalRoles.push(assignment.role);
    }
  }

  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    locale: user.locale,
    globalRoles,
    businessRoles,
  };
}

/**
 * Resolve the caller from the session cookie. Returns null for anonymous,
 * expired, revoked, idle, or suspended/deleted accounts — a suspended user
 * loses access on their next request, not at their next login. A session left
 * inactive past its idle limit is revoked here, server-side, whatever the
 * browser does.
 */
export async function getActor(): Promise<Actor | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: { roles: { select: { role: true, businessId: true } } },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.user.status !== 'ACTIVE') return null;

  const actor = toActor(session.user);
  const now = new Date();
  if (isIdleExpired(session.lastSeenAt, now, idleLimitFor(actor))) {
    await db.session
      .updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } })
      .catch(() => undefined);
    return null;
  }

  // Throttled last-seen write, which is also what keeps an active session alive.
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    void db.session
      .update({ where: { id: session.id }, data: { lastSeenAt: now } })
      .catch(() => undefined);
  }

  return actor;
}

/**
 * "Still here": refresh the current session's last activity now, without the
 * usual throttle. Returns false when there is no live session to refresh.
 */
export async function touchSession(): Promise<boolean> {
  if (!(await getActor())) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  await db.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { lastSeenAt: new Date() },
  });
  return true;
}

/** Housekeeping, called by the scheduled jobs. */
export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 7 * 86_400_000) } },
  });
  return count;
}
