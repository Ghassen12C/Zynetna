import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Argon2id — memory-hard, the current password-hashing recommendation.
 * Parameters are the OWASP baseline (19 MiB, 2 iterations, 1 lane).
 */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(plain: string, digest: string): Promise<boolean> {
  try {
    return await verify(digest, plain, OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Burn comparable CPU time when the email does not exist, so a wrong email and
 * a wrong password take the same time. Without this, response timing
 * enumerates accounts.
 */
export async function burnTime(plain: string): Promise<void> {
  try {
    await hash(plain, OPTIONS);
  } catch {
    /* the point is the elapsed time, not the result */
  }
}

/** Opaque, high-entropy token for sessions and email links. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Tokens are stored hashed. A database leak therefore does not hand over
 * usable sessions or password-reset links.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
