import { Prisma, type ReservationStatus } from '@prisma/client';
import { db, isSlotConflict } from '@/lib/db';
import { AppError, conflict, forbidden, invalid, notFound, slotUnavailable } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { Actor } from '@/domain/identity/actor';
import { isSuperAdmin } from '@/domain/identity/actor';
import { canTransition, isActive } from '@/domain/booking/stateMachine';
import {
  type BookingPolicy,
  canCustomerCancel,
  canCustomerReschedule,
  isWithinBookingWindow,
} from '@/domain/booking/policy';
import { generateReference } from '@/domain/booking/reference';
import { dayKeyOf } from '@/domain/scheduling/time';
import { getDayAvailability } from './availability';
import { notify, scheduleReminders } from './notifications';
import { isEntitledToBookings } from './subscriptions';

/**
 * The booking engine's write path.
 *
 * Correctness rests on three layers, in order:
 *   1. the availability engine, which only offers legitimate slots;
 *   2. a re-verification inside a SERIALIZABLE transaction, guarded by an
 *      advisory lock that serialises contenders for the same professional-day;
 *   3. the Postgres exclusion constraint, which is the final arbiter and
 *      cannot be bypassed by any application bug.
 *
 * A conflict at any layer surfaces as HTTP 409 SLOT_UNAVAILABLE.
 */

export type CreateReservationInput = {
  businessId: string;
  serviceId: string;
  staffMemberId: string;
  startAt: Date;
  customerId?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  customerNote?: string | null;
  channel?: 'ONLINE' | 'WALK_IN' | 'PHONE';
};

/**
 * 64-bit advisory lock key for (staffMember, day). Two customers racing for
 * the same professional on the same day serialise here, which turns a
 * constraint violation into a clean "slot taken" for the loser.
 */
