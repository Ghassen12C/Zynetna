import { db } from '@/lib/db';
import { variantUrl } from './media';
import type { Actor } from '@/domain/identity/actor';

/**
 * Customer account read model. Every query is scoped to the actor's own id —
 * there is no code path here that can read another customer's appointments.
 */

const RESERVATION_SELECT = {
  id: true,
  reference: true,
  status: true,
  startAt: true,
  endAt: true,
  totalAmount: true,
  currency: true,
  business: {
    select: {
      slug: true,
      name: true,
      timezone: true,
      phone: true,
      cancellationWindowHours: true,
      allowCustomerCancel: true,
      allowCustomerReschedule: true,
      minNoticeMinutes: true,
      maxAdvanceDays: true,
      location: {
        select: {
          addressLine1: true,
          city: { select: { name: true, nameAr: true, nameEn: true } },
        },
      },
      media: {
        where: { role: 'LOGO' },
        take: 1,
        select: { asset: { select: { storageKey: true, variants: true } } },
      },
    },
  },
  staffMember: { select: { displayName: true } },
  items: { select: { serviceName: true, durationMinutes: true } },
  review: { select: { id: true, rating: true } },
} as const;

function decorate<T extends { business: { media: { asset: { storageKey: string; variants: unknown } }[] } }>(
  row: T,
) {
  const asset = row.business.media[0]?.asset;
  return { ...row, logoUrl: asset ? variantUrl(asset, 'thumb') : null };
}

export async function upcomingReservations(actor: Actor) {
  const rows = await db.reservation.findMany({
    where: {
      customerId: actor.userId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      startAt: { gte: new Date() },
    },
    orderBy: { startAt: 'asc' },
    select: RESERVATION_SELECT,
  });
  return rows.map(decorate);
}

export async function pastReservations(actor: Actor, take = 40) {
  const rows = await db.reservation.findMany({
    where: {
      customerId: actor.userId,
      OR: [
        { status: { in: ['COMPLETED', 'NO_SHOW', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_BUSINESS', 'EXPIRED', 'RESCHEDULED'] } },
        { startAt: { lt: new Date() } },
      ],
    },
    orderBy: { startAt: 'desc' },
    take,
    select: RESERVATION_SELECT,
  });
  return rows.map(decorate);
}

export async function favoriteBusinesses(actor: Actor) {
  const rows = await db.favorite.findMany({
    where: { userId: actor.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      business: {
        select: {
          slug: true,
          name: true,
          tagline: true,
          ratingAverage: true,
          ratingCount: true,
          verification: true,
          status: true,
          location: { select: { city: { select: { name: true } } } },
          categories: {
            where: { isPrimary: true },
            take: 1,
            select: { category: { select: { name: true } } },
          },
          media: {
            where: { role: 'COVER' },
            take: 1,
            select: { asset: { select: { storageKey: true, variants: true } } },
          },
          services: {
            where: { isActive: true },
            orderBy: { priceAmount: 'asc' },
            take: 1,
            select: { priceAmount: true },
          },
        },
      },
    },
  });

  return rows.map(({ business }) => ({
    slug: business.slug,
    name: business.name,
    tagline: business.tagline,
    cityName: business.location?.city?.name ?? null,
    categoryName: business.categories[0]?.category.name ?? null,
    ratingAverage: business.ratingAverage,
    ratingCount: business.ratingCount,
    verified: business.verification === 'VERIFIED',
    coverUrl: business.media[0] ? variantUrl(business.media[0].asset, 'card') : null,
    fromPrice: business.services[0] ? Number(business.services[0].priceAmount) : null,
    distanceKm: null,
  }));
}

export async function myReviews(actor: Actor) {
  return db.review.findMany({
    where: { customerId: actor.userId },
    orderBy: { createdAt: 'desc' },
    include: {
      business: { select: { slug: true, name: true } },
      response: true,
      reservation: { select: { items: { select: { serviceName: true }, take: 1 } } },
    },
  });
}

/** Completed appointments the customer has not reviewed yet. */
export async function reviewableReservations(actor: Actor) {
  return db.reservation.findMany({
    where: { customerId: actor.userId, status: 'COMPLETED', review: null },
    orderBy: { startAt: 'desc' },
    take: 10,
    select: {
      id: true,
      reference: true,
      startAt: true,
      business: { select: { slug: true, name: true } },
      items: { select: { serviceName: true }, take: 1 },
    },
  });
}

export async function notifications(actor: Actor, take = 30) {
  return db.notification.findMany({
    where: { userId: actor.userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function unreadNotificationCount(actor: Actor) {
  return db.notification.count({ where: { userId: actor.userId, readAt: null } });
}

export async function accountSummary(actor: Actor) {
  const [upcoming, completed, favorites, unread] = await Promise.all([
    db.reservation.count({
      where: { customerId: actor.userId, status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: new Date() } },
    }),
    db.reservation.count({ where: { customerId: actor.userId, status: 'COMPLETED' } }),
    db.favorite.count({ where: { userId: actor.userId } }),
    unreadNotificationCount(actor),
  ]);
  return { upcoming, completed, favorites, unread };
}
