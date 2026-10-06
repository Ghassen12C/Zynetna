'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { invalid, notFound } from '@/lib/errors';
import { requireSuperAdmin } from '@/server/auth/guard';
import { revokeAllSessions } from '@/server/auth/session';
import { recordAudit } from '@/server/audit';
import { notify } from '@/server/services/notifications';
import { recordPayment } from '@/server/services/subscriptions';
import { cuidSchema, priceSchema, richTextSchema, slugSchema } from '@/lib/validation/common';
import type { FormState } from '@/lib/formState';
import { parseForm, toFormState } from './formState';

/**
 * Platform administration.
 *
 * Every action requires SUPER_ADMIN and writes an audit row, so the question
 * "who did what, when, to which object" always has an answer.
 */

function refreshAdmin() {
  revalidatePath('/admin', 'layout');
  revalidatePath('/search');
}

export async function moderateBusinessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      businessId: cuidSchema,
      decision: z.enum(['approve', 'reject', 'verify', 'unverify', 'suspend', 'reactivate']),
      note: richTextSchema(500).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();

    const business = await db.business.findUnique({
      where: { id: parsed.data.businessId },
      select: { id: true, name: true, slug: true, ownerId: true, status: true },
    });
    if (!business) throw notFound('Établissement introuvable.');

    const now = new Date();
    const data: Record<string, unknown> = {};
    let auditAction:
      | 'business.approved' | 'business.rejected' | 'business.verified'
      | 'business.suspended' | 'business.reactivated' = 'business.approved';
    let outcome: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | null = null;

    switch (parsed.data.decision) {
      case 'approve':
        data.status = 'ACTIVE';
        data.publishedAt = now;
        data.suspendedAt = null;
        data.suspendedReason = null;
        auditAction = 'business.approved';
        outcome = 'APPROVED';
        break;
      case 'reject':
        if (!parsed.data.note) throw invalid('Indiquez le motif du refus.');
        data.status = 'REJECTED';
        data.verification = 'REJECTED';
        auditAction = 'business.rejected';
        outcome = 'REJECTED';
        break;
      case 'verify':
        data.verification = 'VERIFIED';
        auditAction = 'business.verified';
        break;
      case 'unverify':
        data.verification = 'UNVERIFIED';
        auditAction = 'business.verified';
        break;
      case 'suspend':
        if (!parsed.data.note) throw invalid('Indiquez le motif de la suspension.');
        data.status = 'SUSPENDED';
        data.suspendedAt = now;
        data.suspendedReason = parsed.data.note;
        auditAction = 'business.suspended';
        outcome = 'SUSPENDED';
        break;
      case 'reactivate':
        data.status = 'ACTIVE';
        data.suspendedAt = null;
        data.suspendedReason = null;
        auditAction = 'business.reactivated';
        break;
    }

    await db.business.update({ where: { id: business.id }, data });

    await recordAudit({
      actor,
      action: auditAction,
      targetType: 'Business',
      targetId: business.id,
      businessId: business.id,
      metadata: { decision: parsed.data.decision, note: parsed.data.note || null },
    });

    if (outcome) {
      await notify.businessModerated(
        business.ownerId,
        business.name,
        outcome,
        parsed.data.note || undefined,
      );
    }

    refreshAdmin();
    revalidatePath(`/business/${business.slug}`);
    return { status: 'success', message: 'Établissement mis à jour.' };
  } catch (error) {
    return toFormState(error, 'moderateBusinessAction');
  }
}

export async function moderateUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      userId: cuidSchema,
      decision: z.enum(['suspend', 'reactivate', 'grantAdmin', 'revokeAdmin']),
      note: richTextSchema(500).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();

    // An admin must not be able to lock themselves out, or demote the last one.
    if (parsed.data.userId === actor.userId) {
      throw invalid('Vous ne pouvez pas modifier votre propre compte ici.');
    }

    const user = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, status: true },
    });
    if (!user) throw notFound('Utilisateur introuvable.');

    if (parsed.data.decision === 'suspend') {
      await db.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
      // Suspension takes effect immediately, not at next login.
      await revokeAllSessions(user.id);
      await recordAudit({
        actor, action: 'user.suspended', targetType: 'User',
        targetId: user.id, metadata: { note: parsed.data.note || null },
      });
    } else if (parsed.data.decision === 'reactivate') {
      await db.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
      await recordAudit({ actor, action: 'user.reactivated', targetType: 'User', targetId: user.id });
    } else if (parsed.data.decision === 'grantAdmin') {
      // The @@unique on (userId, role, businessId) does NOT dedupe platform
      // roles: businessId is NULL there, and Postgres treats NULLs as
      // distinct. A partial unique index covers it at the database level; this
      // check keeps the action idempotent.
      const existingGrant = await db.roleAssignment.findFirst({
        where: { userId: user.id, role: 'SUPER_ADMIN', businessId: null },
        select: { id: true },
      });
      if (!existingGrant) {
        await db.roleAssignment.create({ data: { userId: user.id, role: 'SUPER_ADMIN' } });
      }
      await recordAudit({
        actor, action: 'user.role_granted', targetType: 'User',
        targetId: user.id, metadata: { role: 'SUPER_ADMIN' },
      });
    } else {
      const adminCount = await db.roleAssignment.count({
        where: { role: 'SUPER_ADMIN', businessId: null },
      });
      if (adminCount <= 1) throw invalid('Il doit rester au moins un administrateur.');

      await db.roleAssignment.deleteMany({
        where: { userId: user.id, role: 'SUPER_ADMIN', businessId: null },
      });
      await recordAudit({
        actor, action: 'user.role_revoked', targetType: 'User',
        targetId: user.id, metadata: { role: 'SUPER_ADMIN' },
      });
    }

    refreshAdmin();
    return { status: 'success', message: 'Utilisateur mis à jour.' };
  } catch (error) {
    return toFormState(error, 'moderateUserAction');
  }
}

