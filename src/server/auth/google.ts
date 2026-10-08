import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { type GoogleClaims, checkGoogleClaims, decodeJwtPayload, pkceChallenge } from '@/domain/identity/oidc';
import { generateToken, hashPassword } from './hash';

/**
 * "Continuer avec Google": OpenID Connect authorization-code flow with PKCE,
 * a state value (CSRF) and a nonce (replay), all checked server-side.
 *
 * Google only proves who the person is. What they may do is still decided by
 * our own roles, and an account with two-step login on still asks for its
 * authenticator code afterwards.
 */

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const PROVIDER = 'google';
export const OAUTH_COOKIE = 'zynetna_oauth';
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

export function googleEnabled(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return new URL('/api/auth/google/callback', env.APP_URL).toString();
}

/** What travels in the short-lived HttpOnly cookie between start and callback. */
export type OAuthPending = { state: string; verifier: string; nonce: string; redirectTo: string | null };

export function beginGoogleSignIn(redirectTo: string | null): { url: string; pending: OAuthPending } {
  const pending: OAuthPending = {
    state: generateToken(24),
    verifier: generateToken(48),
    nonce: generateToken(24),
    redirectTo,
  };
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: pkceChallenge(pending.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return { url: `${AUTHORIZE_URL}?${params.toString()}`, pending };
}

export function encodePending(pending: OAuthPending): string {
  return Buffer.from(JSON.stringify(pending)).toString('base64url');
}

export function decodePending(value: string | undefined): OAuthPending | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof parsed?.state === 'string' && typeof parsed?.verifier === 'string' && typeof parsed?.nonce === 'string') {
      return parsed as OAuthPending;
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** Trade the one-time code for Google's verdict on who signed in. */
export async function exchangeGoogleCode(
  code: string,
  pending: OAuthPending,
): Promise<{ ok: true; claims: GoogleClaims } | { ok: false; reason: string }> {
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID ?? '',
        client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: googleRedirectUri(),
        grant_type: 'authorization_code',
        code_verifier: pending.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return { ok: false, reason: `token request failed: ${(error as Error).message}` };
  }
  if (!response.ok) return { ok: false, reason: `token endpoint answered ${response.status}` };

  const body = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!body || typeof body.id_token !== 'string') return { ok: false, reason: 'no id_token' };

  const checked = checkGoogleClaims(decodeJwtPayload(body.id_token), {
    clientId: env.GOOGLE_CLIENT_ID ?? '',
    nonce: pending.nonce,
    now: new Date(),
  });
  return checked.ok ? { ok: true, claims: checked.claims } : { ok: false, reason: checked.problem };
}

/**
 * The account a Google identity signs into:
 * 1. one already linked to this Google user (by `sub`, which never changes);
 * 2. else the account with the same, Google-verified email, which gets linked;
 * 3. else a new customer account, with the email marked verified and an
 *    unusable random password (the person can set one with "mot de passe
 *    oublié" if they ever want to sign in without Google).
 */
export async function resolveGoogleUser(claims: GoogleClaims, locale: 'fr' | 'ar' | 'en' = 'fr') {
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: PROVIDER, providerAccountId: claims.sub } },
    select: { userId: true },
  });
  if (linked) return { userId: linked.userId, outcome: 'signed_in' as const };

  const existing = await db.user.findUnique({
    where: { email: claims.email },
    select: { id: true, emailVerified: true },
  });
  if (existing) {
    await db.$transaction([
      db.oAuthAccount.create({
        data: { provider: PROVIDER, providerAccountId: claims.sub, userId: existing.id, email: claims.email },
      }),
      ...(existing.emailVerified
        ? []
        : [db.user.update({ where: { id: existing.id }, data: { emailVerified: new Date() } })]),
    ]);
    return { userId: existing.id, outcome: 'linked' as const };
  }

  const [first, ...rest] = (claims.name ?? '').split(/\s+/).filter(Boolean);
  const user = await db.user.create({
    data: {
      email: claims.email,
      passwordHash: await hashPassword(generateToken()),
      firstName: claims.givenName ?? first ?? claims.email.split('@')[0]!.slice(0, 40),
      lastName: claims.familyName ?? (rest.join(' ') || ''),
      emailVerified: new Date(),
      locale,
      roles: { create: { role: 'CUSTOMER' } },
      oauthAccounts: {
        create: { provider: PROVIDER, providerAccountId: claims.sub, email: claims.email },
      },
    },
    select: { id: true },
  });
  logger.info('account created with Google', { userId: user.id });
  return { userId: user.id, outcome: 'created' as const };
}
