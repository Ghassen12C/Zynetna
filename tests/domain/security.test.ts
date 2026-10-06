import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, passwordSchema, strengthOf } from '@/domain/identity/password';
import { generateReference, isReference } from '@/domain/booking/reference';
import {
  emailSchema,
  phoneSchema,
  priceSchema,
  slugSchema,
  urlSchema,
} from '@/lib/validation/common';

describe('password policy', () => {
  it('rejects short, common and letters-only passwords', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('password').success).toBe(false);
    expect(passwordSchema.safeParse('motdepasse').success).toBe(false);
    // Long enough, but no digit or symbol.
    expect(passwordSchema.safeParse('abcdefghijkl').success).toBe(false);
  });

  it('accepts a long passphrase with a digit or symbol', () => {
    expect(passwordSchema.safeParse('Zynetna2026!').success).toBe(true);
    expect(passwordSchema.safeParse('mon salon a tunis 2026').success).toBe(true);
  });

  it('accepts Arabic characters', () => {
    expect(passwordSchema.safeParse('كلمةالسرالطويلة2026').success).toBe(true);
  });

  it('rates strength monotonically, as an advisory meter', () => {
    // The meter never gates acceptance; it only has to rank sensibly, so the
    // test asserts the ordering rather than brittle exact labels.
    const RANK = { weak: 0, fair: 1, good: 2, strong: 3 } as const;
    const ladder = [
      'password',          // common
      'abcdefghij1',       // long enough, one character class plus a digit
      'Abcdefghij1',       // adds case variety
      'Abcdefghij1!',      // adds a symbol
      'Abcdefghijklmn1!',  // and real length
    ];

    for (let i = 1; i < ladder.length; i += 1) {
      expect(RANK[strengthOf(ladder[i]!)]).toBeGreaterThanOrEqual(
        RANK[strengthOf(ladder[i - 1]!)],
      );
    }

    expect(strengthOf('password')).toBe('weak');
    expect(strengthOf('Abcdefghijklmn1!')).toBe('strong');
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(10);
  });
});

describe('reservation references', () => {
  it('produces readable codes without ambiguous letters', () => {
    for (let i = 0; i < 200; i += 1) {
      const reference = generateReference();
      expect(isReference(reference)).toBe(true);
      // I, L, O and U are excluded so a code read aloud is not mistyped.
      expect(reference.slice(3)).not.toMatch(/[ILOU]/);
    }
  });

  it('does not collide across a large sample', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => generateReference()));
    // 32^6 ≈ 10^9 possibilities; a handful of collisions in 5000 would be a red flag.
    expect(seen.size).toBeGreaterThan(4990);
  });
});

describe('input validation', () => {
  it('normalises and validates email', () => {
    expect(emailSchema.parse('  Ahmed@Example.TN ')).toBe('ahmed@example.tn');
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('accepts Tunisian phone numbers in the shapes people type', () => {
    expect(phoneSchema.parse('20 123 456')).toBe('+21620123456');
    expect(phoneSchema.parse('+216 20 123 456')).toBe('+21620123456');
    expect(phoneSchema.parse('98.765.432')).toBe('+21698765432');
    expect(phoneSchema.safeParse('12345').success).toBe(false);
    // Tunisian mobile and landline prefixes are 2–5 and 9.
    expect(phoneSchema.safeParse('10123456').success).toBe(false);
  });

  it('rejects prices that cannot round-trip through DECIMAL(10,2)', () => {
    expect(priceSchema.safeParse(30).success).toBe(true);
    expect(priceSchema.safeParse(29.99).success).toBe(true);
    expect(priceSchema.safeParse(29.999).success).toBe(false);
    expect(priceSchema.safeParse(-1).success).toBe(false);
  });

  it('constrains slugs to URL-safe shapes', () => {
    expect(slugSchema.parse('Barber-El-Medina')).toBe('barber-el-medina');
    expect(slugSchema.safeParse('has spaces').success).toBe(false);
    expect(slugSchema.safeParse('-leading').success).toBe(false);
    expect(slugSchema.safeParse('accentué').success).toBe(false);
  });

  it('refuses a javascript: URL', () => {
    expect(urlSchema.safeParse('https://example.tn').success).toBe(true);
    expect(urlSchema.safeParse('').success).toBe(true);
    // eslint-disable-next-line no-script-url
    expect(urlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(urlSchema.safeParse('data:text/html,<script>').success).toBe(false);
  });
});