export async function moderateReviewAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      reviewId: cuidSchema,
      decision: z.enum(['publish', 'hide', 'remove']),
      note: richTextSchema(400).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();

    const review = await db.review.findUnique({
      where: { id: parsed.data.reviewId },
      select: { id: true, businessId: true, business: { select: { slug: true } } },
    });
    if (!review) throw notFound('Avis introuvable.');

    const status =
      parsed.data.decision === 'publish'
        ? 'PUBLISHED'
        : parsed.data.decision === 'hide'
          ? 'HIDDEN'
          : 'REMOVED';

    await db.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: review.id },
        data: { status, moderatedAt: new Date(), moderationNote: parsed.data.note || null },
      });

      // Moderation changes what is published, so the business rating must be
      // recomputed in the same transaction.
      const stats = await tx.review.aggregate({
        where: { businessId: review.businessId, status: 'PUBLISHED' },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.business.update({
        where: { id: review.businessId },
        data: {
          ratingAverage: Math.round((stats._avg.rating ?? 0) * 10) / 10,
          ratingCount: stats._count.rating,
        },
      });
    });

    await recordAudit({
      actor, action: 'review.moderated', targetType: 'Review',
      targetId: review.id, businessId: review.businessId,
      metadata: { decision: parsed.data.decision, note: parsed.data.note || null },
    });

    refreshAdmin();
    revalidatePath(`/business/${review.business.slug}`);
    return { status: 'success', message: 'Avis modéré.' };
  } catch (error) {
    return toFormState(error, 'moderateReviewAction');
  }
}

export async function resolveReportAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      reportId: cuidSchema,
      status: z.enum(['REVIEWING', 'RESOLVED', 'DISMISSED']),
      resolution: richTextSchema(500).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();

    await db.contentReport.update({
      where: { id: parsed.data.reportId },
      data: {
        status: parsed.data.status,
        resolution: parsed.data.resolution || null,
        resolvedAt: parsed.data.status === 'REVIEWING' ? null : new Date(),
      },
    });

    await recordAudit({
      actor, action: 'report.resolved', targetType: 'ContentReport',
      targetId: parsed.data.reportId, metadata: { status: parsed.data.status },
    });

    refreshAdmin();
    return { status: 'success', message: 'Signalement traité.' };
  } catch (error) {
    return toFormState(error, 'resolveReportAction');
  }
}

// ── Categories ────────────────────────────────────────────────────────────

export async function saveCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      id: cuidSchema.optional().or(z.literal('')),
      parentId: cuidSchema.optional().or(z.literal('')),
      slug: slugSchema,
      name: z.string().trim().min(2).max(80),
      nameAr: z.string().trim().min(1).max(80),
      nameEn: z.string().trim().min(2).max(80),
      icon: z.string().trim().max(8).optional().or(z.literal('')),
      servedGender: z.enum(['WOMEN', 'MEN', 'EVERYONE']),
      position: z.coerce.number().int().min(0).max(999).default(0),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();
    const data = parsed.data;

    // A category cannot be its own parent, nor nest more than two levels.
    if (data.id && data.parentId === data.id) {
      throw invalid('Une catégorie ne peut pas être sa propre parente.');
    }
    if (data.parentId) {
      const parent = await db.category.findUnique({
        where: { id: data.parentId },
        select: { parentId: true },
      });
      if (!parent) throw invalid('Catégorie parente introuvable.');
      if (parent.parentId) throw invalid('Deux niveaux de catégories au maximum.');
    }

    const payload = {
      parentId: data.parentId || null,
      slug: data.slug,
      name: data.name,
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      icon: data.icon || null,
      servedGender: data.servedGender,
      position: data.position,
    };

    if (data.id) {
      await db.category.update({ where: { id: data.id }, data: payload });
      await recordAudit({ actor, action: 'category.updated', targetType: 'Category', targetId: data.id });
    } else {
      const created = await db.category.create({ data: payload, select: { id: true } });
      await recordAudit({ actor, action: 'category.created', targetType: 'Category', targetId: created.id });
    }

    refreshAdmin();
    revalidatePath('/');
    return { status: 'success', message: 'Catégorie enregistrée.' };
  } catch (error) {
    return toFormState(error, 'saveCategoryAction');
  }
}

