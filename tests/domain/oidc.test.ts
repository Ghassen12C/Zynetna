import { describe, expect, it } from 'vitest';
import { checkGoogleClaims, decodeJwtPayload, pkceChallenge } from '@/domain/identity/oidc';

const CLIENT = 'client-123.apps.googleusercontent.com';
const NOW = new Date('2026-10-08T12:00:00Z');

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT,
    exp: NOW.getTime() / 1000 + 3600,
    nonce: 'n-1',
    sub: '1098765',
    email: 'Ghassen@Example.tn',
    email_verified: true,
    given_name: 'Ghassen',
    family_name: 'Chelly',
    ...overrides,
  };
}

const expected = { clientId: CLIENT, nonce: 'n-1', now: NOW };

describe('Google sign-in claims', () => {
  it('accepts a genuine token and normalises the email', () => {
    const result = checkGoogleClaims(claims(), expected);
    expect(result).toEqual({
      ok: true,
      claims: {
        sub: '1098765',
        email: 'ghassen@example.tn',
        givenName: 'Ghassen',
        familyName: 'Chelly',
        name: null,
      },
    });
  });

  it.each([
    ['issuer', { iss: 'https://evil.example' }],
    ['audience', { aud: 'someone-else' }],
    ['expired', { exp: NOW.getTime() / 1000 - 600 }],
    ['nonce', { nonce: 'replayed' }],
    ['email_unverified', { email_verified: false }],
    ['malformed', { sub: undefined }],
  ])('refuses a token with a bad %s', (problem, override) => {
    expect(checkGoogleClaims(claims(override), expected)).toEqual({ ok: false, problem });
  });

  it('decodes a JWT payload and rejects garbage', () => {
    const body = Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64url');
    expect(decodeJwtPayload(`h.${body}.s`)).toEqual({ sub: 'x' });
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('a.!!!.c')).toBeNull();
  });

  it('computes the RFC 7636 PKCE challenge', () => {
    // RFC 7636 Appendix B.
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});
