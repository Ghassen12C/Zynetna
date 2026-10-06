'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { invalid } from '@/lib/errors';
import { requireActor } from '@/server/auth/guard';
import { recordAudit } from '@/server/audit';
import { startTrial } from '@/server/services/subscriptions';
import { consume } from '@/server/rateLimit';
import { cuidSchema } from '@/lib/validation/common';
import type { FormState } from '@/lib/formState';
import { parseForm, toFormState } from './formState';

/**
 * Create a business and enter onboarding.
 *
 * The free trial starts here, from the plan row — the "2 months" is data, not
 * a constant in this file.
 */
const createSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court.').max(120),
  categoryId: cuidSchema,
  cityId: cuidSchema.optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
});

/** URL-safe slug, de-accented, with a numeric suffix on collision. */
function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'etablissement';
  let candidate = root;
  for (let i = 2; i < 100; i += 1) {
    const taken = await db.business.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createBusinessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(createSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    await consume('register', actor.userId);

    // One business per owner for now; multi-location is a later plan feature.
    const existing = await db.roleAssignment.findFirst({
      where: { userId: actor.userId, role: 'BUSINESS_OWNER' },
      select: { businessId: true },
    });
    if (existing) throw invalid('Vous gérez déjà un établissement.');

    const category = await db.category.findUnique({
      where: { id: parsed.data.categoryId },
      select: { id: true },
    });
    if (!category) throw invalid('Choisissez une catégorie.');

    const slug = await uniqueSlug(parsed.data.name);

    const business = await db.business.create({
      data: {
        ownerId: actor.userId,
        slug,
        name: parsed.data.name,
        status: 'DRAFT',
        phone: parsed.data.phone || null,
        categories: { create: [{ categoryId: category.id, isPrimary: true }] },
        roleGrants: { create: { userId: actor.userId, role: 'BUSINESS_OWNER' } },
        // A sensible default week so a new owner is not staring at a blank
        // schedule: Monday–Saturday, 09:00–13:00 and 14:00–19:00.
        hours: {
          create: [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
            { weekday, startMin: 9 * 60, endMin: 13 * 60 },
            { weekday, startMin: 14 * 60, endMin: 19 * 60 },
          ]),
        },
        ...(parsed.data.cityId
          ? {
              location: {
                create: {
                  cityId: parsed.data.cityId,
                  addressLine1: '',
                  latitude: 36.8065,
                  longitude: 10.1815,
                },
              },
            }
          : {}),
      },
      select: { id: true, slug: true },
    });

    await startTrial(business.id);

    await recordAudit({
      actor,
      action: 'business.created',
      targetType: 'Business',
      targetId: business.id,
      businessId: business.id,
      metadata: { name: parsed.data.name },
    });
  } catch (error) {
    return toFormState(error, 'createBusinessAction');
  }

  redirect('/pro/dashboard/profile');
}
