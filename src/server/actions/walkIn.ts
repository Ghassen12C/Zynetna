'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { invalid, notFound } from '@/lib/errors';
import { requireBusinessAccess } from '@/server/auth/guard';
import { recordAudit } from '@/server/audit';
import { createReservation } from '@/server/services/booking';
import { getDayAvailability } from '@/server/services/availability';
import { cuidSchema, dayKeySchema, nameSchema, phoneSchema } from '@/lib/validation/common';
import type { FormState } from '@/lib/formState';
import { parseForm, toFormState } from './formState';

/**
 * Walk-in and telephone bookings.
 *
 * Most appointments in a Tunisian salon still arrive by phone or through the
 * door. If the professional cannot record those, the calendar diverges from
 * reality and the availability engine offers slots that are already taken —
 * which is how a booking platform starts double-booking people in practice.
 *
 * These go through exactly the same `createReservation` path as an online
 * booking, so they get the same slot validation, the same transaction and the
 * same exclusion constraint. The only differences are the channel and the fact
 * that the customer may not have an account.
 */
const schema = z
  .object({
    businessId: cuidSchema,
    serviceId: cuidSchema,
    staffMemberId: cuidSchema,
    startAt: z.string().datetime(),
    channel: z.enum(['WALK_IN', 'PHONE']),
    /** An existing customer, chosen from the business's own list. */
    customerId: cuidSchema.optional().or(z.literal('')),
    /** Or someone with no account: name and a way to reach them. */
    guestName: nameSchema.optional().or(z.literal('')),
    guestPhone: phoneSchema.optional().or(z.literal('')),
    internalNote: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((v) => Boolean(v.customerId) || Boolean(v.guestName), {
    message: 'Indiquez un client existant ou le nom de la personne.',
    path: ['guestName'],
  });

export async function createWalkInAction(
  _prev: FormState<{ reference: string }>,
  formData: FormData,
): Promise<FormState<{ reference: string }>> {
  const parsed = parseForm(schema, formData);
  if (!parsed.ok) return parsed.state;

  try {
    const { actor, businessId } = await requireBusinessAccess(
      parsed.data.businessId,
      'business.reservation.write',
    );

    // A customer id is only accepted if that person has actually booked with
    // this business before — the staff cannot attach an arbitrary account.
    let customerId: string | null = null;
    if (parsed.data.customerId) {
      const known = await db.reservation.findFirst({
        where: { businessId, customerId: parsed.data.customerId },
        select: { customerId: true },
      });
      if (!known) throw invalid('Ce client n’a pas encore de rendez-vous chez vous.');
      customerId = parsed.data.customerId;
    }

    const reservation = await createReservation({
      businessId,
      serviceId: parsed.data.serviceId,
      staffMemberId: parsed.data.staffMemberId,
      startAt: new Date(parsed.data.startAt),
      channel: parsed.data.channel,
      atCounter: true,
      customerId,
      // Guest details are kept even when a known customer is attached: the
      // person at the counter may not be the account holder.
      guestName: customerId ? null : parsed.data.guestName || null,
      guestPhone: customerId ? null : parsed.data.guestPhone || null,
    });

    if (parsed.data.internalNote) {
      await db.reservation.update({
        where: { id: reservation.id },
        data: { internalNote: parsed.data.internalNote },
      });
    }

    await recordAudit({
      actor,
      action: 'reservation.created',
      targetType: 'Reservation',
      targetId: reservation.id,
      businessId,
      metadata: { channel: parsed.data.channel },
    });

    revalidatePath('/pro/dashboard', 'layout');
    return { status: 'success', data: { reference: reservation.reference } };
  } catch (error) {
    return toFormState(error, 'createWalkInAction');
  }
}

/**
 * Availability for the counter form. Identical computation to the customer
 * side — the professional sees the same truth their customers see.
 */
export async function proAvailabilityAction(input: {
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

    await requireBusinessAccess(query.businessId, 'business.reservation.read');

    const availability = await getDayAvailability({
      businessId: query.businessId,
      serviceId: query.serviceId,
      staffMemberId: query.staffMemberId ?? null,
      day: query.day,
      // The counter is allowed to book right now: the minimum-notice rule
      // protects staff from last-minute ONLINE bookings, not from the person
      // standing in front of them. Same flag the create path uses, so what is
      // offered here is exactly what will be accepted.
      ignoreMinNotice: true,
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
  } catch {
    return { ok: false, message: 'Impossible de charger les disponibilités.' };
  }
}

/** Type-ahead over the business's own customers. */
export async function searchBusinessCustomersAction(input: {
  businessId: string;
  query: string;
}): Promise<{ id: string; name: string; phone: string | null }[]> {
  try {
    const { businessId } = await requireBusinessAccess(
      input.businessId,
      'business.customer.read',
    );
    const term = input.query.trim();
    if (term.length < 2) return [];

    // Scoped to people who have booked here — never a platform-wide user search.
    const rows = await db.user.findMany({
      where: {
        reservations: { some: { businessId } },
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, phone: true },
      take: 8,
    });

    return rows.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      phone: u.phone,
    }));
  } catch {
    return [];
  }
}

/** The minimum a professional needs to not leave the counter. */
export async function walkInOptionsAction(businessId: string) {
  const { businessId: id } = await requireBusinessAccess(
    businessId,
    'business.reservation.read',
  );

  const [services, staff, business] = await Promise.all([
    db.service.findMany({
      where: { businessId: id, isActive: true },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        priceAmount: true,
        durationMinutes: true,
        staff: { select: { staffMemberId: true } },
      },
    }),
    db.staffMember.findMany({
      where: { businessId: id, isActive: true, isBookable: true },
      orderBy: { position: 'asc' },
      select: { id: true, displayName: true },
    }),
    db.business.findUniqueOrThrow({
      where: { id },
      select: { currency: true, timezone: true },
    }),
  ]);
  if (!business) throw notFound();

  return {
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      price: Number(s.priceAmount),
      durationMinutes: s.durationMinutes,
      staffIds: s.staff.map((x) => x.staffMemberId),
    })),
    staff,
    currency: business.currency,
    timezone: business.timezone,
  };
}