export async function toggleCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({ categoryId: cuidSchema, isActive: z.enum(['true', 'false']) }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();
    await db.category.update({
      where: { id: parsed.data.categoryId },
      data: { isActive: parsed.data.isActive === 'true' },
    });
    await recordAudit({
      actor, action: 'category.updated', targetType: 'Category',
      targetId: parsed.data.categoryId, metadata: { isActive: parsed.data.isActive },
    });
    refreshAdmin();
    return { status: 'success' };
  } catch (error) {
    return toFormState(error, 'toggleCategoryAction');
  }
}

// ── Subscriptions and payments ────────────────────────────────────────────

export async function recordPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      businessId: cuidSchema,
      amount: priceSchema,
      providerRef: z.string().trim().max(120).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();

    await recordPayment({
      businessId: parsed.data.businessId,
      amount: parsed.data.amount,
      provider: 'manual',
      providerRef: parsed.data.providerRef || null,
      recordedById: actor.userId,
    });

    await recordAudit({
      actor, action: 'payment.recorded', targetType: 'Subscription',
      businessId: parsed.data.businessId, metadata: { amount: parsed.data.amount },
    });

    refreshAdmin();
    return { status: 'success', message: 'Paiement enregistré, abonnement réactivé.' };
  } catch (error) {
    return toFormState(error, 'recordPaymentAction');
  }
}

export async function savePlanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      id: cuidSchema.optional().or(z.literal('')),
      code: slugSchema,
      name: z.string().trim().min(2).max(80),
      description: richTextSchema(400).optional().or(z.literal('')),
      priceAmount: priceSchema,
      currency: z.string().trim().length(3).default('TND'),
      interval: z.enum(['MONTH', 'YEAR']),
      trialDays: z.coerce.number().int().min(0).max(730),
      gracePeriodDays: z.coerce.number().int().min(0).max(90),
      isActive: z.coerce.boolean().default(true),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();
    // An unchecked checkbox is simply absent from FormData.
    const isActive = formData.has('isActive');

    const payload = {
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      priceAmount: parsed.data.priceAmount,
      currency: parsed.data.currency.toUpperCase(),
      interval: parsed.data.interval,
      trialDays: parsed.data.trialDays,
      gracePeriodDays: parsed.data.gracePeriodDays,
      isActive,
    };

    if (parsed.data.id) {
      await db.subscriptionPlan.update({ where: { id: parsed.data.id }, data: payload });
    } else {
      await db.subscriptionPlan.create({ data: payload });
    }

    await recordAudit({
      actor, action: 'subscription.plan_updated', targetType: 'SubscriptionPlan',
      targetId: parsed.data.id || null, metadata: { code: parsed.data.code },
    });

    refreshAdmin();
    revalidatePath('/pro');
    return { status: 'success', message: 'Formule enregistrée.' };
  } catch (error) {
    return toFormState(error, 'savePlanAction');
  }
}

// ── Platform settings and flags ───────────────────────────────────────────

export async function updateSettingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({ key: z.string().trim().min(1).max(120), value: z.string().max(2000) }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();

    // Settings are JSON; accept a JSON literal, fall back to a string.
    let value: unknown;
    try {
      value = JSON.parse(parsed.data.value);
    } catch {
      value = parsed.data.value;
    }

    await db.platformSetting.upsert({
      where: { key: parsed.data.key },
      create: { key: parsed.data.key, value: value as object, updatedById: actor.userId },
      update: { value: value as object, updatedById: actor.userId },
    });

    await recordAudit({
      actor, action: 'setting.updated', targetType: 'PlatformSetting',
      targetId: parsed.data.key, metadata: { value },
    });

    refreshAdmin();
    return { status: 'success', message: 'Réglage enregistré.' };
  } catch (error) {
    return toFormState(error, 'updateSettingAction');
  }
}

export async function updateFlagAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      key: z.string().trim().min(1).max(120),
      isEnabled: z.enum(['true', 'false']),
      rolloutPct: z.coerce.number().int().min(0).max(100).default(100),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireSuperAdmin();

    await db.featureFlag.upsert({
      where: { key: parsed.data.key },
      create: {
        key: parsed.data.key,
        isEnabled: parsed.data.isEnabled === 'true',
        rolloutPct: parsed.data.rolloutPct,
      },
      update: {
        isEnabled: parsed.data.isEnabled === 'true',
        rolloutPct: parsed.data.rolloutPct,
      },
    });

    await recordAudit({
      actor, action: 'flag.updated', targetType: 'FeatureFlag',
      targetId: parsed.data.key, metadata: { isEnabled: parsed.data.isEnabled },
    });

    refreshAdmin();
    return { status: 'success', message: 'Fonctionnalité mise à jour.' };
  } catch (error) {
    return toFormState(error, 'updateFlagAction');
  }
}
