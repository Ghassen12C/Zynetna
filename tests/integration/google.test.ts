import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resolveGoogleUser } from '@/server/auth/google';
import { verifyPassword } from '@/server/auth/hash';
import { makeCustomer, resetDatabase, testDb } from '../setup';

/**
 * Which account a Google sign-in lands in. The identity checks on Google's
 * token are unit-tested in tests/domain/oidc.test.ts; this is the part that
 * touches accounts.
 */

const claims = (overrides: Partial<Parameters<typeof resolveGoogleUser>[0]> = {}) => ({
  sub: 'google-sub-1',
  email: 'nouveau@test.tn',
  givenName: 'Amira',
  familyName: 'Ben Salah',
  name: 'Amira Ben Salah',
  ...overrides,
});

describe('Continuer avec Google', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('creates a verified customer account with no usable password', async () => {
    const result = await resolveGoogleUser(claims(), 'ar');
    expect(result.outcome).toBe('created');

    const user = await testDb.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { roles: true, oauthAccounts: true },
    });
    expect(user).toMatchObject({ firstName: 'Amira', lastName: 'Ben Salah', locale: 'ar' });
    expect(user.emailVerified).not.toBeNull();
    expect(user.roles.map((r) => r.role)).toEqual(['CUSTOMER']);
    expect(user.oauthAccounts).toHaveLength(1);
    // Nobody can sign in to it with a guessed password.
    expect(await verifyPassword('', user.passwordHash)).toBe(false);
  });

  it('signs the same Google user back into the same account', async () => {
    const first = await resolveGoogleUser(claims());
    // Even after changing the email on the Google side: `sub` identifies them.
    const again = await resolveGoogleUser(claims({ email: 'autre@test.tn' }));
    expect(again).toEqual({ userId: first.userId, outcome: 'signed_in' });
    expect(await testDb.user.count()).toBe(1);
  });

  it('links to an existing account with the same email instead of duplicating it', async () => {
    const existing = await makeCustomer('client@test.tn');
    const result = await resolveGoogleUser(claims({ email: 'client@test.tn' }));
    expect(result).toEqual({ userId: existing.id, outcome: 'linked' });
    expect(await testDb.user.count()).toBe(1);
    const user = await testDb.user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(user.emailVerified).not.toBeNull();
    // The password they already had keeps working.
    expect(user.passwordHash).toBe(existing.passwordHash);
  });

  it('falls back to the full name, then the email, for a missing first name', async () => {
    const a = await resolveGoogleUser(claims({ sub: 's-a', email: 'a@test.tn', givenName: null, familyName: null, name: 'Sami Trabelsi' }));
    const b = await resolveGoogleUser(claims({ sub: 's-b', email: 'yassine.k@test.tn', givenName: null, familyName: null, name: null }));
    expect(await testDb.user.findUniqueOrThrow({ where: { id: a.userId } })).toMatchObject({ firstName: 'Sami', lastName: 'Trabelsi' });
    expect(await testDb.user.findUniqueOrThrow({ where: { id: b.userId } })).toMatchObject({ firstName: 'yassine.k' });
  });
});
