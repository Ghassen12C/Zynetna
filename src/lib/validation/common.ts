import { z } from 'zod';

/**
 * Shared field schemas. Defined once so the same rule applies to a server
 * action, an API route and a client form — validation can never drift between
 * the three.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'E-mail requis.')
  .max(254)
  .email('Adresse e-mail invalide.');

/**
 * Tunisian mobile and landline numbers: 8 digits, optionally with the +216
 * country code. Accepts the spacing people actually type.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.\-()]/g, ''))
  .refine(
    (v) => /^(\+216)?[2-59]\d{7}$/.test(v),
    'Numéro tunisien invalide (8 chiffres, ex. 20 123 456).',
  )
  .transform((v) => (v.startsWith('+216') ? v : `+216${v}`));

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Au moins 2 caractères.')
  .max(80, 'Trop long.')
  // Latin and Arabic letters, apostrophes and hyphens — not digits or symbols.
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u, 'Caractères non autorisés.');

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Au moins 3 caractères.')
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lettres minuscules, chiffres et tirets.');

/** Prices are stored as DECIMAL(10,2); reject anything that cannot round-trip. */
export const priceSchema = z.coerce
  .number()
  .min(0, 'Le prix ne peut pas être négatif.')
  .max(99_999_999, 'Prix trop élevé.')
  .refine((v) => Number.isFinite(v) && Math.round(v * 100) === v * 100, 'Deux décimales maximum.');

export const durationSchema = z.coerce
  .number()
  .int('Durée en minutes entières.')
  .min(5, 'Au moins 5 minutes.')
  .max(600, '10 heures maximum.');

export const minutesOfDaySchema = z.coerce.number().int().min(0).max(1440);

export const dayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).');

export const cuidSchema = z.string().min(1).max(64);

export const ratingSchema = z.coerce.number().int().min(1, 'Note requise.').max(5);

/** Free text that ends up on a public page. */
export const richTextSchema = (max: number) =>
  z.string().trim().max(max, `${max} caractères maximum.`);

export const urlSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === '' || /^https?:\/\/.+/.test(v),
    'Adresse web invalide (commence par https://).',
  );

/** A social handle, with or without the leading @. */
export const handleSchema = z
  .string()
  .trim()
  .max(60)
  .transform((v) => v.replace(/^@/, ''))
  .refine((v) => v === '' || /^[\w.]+$/.test(v), 'Identifiant invalide.');

export const localeSchema = z.enum(['fr', 'ar', 'en']);

export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);
