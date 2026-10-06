import { z } from 'zod';
import { passwordSchema } from '@/domain/identity/password';
import { emailSchema, localeSchema, nameSchema, phoneSchema } from './common';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis.'),
  redirectTo: z.string().optional(),
});

export const registerSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  password: passwordSchema,
  locale: localeSchema.default('fr'),
  acceptTerms: z
    .union([z.literal('on'), z.literal('true'), z.boolean()])
    .refine((v) => v === 'on' || v === 'true' || v === true, 'Vous devez accepter les conditions.'),
});

export const requestResetSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirm'],
  });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'Mot de passe actuel requis.'),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirm'],
  });

export const updateProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  locale: localeSchema,
});