function lockKey(staffMemberId: string, day: string): bigint {
  const source = `${staffMemberId}:${day}`;
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= BigInt(source.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return BigInt.asIntN(64, hash);
}

export async function createReservation(input: CreateReservationInput) {
  const business = await db.business.findUnique({
    where: { id: input.businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      timezone: true,
      currency: true,
      autoConfirm: true,
      minNoticeMinutes: true,
      maxAdvanceDays: true,
      cancellationWindowHours: true,
      allowCustomerCancel: true,
      allowCustomerReschedule: true,
      ownerId: true,
    },
  });
  if (!business) throw notFound('Business not found.');

  // A suspended or unpublished business cannot take bookings.
  if (business.status !== 'ACTIVE') {
    throw new AppError(
      'BUSINESS_UNAVAILABLE',
      'This business is not currently accepting online bookings.',
    );
  }

  // An expired subscription removes the business from the marketplace and
  // blocks new bookings — a real consequence, not a badge.
  if (!(await isEntitledToBookings(business.id))) {
    throw new AppError(
      'SUBSCRIPTION_INACTIVE',
      'This business is not currently accepting online bookings.',
    );
  }

  const service = await db.service.findFirst({
    where: { id: input.serviceId, businessId: business.id, isActive: true },
    select: {
      id: true,
      name: true,
      priceAmount: true,
      durationMinutes: true,
      minNoticeMinutes: true,
    },
  });
  if (!service) throw notFound('Service not found.');

  // The professional must actually perform this service.
  const staff = await db.staffMember.findFirst({
    where: {
      id: input.staffMemberId,
      businessId: business.id,
      isActive: true,
      isBookable: true,
      services: { some: { serviceId: service.id } },
    },
    select: { id: true, displayName: true },
  });
  if (!staff) {
    throw invalid('That professional does not offer this service.');
  }

  const policy: BookingPolicy = {
    minNoticeMinutes: service.minNoticeMinutes ?? business.minNoticeMinutes,
    maxAdvanceDays: business.maxAdvanceDays,
    cancellationWindowHours: business.cancellationWindowHours,
    allowCustomerCancel: business.allowCustomerCancel,
    allowCustomerReschedule: business.allowCustomerReschedule,
  };

  const now = new Date();
  const window = isWithinBookingWindow(input.startAt, policy, now);
  if (!window.allowed) throw new AppError('POLICY_VIOLATION', window.reason);

  const day = dayKeyOf(business.timezone, input.startAt);
  const endAt = new Date(input.startAt.getTime() + service.durationMinutes * 60000);

  // The requested start must be a slot the engine actually offers — this
  // rejects hand-crafted requests for times outside working hours.
  const availability = await getDayAvailability({
    businessId: business.id,
    serviceId: service.id,
    staffMemberId: staff.id,
    day,
    now,
  });
  const offered = availability.slots.find(
    (s) => s.startAt.getTime() === input.startAt.getTime(),
  );
  if (!offered) throw slotUnavailable();

  const reference = generateReference();

  try {
    const reservation = await db.$transaction(
      async (tx) => {
        // Serialise contenders for this professional-day.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey(staff.id, day)}::bigint)`;

        // Re-check inside the lock: another customer may have booked between
        // the availability read and here.
        const clash = await tx.reservation.findFirst({
          where: {
            staffMemberId: staff.id,
            status: { in: ['PENDING', 'CONFIRMED'] },
            startAt: { lt: endAt },
            endAt: { gt: input.startAt },
          },
          select: { id: true },
        });
        if (clash) throw slotUnavailable();

        const status: ReservationStatus = business.autoConfirm ? 'CONFIRMED' : 'PENDING';

        const created = await tx.reservation.create({
          data: {
            reference,
            businessId: business.id,
            customerId: input.customerId ?? null,
            staffMemberId: staff.id,
            status,
            channel: input.channel ?? 'ONLINE',
            startAt: input.startAt,
            endAt,
            guestName: input.guestName ?? null,
            guestPhone: input.guestPhone ?? null,
            guestEmail: input.guestEmail ?? null,
            totalAmount: service.priceAmount,
            currency: business.currency,
            customerNote: input.customerNote ?? null,
            confirmedAt: status === 'CONFIRMED' ? new Date() : null,
            items: {
              create: {
                serviceId: service.id,
                // Price and duration are frozen at booking time: a later price
                // change must never rewrite an existing appointment.
                serviceName: service.name,
                priceAmount: service.priceAmount,
                durationMinutes: service.durationMinutes,
              },
            },
            events: {
              create: {
                fromStatus: null,
                toStatus: status,
                actorId: input.customerId ?? null,
                actorRole: 'CUSTOMER',
                reason: 'Reservation created',
              },
            },
          },
          include: { items: true },
        });

        return created;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000,
      },
    );

    await scheduleReminders(reservation.id, reservation.startAt);
    await notify.reservationCreated(reservation.id);

    return reservation;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isSlotConflict(error)) {
      logger.info('booking conflict rejected', {
        staffMemberId: staff.id,
        startAt: input.startAt.toISOString(),
      });
      throw slotUnavailable();
    }
    throw error;
  }
}

