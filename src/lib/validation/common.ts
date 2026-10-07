import { z } from 'zod';
import { v } from './keys';

/**
 * Shared field schemas. Defined once so the same rule applies to a server
 * action, an API route and a client form — validation can never drift between
 * the three.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, v('emailRequired'))
  .max(254)
  .email(v('emailInvalid'));

/**
 * Tunisian mobile and landline numbers: 8 digits, optionally with the +216
 * country code. Accepts the spacing people actually type.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.\-()]/g, ''))
  .refine((value) => /^(\+216)?[2-59]\d{7}$/.test(value), v('phoneInvalid'))
  .transform((value) => (value.startsWith('+216') ? value : `+216${value}`));

export const nameSchema = z
  .string()
  .trim()
  .min(2, v('minChars'))
  .max(80, v('tooLong'))
  // Latin and Arabic letters, apostrophes and hyphens — not digits or symbols.
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u, v('nameChars'));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, v('minChars'))
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, v('slugFormat'));

/** Prices are stored as DECIMAL(10,2); reject anything that cannot round-trip. */
export const priceSchema = z.coerce
  .number()
  .min(0, v('priceNegative'))
  .max(99_999_999, v('priceTooHigh'))
  .refine(
    (value) => Number.isFinite(value) && Math.round(value * 100) === value * 100,
    v('priceDecimals'),
  );

export const durationSchema = z.coerce
  .number()
  .int(v('durationWhole'))
  .min(5, v('durationMin'))
  .max(600, v('durationMax'));

export const minutesOfDaySchema = z.coerce.number().int().min(0).max(1440);

export const dayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, v('dateFormat'));

export const cuidSchema = z.string().min(1).max(64);

export const ratingSchema = z.coerce.number().int().min(1, v('ratingRequired')).max(5);

/** Free text that ends up on a public page. */
export const richTextSchema = (max: number) =>
  z.string().trim().max(max, v('maxChars'));

export const urlSchema = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === '' || /^https?:\/\/.+/.test(value), v('urlInvalid'));

/** A social handle, with or without the leading @. */
export const handleSchema = z
  .string()
  .trim()
  .max(60)
  .transform((value) => value.replace(/^@/, ''))
  .refine((value) => value === '' || /^[\w.]+$/.test(value), v('handleInvalid'));

export const localeSchema = z.enum(['fr', 'ar', 'en']);

export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);
