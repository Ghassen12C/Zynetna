import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { conflict, invalid } from '@/lib/errors';
import {
  base32Encode,
  matchTotp,
  normalizeTotpInput,
  otpauthUri,
} from '@/domain/identity/totp';
import { generateToken, hashToken, verifyPassword } from './hash';

/**
 * Two-step login with an authenticator app (Google Authenticator and the like).
 *
 * Opt-in per account. Once on, a correct password only opens a short-lived
 * login challenge; the session is created after a valid 6-digit code or a
 * one-time recovery code. Everything here is server-side: the secret never
 * returns to the browser after enrolment, and every check reads the database.
 */

const ISSUER = 'Zynetna';
export const RECOVERY_CODE_COUNT = 10;
export const CHALLENGE_TTL_MS = 10 * 60_000;
export const CHALLENGE_MAX_ATTEMPTS = 5;

// ── Secret at rest ───────────────────────────────────────────────────────────
// AES-256-GCM with a key derived from SESSION_SECRET (unused elsewhere), so a
// database leak alone does not hand over anyone's authenticator secret.
// Rotating SESSION_SECRET therefore turns two-step login off for everyone:
// their stored secrets no longer decrypt and they must enrol again.

function key(): Buffer {
  return Buffer.from(hkdfSync('sha256', env.SESSION_SECRET, 'zynetna', 'totp-secret-v1', 32));
}

export function sealSecret(secret: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), body.toString('base64url')].join('.');
}

export function openSecret(sealed: string): Buffer {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('Unknown secret format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]);
}

// ── Recovery codes ───────────────────────────────────────────────────────────

const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o, 1/l/i

function newRecoveryCode(): string {
  const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET.charAt(randomInt(RECOVERY_ALPHABET.length)));
  return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
}

function normalizeRecovery(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.recoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashToken(normalizeRecovery(code)) })),
    }),
  ]);
  return codes;
}

// ── Status ───────────────────────────────────────────────────────────────────

export async function twoFactorStatus(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totpEnabledAt: true },
  });
  const recoveryLeft = user.totpEnabledAt
    ? await db.recoveryCode.count({ where: { userId, usedAt: null } })
    : 0;
  return { enabledAt: user.totpEnabledAt, recoveryLeft };
}

// ── Enrolment ────────────────────────────────────────────────────────────────

/**
 * Start (or restart) enrolment: a fresh secret is stored, still inactive, and
 * returned once so the app can scan it. Two-step login is not on yet.
 */
export async function beginEnrollment(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, totpEnabledAt: true },
  });
  if (user.totpEnabledAt) throw conflict('twoFactorAlreadyOn');

  const secret = randomBytes(20);
  await db.user.update({
    where: { id: userId },
    data: { totpSecret: sealSecret(secret), totpLastStep: null },
  });

  const secretBase32 = base32Encode(secret);
  const uri = otpauthUri(ISSUER, user.email, secretBase32);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { secretBase32, uri, qrDataUrl };
}

/** Confirm with a first code from the app; returns the recovery codes, once. */
export async function confirmEnrollment(userId: string, code: string, now = new Date()) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (user.totpEnabledAt) throw conflict('twoFactorAlreadyOn');
  if (!user.totpSecret) throw invalid('twoFactorNotStarted');

  const step = matchTotp(openSecret(user.totpSecret), normalizeTotpInput(code), now);
  if (step === null) throw invalid('twoFactorCodeInvalid');

  await db.user.update({
    where: { id: userId },
    data: { totpEnabledAt: now, totpLastStep: step },
  });
  return replaceRecoveryCodes(userId);
}

// ── Verification ─────────────────────────────────────────────────────────────

/**
 * Check a second factor: a 6-digit app code, or a recovery code. Each works
 * once: the accepted app step is recorded with a conditional update, so two
 * requests racing with the same code cannot both pass.
 */
export async function verifySecondFactor(
  userId: string,
  input: string,
  now = new Date(),
): Promise<'totp' | 'recovery'> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true },
  });
  if (!user.totpEnabledAt || !user.totpSecret) throw invalid('twoFactorCodeInvalid');

  const digits = normalizeTotpInput(input);
  if (digits.length === 6 && digits === input.replace(/\s/g, '')) {
    const step = matchTotp(openSecret(user.totpSecret), digits, now, user.totpLastStep);
    if (step !== null) {
      const { count } = await db.user.updateMany({
        where: {
          id: userId,
          OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
        },
        data: { totpLastStep: step },
      });
      if (count === 1) return 'totp';
    }
    throw invalid('twoFactorCodeInvalid');
  }

  const { count } = await db.recoveryCode.updateMany({
    where: { userId, codeHash: hashToken(normalizeRecovery(input)), usedAt: null },
    data: { usedAt: now },
  });
  if (count === 1) return 'recovery';
  throw invalid('twoFactorCodeInvalid');
}

/** Turn it off: needs the password and a current code (or a recovery code). */
export async function disableTwoFactor(userId: string, password: string, code: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!(await verifyPassword(password, user.passwordHash))) throw invalid('currentPasswordWrong');
  await verifySecondFactor(userId, code);
  await clearTwoFactor(userId);
}

/** New recovery codes; the old ones stop working. Needs a current code. */
export async function regenerateRecoveryCodes(userId: string, code: string) {
  await verifySecondFactor(userId, code);
  return replaceRecoveryCodes(userId);
}

/** Support reset by a super admin, for someone who lost phone and codes. */
export async function clearTwoFactor(userId: string) {
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null },
    }),
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.loginChallenge.deleteMany({ where: { userId } }),
  ]);
}

// ── Login challenge ──────────────────────────────────────────────────────────

/** After a correct password: a pending login, identified by an opaque token. */
export async function createLoginChallenge(userId: string, redirectTo: string | null) {
  const token = generateToken();
  await db.$transaction([
    // One pending login per account; an older one stops working.
    db.loginChallenge.deleteMany({ where: { userId } }),
    db.loginChallenge.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        redirectTo,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    }),
  ]);
  return token;
}

/** The pending login behind a token, or null when it is unknown or expired. */
export async function findLoginChallenge(token: string) {
  const challenge = await db.loginChallenge.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, redirectTo: true, attempts: true, expiresAt: true },
  });
  if (!challenge || challenge.expiresAt.getTime() <= Date.now()) return null;
  return challenge;
}

/**
 * Check a code against a pending login. A wrong code spends one of
 * CHALLENGE_MAX_ATTEMPTS; after the last, the challenge is gone and the
 * password has to be entered again. On success the challenge is consumed.
 */
export async function completeLoginChallenge(token: string, code: string, now = new Date()) {
  const challenge = await findLoginChallenge(token);
  if (!challenge) throw invalid('twoFactorExpired');

  try {
    const method = await verifySecondFactor(challenge.userId, code, now);
    await db.loginChallenge.delete({ where: { id: challenge.id } });
    return { userId: challenge.userId, redirectTo: challenge.redirectTo, method };
  } catch (error) {
    const updated = await db.loginChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    if (updated.attempts >= CHALLENGE_MAX_ATTEMPTS) {
      await db.loginChallenge.delete({ where: { id: challenge.id } });
      throw invalid('twoFactorTooManyAttempts');
    }
    throw error;
  }
}

export async function purgeExpiredChallenges(): Promise<number> {
  const { count } = await db.loginChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