/** Apply a status transition, writing the append-only event log. */
export async function transitionReservation(opts: {
  reservationId: string;
  to: ReservationStatus;
  actor?: Actor | null;
  reason?: string;
  actorRole?: 'CUSTOMER' | 'BUSINESS_OWNER' | 'BUSINESS_EMPLOYEE' | 'SUPER_ADMIN';
}) {
  const existing = await db.reservation.findUnique({
    where: { id: opts.reservationId },
    select: { id: true, status: true, businessId: true, customerId: true },
  });
  if (!existing) throw notFound('Reservation not found.');

  if (!canTransition(existing.status, opts.to)) {
    throw new AppError(
      'ILLEGAL_TRANSITION',
      `A ${existing.status.toLowerCase().replace(/_/g, ' ')} appointment cannot become ${opts.to
        .toLowerCase()
        .replace(/_/g, ' ')}.`,
    );
  }

  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: opts.to,
        confirmedAt: opts.to === 'CONFIRMED' ? now : undefined,
        completedAt: opts.to === 'COMPLETED' ? now : undefined,
        cancelledAt: opts.to.startsWith('CANCELLED') ? now : undefined,
        cancelReason: opts.to.startsWith('CANCELLED') ? (opts.reason ?? null) : undefined,
      },
    });

    await tx.reservationEvent.create({
      data: {
        reservationId: existing.id,
        fromStatus: existing.status,
        toStatus: opts.to,
        actorId: opts.actor?.userId ?? null,
        actorRole: opts.actorRole ?? null,
        reason: opts.reason ?? null,
      },
    });

    // A reservation that no longer occupies its slot has no pending reminders.
    if (!isActive(opts.to)) {
      await tx.scheduledNotification.updateMany({
        where: { reservationId: existing.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    }

    return result;
  });

  await notify.reservationTransitioned(updated.id, opts.to);
  return updated;
}

/** Customer-initiated cancellation, policy-checked. */
export async function cancelAsCustomer(reservationId: string, actor: Actor, reason?: string) {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      startAt: true,
      customerId: true,
      business: {
        select: {
          cancellationWindowHours: true,
          allowCustomerCancel: true,
          allowCustomerReschedule: true,
          minNoticeMinutes: true,
          maxAdvanceDays: true,
        },
      },
    },
  });
  if (!reservation) throw notFound('Reservation not found.');
  if (reservation.customerId !== actor.userId && !isSuperAdmin(actor)) throw forbidden();

  const check = canCustomerCancel(reservation, reservation.business, new Date());
  if (!check.allowed) throw new AppError('POLICY_VIOLATION', check.reason);

  return transitionReservation({
    reservationId,
    to: 'CANCELLED_BY_CUSTOMER',
    actor,
    actorRole: 'CUSTOMER',
    reason,
  });
}

/**
 * Reschedule: book the replacement first, then retire the original. If the new
 * slot is taken the original survives untouched — the customer never loses an
 * appointment to a failed move.
 */
export async function rescheduleAsCustomer(opts: {
  reservationId: string;
  actor: Actor;
  startAt: Date;
  staffMemberId?: string;
}) {
  const original = await db.reservation.findUnique({
    where: { id: opts.reservationId },
    select: {
      id: true,
      status: true,
      startAt: true,
      customerId: true,
      businessId: true,
      staffMemberId: true,
      customerNote: true,
      items: { select: { serviceId: true } },
      business: {
        select: {
          cancellationWindowHours: true,
          allowCustomerCancel: true,
          allowCustomerReschedule: true,
          minNoticeMinutes: true,
          maxAdvanceDays: true,
        },
      },
    },
  });
  if (!original) throw notFound('Reservation not found.');
  if (original.customerId !== opts.actor.userId && !isSuperAdmin(opts.actor)) throw forbidden();

  const check = canCustomerReschedule(original, original.business, new Date());
  if (!check.allowed) throw new AppError('POLICY_VIOLATION', check.reason);

  const serviceId = original.items[0]?.serviceId;
  if (!serviceId) throw conflict('This appointment has no service to reschedule.');

  const replacement = await createReservation({
    businessId: original.businessId,
    serviceId,
    staffMemberId: opts.staffMemberId ?? original.staffMemberId,
    startAt: opts.startAt,
    customerId: original.customerId,
    customerNote: original.customerNote,
  });

  await db.reservation.update({
    where: { id: original.id },
    data: { rescheduledToId: replacement.id },
  });

  await transitionReservation({
    reservationId: original.id,
    to: 'RESCHEDULED',
    actor: opts.actor,
    actorRole: 'CUSTOMER',
    reason: `Moved to ${replacement.reference}`,
  });

  return replacement;
}
