'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, forbidden, notFound } from '@/lib/errors';
import { requireActor, requireBusinessAccess } from '@/server/auth/guard';
import { consume } from '@/server/rateLimit';
import { recordAudit } from '@/server/audit';
import { notify } from '@/server/services/notifications';
import { canReview } from '@/domain/booking/policy';
import { cuidSchema, ratingSchema, richTextSchema } from '@/lib/validation/common';
import type { FormState } from '@/lib/formState';
import { parseForm, toFormState } from './formState';

/**
 * Reviews are verified by construction: a review row requires a reservation id,
 * that reservation must belong to the author, and it must be COMPLETED. The
 * unique index on reservationId makes a second review impossible.
 */
export async function submitReviewAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      reservationId: cuidSchema,
      rating: ratingSchema,
      comment: richTextSchema(1500).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    await consume('review', actor.userId);

    const reservation = await db.reservation.findUnique({
      where: { id: parsed.data.reservationId },
      select: {
        id: true,
        status: true,
        customerId: true,
        businessId: true,
        business: { select: { ownerId: true, name: true, slug: true } },
      },
    });
    if (!reservation) throw notFound('Rendez-vous introuvable.');

    const check = canReview(reservation, actor.userId);
    if (!check.allowed) throw new AppError('POLICY_VIOLATION', check.reason);

    const setting = await db.platformSetting.findUnique({
      where: { key: 'reviews.autoPublish' },
    });
    const autoPublish = setting?.value !== false;

    await db.$transaction(async (tx) => {
      await tx.review.create({
        data: {
          businessId: reservation.businessId,
          customerId: actor.userId,
          reservationId: reservation.id,
          rating: parsed.data.rating,
          comment: parsed.data.comment || null,
          status: autoPublish ? 'PUBLISHED' : 'PENDING_MODERATION',
        },
      });

      // Recompute the denormalised rating inside the same transaction, so the
      // profile average can never disagree with the reviews behind it.
      const stats = await tx.review.aggregate({
        where: { businessId: reservation.businessId, status: 'PUBLISHED' },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.business.update({
        where: { id: reservation.businessId },
        data: {
          ratingAverage: Math.round((stats._avg.rating ?? 0) * 10) / 10,
          ratingCount: stats._count.rating,
        },
      });
    });

    if (autoPublish) {
      await notify.reviewReceived(
        reservation.business.ownerId,
        reservation.business.name,
        parsed.data.rating,
      );
    }

    revalidatePath(`/business/${reservation.business.slug}`);
    revalidatePath('/account/reviews');
    return { status: 'success', message: 'Merci pour votre avis.' };
  } catch (error) {
    return toFormState(error, 'submitReviewAction');
  }
}

/** A business owner replies to a review on their own business. */
export async function respondToReviewAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({ reviewId: cuidSchema, body: richTextSchema(1000).min(2, 'Réponse trop courte.') }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const review = await db.review.findUnique({
      where: { id: parsed.data.reviewId },
      select: { id: true, businessId: true, business: { select: { slug: true } } },
    });
    if (!review) throw notFound('Avis introuvable.');

    // Tenant check: the actor must hold the permission in *this* business.
    const { actor } = await requireBusinessAccess(review.businessId, 'business.review.respond');

    await db.reviewResponse.upsert({
      where: { reviewId: review.id },
      create: {
        reviewId: review.id,
        businessId: review.businessId,
        authorId: actor.userId,
        body: parsed.data.body,
      },
      update: { body: parsed.data.body },
    });

    revalidatePath(`/business/${review.business.slug}`);
    revalidatePath('/pro/dashboard/reviews');
    return { status: 'success', message: 'Réponse publiée.' };
  } catch (error) {
    return toFormState(error, 'respondToReviewAction');
  }
}

export async function markNotificationsReadAction(): Promise<FormState> {
  try {
    const actor = await requireActor();
    await db.notification.updateMany({
      where: { userId: actor.userId, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath('/account/notifications');
    return { status: 'success' };
  } catch (error) {
    return toFormState(error, 'markNotificationsReadAction');
  }
}

/** Report a review or a business for moderation. */
export async function reportContentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(
    z.object({
      targetType: z.enum(['BUSINESS', 'REVIEW', 'MEDIA']),
      businessId: cuidSchema.optional(),
      reviewId: cuidSchema.optional(),
      reason: z.string().trim().min(3).max(120),
      details: richTextSchema(1000).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    await consume('contact', actor.userId);

    await db.contentReport.create({
      data: {
        targetType: parsed.data.targetType,
        businessId: parsed.data.businessId ?? null,
        reviewId: parsed.data.reviewId ?? null,
        reporterId: actor.userId,
        reason: parsed.data.reason,
        details: parsed.data.details || null,
      },
    });

    await recordAudit({
      actor,
      action: 'report.resolved',
      targetType: parsed.data.targetType,
      targetId: parsed.data.reviewId ?? parsed.data.businessId ?? null,
      metadata: { event: 'reported', reason: parsed.data.reason },
    });

    return { status: 'success', message: 'Signalement envoyé. Merci.' };
  } catch (error) {
    return toFormState(error, 'reportContentAction');
  }
}
