import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { base32Decode, totp } from '@/domain/identity/totp';
import { hashPassword } from '@/server/auth/hash';
import {
  CHALLENGE_MAX_ATTEMPTS,
  RECOVERY_CODE_COUNT,
  beginEnrollment,
  clearTwoFactor,
  completeLoginChallenge,
  confirmEnrollment,
  createLoginChallenge,
  disableTwoFactor,
  findLoginChallenge,
  openSecret,
  regenerateRecoveryCodes,
  twoFactorStatus,
  verifySecondFactor,
} from '@/server/auth/twoFactor';
import { makeCustomer, resetDatabase, testDb } from '../setup';

/**
 * Two-step login against a real database: the secret is sealed at rest, a
 * code works once, recovery codes work once, and a pending login gives up
 * after a few wrong codes.
 */

const STEP = 30_000;

async function enrolled(email: string) {
  const user = await makeCustomer(email);
  await testDb.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword('Correct-Horse-9') },
  });
  const { secretBase32 } = await beginEnrollment(user.id);
  const secret = base32Decode(secretBase32);
  const now = new Date();
  const codes = await confirmEnrollment(user.id, totp(secret, now), now);
  return { user, secret, codes, now };
}

describe('two-step login', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  it('enrols only with a correct first code and seals the secret at rest', async () => {
    const user = await makeCustomer('enrol@test.tn');
    const { secretBase32, uri, qrDataUrl } = await beginEnrollment(user.id);
    expect(uri).toContain(`secret=${secretBase32}`);
    expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const stored = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.totpSecret).not.toContain(secretBase32);
    expect(openSecret(stored.totpSecret!).equals(base32Decode(secretBase32))).toBe(true);
    expect(stored.totpEnabledAt).toBeNull();

    await expect(confirmEnrollment(user.id, '000000')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });

    const now = new Date();
    const codes = await confirmEnrollment(user.id, totp(base32Decode(secretBase32), now), now);
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    expect((await twoFactorStatus(user.id)).recoveryLeft).toBe(RECOVERY_CODE_COUNT);

    // Recovery codes are stored hashed, never in clear.
    const rows = await testDb.recoveryCode.findMany({ where: { userId: user.id } });
    expect(rows.some((r) => codes.includes(r.codeHash))).toBe(false);
  });

  it('accepts an app code once and refuses it a second time', async () => {
    const { user, secret, now } = await enrolled('replay@test.tn');
    const later = new Date(now.getTime() + STEP);
    const code = totp(secret, later);

    await expect(verifySecondFactor(user.id, code, later)).resolves.toBe('totp');
    await expect(verifySecondFactor(user.id, code, later)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    // The enrolment code itself is spent too.
    await expect(verifySecondFactor(user.id, totp(secret, now), now)).rejects.toBeTruthy();
  });

  it('accepts each recovery code once, whatever its spacing or case', async () => {
    const { user, codes } = await enrolled('recovery@test.tn');
    const first = codes[0]!;
    await expect(verifySecondFactor(user.id, ` ${first.toUpperCase()} `)).resolves.toBe('recovery');
    await expect(verifySecondFactor(user.id, first)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect((await twoFactorStatus(user.id)).recoveryLeft).toBe(RECOVERY_CODE_COUNT - 1);
  });

  it('refuses a code for an account without two-step login', async () => {
    const user = await makeCustomer('plain@test.tn');
    await expect(verifySecondFactor(user.id, '123456')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('completes a pending login once, then forgets it', async () => {
    const { user, secret, now } = await enrolled('challenge@test.tn');
    const token = await createLoginChallenge(user.id, '/pro/dashboard');
    const later = new Date(now.getTime() + STEP);

    const result = await completeLoginChallenge(token, totp(secret, later), later);
    expect(result).toMatchObject({ userId: user.id, redirectTo: '/pro/dashboard', method: 'totp' });
    expect(await findLoginChallenge(token)).toBeNull();
    await expect(completeLoginChallenge(token, totp(secret, later), later)).rejects.toMatchObject({
      i18n: { key: 'twoFactorExpired' },
    });
  });

  it('drops a pending login after too many wrong codes', async () => {
    const { user } = await enrolled('brute@test.tn');
    const token = await createLoginChallenge(user.id, null);

    for (let i = 1; i < CHALLENGE_MAX_ATTEMPTS; i += 1) {
      await expect(completeLoginChallenge(token, '000000')).rejects.toMatchObject({
        i18n: { key: 'twoFactorCodeInvalid' },
      });
    }
    await expect(completeLoginChallenge(token, '000000')).rejects.toMatchObject({
      i18n: { key: 'twoFactorTooManyAttempts' },
    });
    expect(await findLoginChallenge(token)).toBeNull();
  });

  it('keeps only the latest pending login per account', async () => {
    const { user } = await enrolled('twice@test.tn');
    const first = await createLoginChallenge(user.id, null);
    const second = await createLoginChallenge(user.id, null);
    expect(await findLoginChallenge(first)).toBeNull();
    expect(await findLoginChallenge(second)).not.toBeNull();
  });

  it('turns off only with the password and a valid code', async () => {
    const { user, secret, now } = await enrolled('disable@test.tn');
    const later = new Date(now.getTime() + STEP);

    await expect(disableTwoFactor(user.id, 'wrong-password', totp(secret, later))).rejects.toMatchObject({
      i18n: { key: 'currentPasswordWrong' },
    });
    await expect(disableTwoFactor(user.id, 'Correct-Horse-9', '000000')).rejects.toMatchObject({
      i18n: { key: 'twoFactorCodeInvalid' },
    });

    await disableTwoFactor(user.id, 'Correct-Horse-9', totp(secret, later));
    const stored = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.totpEnabledAt).toBeNull();
    expect(stored.totpSecret).toBeNull();
    expect(await testDb.recoveryCode.count({ where: { userId: user.id } })).toBe(0);
  });

  it('replaces recovery codes, and an admin reset clears everything', async () => {
    const { user, secret, codes, now } = await enrolled('renew@test.tn');
    const later = new Date(now.getTime() + STEP);
    const fresh = await regenerateRecoveryCodes(user.id, totp(secret, later));
    expect(fresh).toHaveLength(RECOVERY_CODE_COUNT);
    await expect(verifySecondFactor(user.id, codes[0]!)).rejects.toBeTruthy();
    await expect(verifySecondFactor(user.id, fresh[0]!)).resolves.toBe('recovery');

    await createLoginChallenge(user.id, null);
    await clearTwoFactor(user.id);
    expect((await twoFactorStatus(user.id)).enabledAt).toBeNull();
    expect(await testDb.loginChallenge.count({ where: { userId: user.id } })).toBe(0);
  });
});
