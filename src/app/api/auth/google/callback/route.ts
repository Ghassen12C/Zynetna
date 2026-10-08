import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { db } from '@/lib/db';
import { env, isProd } from '@/lib/env';
import { logger } from '@/lib/logger';
import { recordAudit } from '@/server/audit';
import { safeEqual } from '@/server/auth/hash';
import { landingFor, safeRedirect } from '@/server/auth/landing';
import { createSession } from '@/server/auth/session';
import {
  TWO_FACTOR_COOKIE,
  TWO_FACTOR_COOKIE_MAX_AGE,
  createLoginChallenge,
} from '@/server/auth/twoFactor';
import {
  OAUTH_COOKIE,
  decodePending,
  exchangeGoogleCode,
  googleEnabled,
  resolveGoogleUser,
} from '@/server/auth/google';
import { consume } from '@/server/rateLimit';
import { isLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

function to(path: string) {
  return NextResponse.redirect(new URL(path, env.APP_URL));
}

/**
 * GET /api/auth/google/callback — Google sends the visitor back here.
 * Public. The state must match this browser's pending attempt (CSRF), the code
 * is exchanged server-to-server with PKCE, and the ID token's issuer, audience,
 * expiry, nonce and verified email are checked before any account is touched.
 */
export async function GET(request: Request) {
  const store = await cookies();
  const pending = decodePending(store.get(OAUTH_COOKIE)?.value);
  store.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' });

  const params = new URL(request.url).searchParams;
  // The person closed Google's window or said no: back to sign-in, no error.
  if (params.get('error') === 'access_denied') return to('/login');

  const state = params.get('state') ?? '';
  const code = params.get('code') ?? '';
  if (!googleEnabled() || !pending || !code || !state || !safeEqual(state, pending.state)) {
    return to('/login?error=google');
  }

  const ip =
    (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  try {
    await consume('login', ip);
  } catch {
    return to('/login?error=google_rate');
  }

  const result = await exchangeGoogleCode(code, pending);
  if (!result.ok) {
    logger.warn('google sign-in refused', { reason: result.reason });
    return to('/login?error=google');
  }

  const localeCookie = store.get('zynetna_locale')?.value;
  const { userId, outcome } = await resolveGoogleUser(
    result.claims,
    localeCookie && isLocale(localeCookie) ? localeCookie : 'fr',
  );

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { status: true, totpEnabledAt: true, roles: { select: { role: true } } },
  });
  if (user.status !== 'ACTIVE') return to('/login?error=google_suspended');

  if (outcome === 'linked') {
    await recordAudit({ action: 'auth.google_linked', targetType: 'User', targetId: userId, ipAddress: ip });
  } else if (outcome === 'created') {
    await recordAudit({
      action: 'user.updated',
      targetType: 'User',
      targetId: userId,
      metadata: { event: 'registered', method: 'google' },
      ipAddress: ip,
    });
  }

  // Google proves who they are; an authenticator, if they turned it on, is
  // still asked for.
  if (user.totpEnabledAt) {
    const token = await createLoginChallenge(userId, pending.redirectTo);
    store.set(TWO_FACTOR_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: TWO_FACTOR_COOKIE_MAX_AGE,
    });
    return to('/login/verify');
  }

  await createSession(userId);
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  await recordAudit({
    action: 'auth.login',
    targetType: 'User',
    targetId: userId,
    metadata: { method: 'google' },
    ipAddress: ip,
  });
  return to(safeRedirect(pending.redirectTo, landingFor(user.roles.map((r) => r.role))));
}
