import { db } from '@/lib/db';
import { variantUrl } from './media';
import { isEntitledToBookings } from './subscriptions';
import type { MediaRole } from '@prisma/client';

/**
 * The public business profile — the "digital storefront".
 *
 * One query shape serves both the live public page and the professional's
 * own preview, so "how customers see my business" is literally the same data
 * path rather than a second implementation that can drift.
 */
export type ProfileMedia = { id: string; url: string; thumbUrl: string; alt: string | null; role: MediaRole };

export async function getBusinessProfile(slug: string, options?: { preview?: boolean }) {
  const business = await db.business.findUnique({
    where: { slug },
    include: {
      location: { include: { city: { include: { governorate: true } } } },
      categories: { include: { category: true } },
      hours: { orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }] },
      exceptions: {
        where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        orderBy: { date: 'asc' },
        take: 20,
      },
      services: {
        where: { isActive: true },
        orderBy: [{ position: 'asc' }, { priceAmount: 'asc' }],
        include: {
          category: true,
          media: { orderBy: { position: 'asc' }, take: 1, include: { asset: true } },
          staff: { select: { staffMemberId: true } },
          packageItems: {
            orderBy: { position: 'asc' },
            select: {
              service: {
                select: { id: true, name: true, priceAmount: true, durationMinutes: true, isActive: true },
              },
            },
          },
        },
      },
      staff: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
        include: {
          avatar: true,
          services: { select: { serviceId: true } },
        },
      },
      media: { orderBy: [{ role: 'asc' }, { position: 'asc' }], include: { asset: true } },
      subscription: { select: { status: true } },
      _count: { select: { reviews: { where: { status: 'PUBLISHED' } } } },
    },
  });

  if (!business) return null;

  // A draft, suspended or rejected business is invisible to the public, but
  // its owner must still be able to preview it.
  const publiclyVisible = business.status === 'ACTIVE' && (await isEntitledToBookings(business.id));
  if (!publiclyVisible && !options?.preview) return null;

  const mediaByRole = (role: MediaRole): ProfileMedia[] =>
    business.media
      .filter((m) => m.role === role)
      .map((m) => ({
        id: m.id,
        url: variantUrl(m.asset, 'full'),
        thumbUrl: variantUrl(m.asset, 'thumb'),
        alt: m.caption ?? m.asset.alt,
        role: m.role,
      }));

  const reviews = await db.review.findMany({
    where: { businessId: business.id, status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    take: 12,
    include: {
      customer: { select: { firstName: true, lastName: true } },
      response: true,
      reservation: { select: { items: { select: { serviceName: true }, take: 1 } } },
    },
  });

  const ratingBreakdown = await db.review.groupBy({
    by: ['rating'],
    where: { businessId: business.id, status: 'PUBLISHED' },
    _count: { rating: true },
  });

  return {
    ...business,
    publiclyVisible,
    bookable: publiclyVisible,
    logo: mediaByRole('LOGO')[0] ?? null,
    cover: mediaByRole('COVER')[0] ?? null,
    exterior: mediaByRole('EXTERIOR'),
    interior: mediaByRole('INTERIOR'),
    portfolio: mediaByRole('PORTFOLIO'),
    teamPhotos: mediaByRole('TEAM'),
    gallery: [
      ...mediaByRole('EXTERIOR'),
      ...mediaByRole('INTERIOR'),
      ...mediaByRole('PORTFOLIO'),
      ...mediaByRole('GALLERY'),
    ],
    services: business.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: Number(s.priceAmount),
      durationMinutes: s.durationMinutes,
      categoryName: s.category?.name ?? null,
      // The category row carries its own translations; readers pick theirs.
      category: s.category
        ? { name: s.category.name, nameAr: s.category.nameAr, nameEn: s.category.nameEn }
        : null,
      imageUrl: s.media[0] ? variantUrl(s.media[0].asset, 'card') : null,
      staffIds: s.staff.map((x) => x.staffMemberId),
      isPackage: s.isPackage,
      requiresConfirmation: s.requiresConfirmation,
      maxAdvanceDays: s.maxAdvanceDays,
      // What a pack bundles, and what those services would cost one by one.
      includes: s.packageItems.map((i) => ({ id: i.service.id, name: i.service.name })),
      separatePrice: s.packageItems.reduce((sum, i) => sum + Number(i.service.priceAmount), 0),
    })),
    staff: business.staff.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      title: s.title,
      bio: s.bio,
      specialties: s.specialties,
      isBookable: s.isBookable,
      avatarUrl: s.avatar ? variantUrl(s.avatar, 'thumb') : null,
      serviceIds: s.services.map((x) => x.serviceId),
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      // Surnames are reduced to an initial: enough to feel real, not enough to
      // identify a customer from a public page.
      authorName: `${r.customer.firstName} ${r.customer.lastName.charAt(0)}.`,
      serviceName: r.reservation.items[0]?.serviceName ?? null,
      response: r.response ? { body: r.response.body, createdAt: r.response.createdAt } : null,
    })),
    ratingBreakdown: [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: ratingBreakdown.find((b) => b.rating === star)?._count.rating ?? 0,
    })),
    reviewCount: business._count.reviews,
    fromPrice: business.services.length
      ? Math.min(...business.services.map((s) => Number(s.priceAmount)))
      : null,
  };
}

export type BusinessProfile = NonNullable<Awaited<ReturnType<typeof getBusinessProfile>>>;

/** Is the business open at this instant, in its own timezone? */
export function isOpenNow(
  hours: { weekday: number; startMin: number; endMin: number }[],
  timezone: string,
  now = new Date(),
): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const weekdayName = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);
  const minutes = hour * 60 + minute;

  return hours.some((h) => h.weekday === weekday && h.startMin <= minutes && h.endMin > minutes);
}

export const WEEKDAY_LABELS = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
] as const;
