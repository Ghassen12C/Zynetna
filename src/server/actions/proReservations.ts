'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { notFound } from '@/lib/errors';
import { requireBusinessAccess } from '@/server/auth/guard';
import { recordAudit } from '@/server/audit';
import { transitionReservation } from '@/server/services/booking';
import { cuidSchema } from '@/lib/validation/common';
import type { FormState } from '@/lib/formState';
import { done, parseForm, toFormState } from './formState';

const TRANSITIONS = {
  confirm: 'CONFIRMED',
  complete: 'COMPLETED',
  cancel: 'CANCELLED_BY_BUSINESS',
  noShow: 'NO_SHOW',
} as const;

/**
 * Business-side reservation transitions.
 *
 * The reservation is located *within* the business the actor has access to, so
 * a reservation id belonging to another salon simply does not resolve.
 */
export async function transitionReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(
    z.object({
      businessId: cuidSchema,
      reservationId: cuidSchema,
      action: z.enum(['confirm', 'complete', 'cancel', 'noShow']),
      reason: z.string().trim().max(300).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const { actor, businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.reservation.write',
    );

    const reservation = await db.reservation.findFirst({
      where: { id: parsed.data.reservationId, businessId },
      select: { id: true },
    });
    if (!reservation) throw notFound('reservationNotFound');

    const to = TRANSITIONS[parsed.data.action];
    await transitionReservation({
      reservationId: reservation.id,
      to,
      actor,
      actorRole: 'BUSINESS_OWNER',
      reason: parsed.data.reason || undefined,
    });

    await recordAudit({
      actor,
      action:
        to === 'CONFIRMED'
          ? 'reservation.confirmed'
          : to === 'COMPLETED'
            ? 'reservation.completed'
            : to === 'NO_SHOW'
              ? 'reservation.no_show'
              : 'reservation.cancelled',
      targetType: 'Reservation',
      targetId: reservation.id,
      businessId,
    });

    revalidatePath('/pro/dashboard', 'layout');
    return { status: 'success', message: await done('reservationUpdated') };
  } catch (error) {
    return toFormState(error, 'transitionReservationAction');
  }
}

/** Private note on a reservation, visible only to the business. */
export async function saveInternalNoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(
    z.object({
      businessId: cuidSchema,
      reservationId: cuidSchema,
      internalNote: z.string().trim().max(1000).optional().or(z.literal('')),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const { businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.reservation.write',
    );

    const { count } = await db.reservation.updateMany({
      where: { id: parsed.data.reservationId, businessId },
      data: { internalNote: parsed.data.internalNote || null },
    });
    if (count === 0) throw notFound('reservationNotFound');

    revalidatePath('/pro/dashboard/reservations');
    return { status: 'success', message: await done('noteSaved') };
  } catch (error) {
    return toFormState(error, 'saveInternalNoteAction');
  }
}
