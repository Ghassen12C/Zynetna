'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AppError, localizeError, notFound } from '@/lib/errors';
import { getActor } from '@/server/auth/session';
import { requireActor } from '@/server/auth/guard';
import { consume } from '@/server/rateLimit';
import { recordAudit } from '@/server/audit';
import {
  cancelAsCustomer,
  createReservation,
  rescheduleAsCustomer,
} from '@/server/services/booking';
import { getDayAvailability } from '@/server/services/availability';
import { cuidSchema, dayKeySchema } from '@/lib/validation/common';
import type { FormState } from '@/lib/formState';
import { done, parseForm, toFormState } from './formState';
import { getLocale } from '@/i18n/server';
import { messagesFor } from '@/i18n';

const createSchema = z.object({
  businessId: cuidSchema,
  serviceId: cuidSchema,
  staffMemberId: cuidSchema,
  /** ISO instant of the chosen slot, as returned by the availability API. */
  startAt: z.string().datetime(),
  customerNote: z.string().trim().max(500).optional().or(z.literal('')),
});

export type BookingResult = { reference: string };

export async function createReservationAction(
  _prev: FormState<BookingResult>,
  formData: FormData,
): Promise<FormState<BookingResult>> {
  const parsed = await parseForm(createSchema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

    // Limit by account and by address: neither one person nor one network can
    // flood a business's calendar.
    await consume('booking', actor.userId);
    await consume('booking', ip);

    const reservation = await createReservation({
      businessId: parsed.data.businessId,
      serviceId: parsed.data.serviceId,
      staffMemberId: parsed.data.staffMemberId,
      startAt: new Date(parsed.data.startAt),
      customerId: actor.userId,
      customerNote: parsed.data.customerNote || null,
    });

    await recordAudit({
      actor,
      action: 'reservation.created',
      targetType: 'Reservation',
      targetId: reservation.id,
      businessId: parsed.data.businessId,
      ipAddress: ip,
    });

    revalidatePath('/account');
    return { status: 'success', data: { reference: reservation.reference } };
  } catch (error) {
    return toFormState(error, 'createReservationAction');
  }
}

export async function cancelReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = await parseForm(
    z.object({ reservationId: cuidSchema, reason: z.string().trim().max(300).optional() }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    await cancelAsCustomer(parsed.data.reservationId, actor, parsed.data.reason);
    await recordAudit({
      actor,
      action: 'reservation.cancelled',
      targetType: 'Reservation',
      targetId: parsed.data.reservationId,
    });

    revalidatePath('/account');
    return { status: 'success', message: await done('appointmentCancelled') };
  } catch (error) {
    return toFormState(error, 'cancelReservationAction');
  }
}

export async function rescheduleReservationAction(
  _prev: FormState<BookingResult>,
  formData: FormData,
): Promise<FormState<BookingResult>> {
  const parsed = await parseForm(
    z.object({
      reservationId: cuidSchema,
      startAt: z.string().datetime(),
      staffMemberId: cuidSchema.optional(),
    }),
    formData,
  );
  if (!parsed.ok) return parsed.state;

  try {
    const actor = await requireActor();
    const replacement = await rescheduleAsCustomer({
      reservationId: parsed.data.reservationId,
      actor,
      startAt: new Date(parsed.data.startAt),
      staffMemberId: parsed.data.staffMemberId,
    });

    await recordAudit({
      actor,
      action: 'reservation.rescheduled',
      targetType: 'Reservation',
      targetId: parsed.data.reservationId,
      metadata: { replacement: replacement.reference },
    });

    revalidatePath('/account');
    return { status: 'success', data: { reference: replacement.reference } };
  } catch (error) {
    return toFormState(error, 'rescheduleReservationAction');
  }
}

/**
 * Availability for the booking UI.
 *
 * Exposed as a server action so the picker can refetch after a conflict
 * without a round-trip through a separate API client. The computation itself
 * is always server-side.
 */
export async function fetchAvailabilityAction(input: {
  businessId: string;
  serviceId: string;
  staffMemberId?: string | null;
  day: string;
}): Promise<
  | { ok: true; slots: { time: string; startAt: string; staffMemberIds: string[] }[]; closedReason?: string }
  | { ok: false; message: string }
> {
  try {
    const query = z
      .object({
        businessId: cuidSchema,
        serviceId: cuidSchema,
        staffMemberId: cuidSchema.nullish(),
        day: dayKeySchema,
      })
      .parse(input);

    const availability = await getDayAvailability({
      businessId: query.businessId,
      serviceId: query.serviceId,
      staffMemberId: query.staffMemberId ?? null,
      day: query.day,
    });

    return {
      ok: true,
      slots: availability.slots.map((s) => ({
        time: s.time,
        startAt: s.startAt.toISOString(),
        staffMemberIds: s.staffMemberIds,
      })),
      closedReason: availability.closedReason,
    };
  } catch (error) {
    const locale = await getLocale();
    const m = messagesFor(locale);
    if (error instanceof AppError && error.expose) {
      return { ok: false, message: localizeError(error, m, locale) };
    }
    return { ok: false, message: m.feedback.errors.availabilityFailed };
  }
}

/** The reservation shown on the confirmation page. */
export async function getReservationByReference(reference: string) {
  const reservation = await db.reservation.findUnique({
    where: { reference },
    include: {
      business: {
        include: { location: { include: { city: true } } },
      },
      staffMember: { select: { displayName: true } },
      items: true,
    },
  });
  if (!reservation) throw notFound('reservationNotFound');

  // A reservation is readable by its customer, by the business, or by an admin —
  // never by a stranger who guessed a reference.
  const actor = await getActor();
  const isOwner = actor && reservation.customerId === actor.userId;
  const isBusiness = actor && Boolean(actor.businessRoles[reservation.businessId]);
  const isAdmin = actor?.globalRoles.includes('SUPER_ADMIN');
  if (!isOwner && !isBusiness && !isAdmin) throw notFound('reservationNotFound');

  return reservation;
}
