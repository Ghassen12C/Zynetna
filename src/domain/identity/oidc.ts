import { createHash } from 'node:crypto';

/**
 * OpenID Connect helpers for "Continuer avec Google". Pure, so the checks that
 * decide whether a sign-in is genuine are unit-tested on their own.
 *
 * The ID token is received straight from Google's token endpoint over TLS in
 * exchange for a one-time code and our client secret, which is the case where
 * OpenID Connect Core (§3.1.3.7) lets the client rely on TLS instead of
 * checking the token's signature. Every claim below is still checked.
 */

export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;
/** Clock tolerance between our server and Google's. */
export const CLOCK_SKEW_SECONDS = 120;

export type GoogleClaims = {
  sub: string;
  email: string;
  givenName: string | null;
  familyName: string | null;
  name: string | null;
};

export type ClaimsProblem =
  | 'malformed'
  | 'issuer'
  | 'audience'
  | 'expired'
  | 'nonce'
  | 'email_unverified';

/** PKCE: the challenge sent up front for the verifier revealed at the exchange. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** The payload of a JWT, without checking anything. */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Check an ID token's claims: issued by Google, for us, not expired, carrying
 * the nonce of this sign-in, and for an email address Google has verified.
 */
export function checkGoogleClaims(
  payload: Record<string, unknown> | null,
  expected: { clientId: string; nonce: string; now: Date },
): { ok: true; claims: GoogleClaims } | { ok: false; problem: ClaimsProblem } {
  if (!payload) return { ok: false, problem: 'malformed' };
  const { iss, aud, exp, nonce, sub, email, email_verified } = payload;

  if (typeof sub !== 'string' || !sub || typeof email !== 'string' || !email.includes('@')) {
    return { ok: false, problem: 'malformed' };
  }
  if (typeof iss !== 'string' || !(GOOGLE_ISSUERS as readonly string[]).includes(iss)) {
    return { ok: false, problem: 'issuer' };
  }
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(expected.clientId)) return { ok: false, problem: 'audience' };
  if (typeof exp !== 'number' || exp * 1000 < expected.now.getTime() - CLOCK_SKEW_SECONDS * 1000) {
    return { ok: false, problem: 'expired' };
  }
  if (typeof nonce !== 'string' || nonce !== expected.nonce) {
    return { ok: false, problem: 'nonce' };
  }
  // Linking to an existing account by email is only safe for an address the
  // provider has proved the person owns.
  if (email_verified !== true && email_verified !== 'true') {
    return { ok: false, problem: 'email_unverified' };
  }

  const text = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : null;
  return {
    ok: true,
    claims: {
      sub,
      email: email.trim().toLowerCase(),
      givenName: text(payload.given_name),
      familyName: text(payload.family_name),
      name: text(payload.name),
    },
  };
}
