import { z } from 'zod';
import {
  cuidSchema,
  durationSchema,
  handleSchema,
  latitudeSchema,
  longitudeSchema,
  minutesOfDaySchema,
  nameSchema,
  phoneSchema,
  priceSchema,
  richTextSchema,
  urlSchema,
} from './common';

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court.').max(120),
  tagline: richTextSchema(140).optional().or(z.literal('')),
  description: richTextSchema(2000).optional().or(z.literal('')),
  story: richTextSchema(2000).optional().or(z.literal('')),
  servedGender: z.enum(['WOMEN', 'MEN', 'EVERYONE']),
  phone: phoneSchema.optional().or(z.literal('')),
  whatsapp: phoneSchema.optional().or(z.literal('')),
  email: z.string().trim().email('E-mail invalide.').optional().or(z.literal('')),
  website: urlSchema.optional().or(z.literal('')),
  instagram: handleSchema.optional().or(z.literal('')),
  facebook: urlSchema.optional().or(z.literal('')),
  tiktok: handleSchema.optional().or(z.literal('')),
});

export const businessLocationSchema = z.object({
  cityId: cuidSchema.optional().or(z.literal('')),
  addressLine1: z.string().trim().min(3, 'Adresse requise.').max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal('')),
  postalCode: z.string().trim().max(10).optional().or(z.literal('')),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  directions: richTextSchema(500).optional().or(z.literal('')),
});

export const businessPolicySchema = z.object({
  autoConfirm: z.coerce.boolean().default(true),
  slotGranularityMinutes: z.coerce.number().int().min(5).max(120),
  minNoticeMinutes: z.coerce.number().int().min(0).max(20160),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  cancellationWindowHours: z.coerce.number().int().min(0).max(168),
  allowCustomerCancel: z.coerce.boolean().default(true),
  allowCustomerReschedule: z.coerce.boolean().default(true),
  cancellationPolicy: richTextSchema(600).optional().or(z.literal('')),
  noShowPolicy: richTextSchema(600).optional().or(z.literal('')),
  bookingNotice: richTextSchema(400).optional().or(z.literal('')),
});

export const serviceSchema = z.object({
  id: cuidSchema.optional(),
  name: z.string().trim().min(2, 'Nom trop court.').max(120),
  description: richTextSchema(800).optional().or(z.literal('')),
  categoryId: cuidSchema.optional().or(z.literal('')),
  priceAmount: priceSchema,
  durationMinutes: durationSchema,
  bufferMinutes: z.coerce.number().int().min(0).max(240).default(0),
  prepMinutes: z.coerce.number().int().min(0).max(240).default(0),
  minNoticeMinutes: z.coerce.number().int().min(0).max(20160).optional().or(z.literal('')),
  isActive: z.coerce.boolean().default(true),
  /** Repeated checkbox inputs arrive as a string or an array of strings. */
  staffIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
});

export const staffSchema = z.object({
  id: cuidSchema.optional(),
  displayName: nameSchema,
  title: z.string().trim().max(80).optional().or(z.literal('')),
  bio: richTextSchema(600).optional().or(z.literal('')),
  specialties: z.string().trim().max(300).optional().or(z.literal('')),
  isBookable: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
  serviceIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
});

/** One weekday's periods, posted as parallel arrays from the hours editor. */
export const hoursSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  starts: z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v : [v])),
  ends: z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v : [v])),
  staffMemberId: cuidSchema.optional().or(z.literal('')),
});

export const exceptionSchema = z.object({
  kind: z.enum(['CLOSED', 'HOLIDAY', 'VACATION', 'BREAK', 'SPECIAL_HOURS']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  startMin: minutesOfDaySchema.optional().or(z.literal('')),
  endMin: minutesOfDaySchema.optional().or(z.literal('')),
  reason: z.string().trim().max(200).optional().or(z.literal('')),
  staffMemberId: cuidSchema.optional().or(z.literal('')),
});
