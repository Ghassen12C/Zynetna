import { z } from 'zod';

/**
 * Password policy. Deliberately length-first rather than symbol-soup: a long
 * passphrase beats `P@ss1!` and a Tunisian salon owner on a phone keyboard
 * will actually use it.
 */
export const MIN_PASSWORD_LENGTH = 10;

const COMMON = new Set([
  'password', 'motdepasse', '1234567890', 'azertyuiop', 'qwertyuiop',
  'password123', 'motdepasse1', '0000000000', 'zynetna123', 'administrator',
]);

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(200, 'That password is too long.')
  .refine((v) => !COMMON.has(v.toLowerCase()), 'That password is too common.')
  .refine(
    (v) => /[a-zA-Z؀-ۿ]/.test(v) && /[0-9\W_]/.test(v),
    'Mix letters with at least one number or symbol.',
  );

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

/** Advisory meter for the UI; never used to accept or reject on its own. */
export function strengthOf(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[\W_]/.test(password)) score += 1;
  if (COMMON.has(password.toLowerCase())) return 'weak';
  if (score <= 2) return 'weak';
  if (score === 3) return 'fair';
  if (score === 4) return 'good';
  return 'strong';
}
