import { randomBytes } from 'node:crypto';

/**
 * Human-facing reservation code, e.g. ZY-7F3K2M.
 * Crockford-style alphabet: no I, L, O, U — so a code read aloud over the
 * phone in a Tunisian salon cannot be mistyped.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateReference(length = 6): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `ZY-${out}`;
}

export function isReference(value: string): boolean {
  return new RegExp(`^ZY-[${ALPHABET}]{6}$`).test(value);
}
