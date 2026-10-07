import { z } from 'zod';
import { passwordSchema } from '@/domain/identity/password';
import { emailSchema, localeSchema, nameSchema, phoneSchema } from './common';
import { v } from './keys';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, v('passwordRequired')),
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
    .refine((value) => value === 'on' || value === 'true' || value === true, v('acceptTerms')),
});

export const requestResetSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: v('passwordMismatch'),
    path: ['confirm'],
  });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, v('currentPasswordRequired')),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: v('passwordMismatch'),
    path: ['confirm'],
  });

export const updateProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  locale: localeSchema,
});
