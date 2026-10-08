import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { variantUrl } from './media';
import type { BusinessCardData } from '@/components/business/BusinessCard';

/**
 * Marketplace read model.
 *
 * Every listing query goes through `LIVE`, which is the single definition of
 * "a business customers may see and book": active, and not behind an expired
 * subscription. Suspended, draft, rejected and expired businesses are absent
 * from every public surface because they never enter this filter.
 */
const LIVE = {
  status: 'ACTIVE',
  OR: [
    { subscription: null },
    { subscription: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE'] } } },
  ],
} satisfies Prisma.BusinessWhereInput;

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  ratingAverage: true,
  ratingCount: true,
  verification: true,
  location: { select: { city: { select: { name: true } }, latitude: true, longitude: true } },
  categories: {
    where: { isPrimary: true },
    take: 1,
    select: { category: { select: { name: true } } },
  },
  media: {
    where: { role: 'COVER' },
    orderBy: { position: 'asc' },
    take: 1,
    select: { asset: { select: { storageKey: true, variants: true } } },
  },
  services: {
    where: { isActive: true },
    orderBy: { priceAmount: 'asc' },
    take: 1,
    select: { priceAmount: true },
  },
} satisfies Prisma.BusinessSelect;

type CardRow = Prisma.BusinessGetPayload<{ select: typeof CARD_SELECT }>;

/** Great-circle distance in kilometres. */
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toCard(row: CardRow, origin?: { lat: number; lng: number }): BusinessCardData {
  const asset = row.media[0]?.asset;
  const distanceKm =
    origin && row.location
      ? haversineKm(origin.lat, origin.lng, row.location.latitude, row.location.longitude)
      : null;

  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    cityName: row.location?.city?.name ?? null,
    categoryName: row.categories[0]?.category.name ?? null,
    ratingAverage: row.ratingAverage,
    ratingCount: row.ratingCount,
    verified: row.verification === 'VERIFIED',
    coverUrl: asset ? variantUrl(asset, 'card') : null,
    fromPrice: row.services[0] ? Number(row.services[0].priceAmount) : null,
    distanceKm,
  };
}

export type SearchFilters = {
  q?: string;
  categorySlug?: string;
  citySlug?: string;
  minRating?: number;
  maxPrice?: number;
  servedGender?: 'WOMEN' | 'MEN' | 'EVERYONE';
  verifiedOnly?: boolean;
  openNow?: boolean;
  lat?: number;
  lng?: number;
  sort?: 'relevance' | 'rating' | 'price' | 'distance';
  page?: number;
  perPage?: number;
};

export async function searchBusinesses(filters: SearchFilters) {
  const perPage = Math.min(48, Math.max(6, filters.perPage ?? 18));
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.BusinessWhereInput = { ...LIVE };
  const and: Prisma.BusinessWhereInput[] = [];

  if (filters.q) {
    // Match the business name, its services, its categories in any of the
    // three languages (a visitor typing "حلاق" or "barber" must find the
    // barbers, whose own texts are usually French), or its city.
    const text = { contains: filters.q, mode: 'insensitive' as const };
    const categoryText: Prisma.CategoryWhereInput[] = [
      { name: text },
      { nameAr: text },
      { nameEn: text },
    ];
    and.push({
      OR: [
        { name: text },
        { tagline: text },
        { services: { some: { name: text, isActive: true } } },
        {
          categories: {
            some: {
              category: { OR: [...categoryText, { parent: { OR: categoryText } }] },
            },
          },
        },
        { location: { is: { city: { is: { OR: [{ name: text }, { nameAr: text }] } } } } },
      ],
    });
  }
  if (filters.categorySlug) {
    // Match the category itself or any of its children, so "Beauté" returns
    // businesses tagged only with "Ongles".
    and.push({
      categories: {
        some: {
          category: {
            OR: [{ slug: filters.categorySlug }, { parent: { slug: filters.categorySlug } }],
          },
        },
      },
    });
  }
  if (filters.citySlug) and.push({ location: { city: { slug: filters.citySlug } } });
  if (filters.minRating) and.push({ ratingAverage: { gte: filters.minRating } });
  if (filters.maxPrice) {
    and.push({ services: { some: { isActive: true, priceAmount: { lte: filters.maxPrice } } } });
  }
  if (filters.servedGender && filters.servedGender !== 'EVERYONE') {
    and.push({ servedGender: { in: [filters.servedGender, 'EVERYONE'] } });
  }
  if (filters.verifiedOnly) and.push({ verification: 'VERIFIED' });
  if (filters.openNow) {
    const now = new Date();
    const minutes = now.getUTCHours() * 60 + 60 + now.getUTCMinutes(); // Tunis = UTC+1
    and.push({
      hours: { some: { weekday: now.getUTCDay(), startMin: { lte: minutes }, endMin: { gt: minutes } } },
    });
  }
  if (and.length > 0) where.AND = and;

  const orderBy: Prisma.BusinessOrderByWithRelationInput[] =
    filters.sort === 'rating'
      ? [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }]
      : [{ ratingAverage: 'desc' }, { publishedAt: 'desc' }];

  const [rows, total] = await Promise.all([
    db.business.findMany({
      where,
      select: CARD_SELECT,
      orderBy,
      // Distance and price sorting need the full set before ordering, so page
      // in memory for those; the live filter keeps the set small.
      skip: filters.sort === 'distance' || filters.sort === 'price' ? 0 : (page - 1) * perPage,
      take: filters.sort === 'distance' || filters.sort === 'price' ? 300 : perPage,
    }),
    db.business.count({ where }),
  ]);

  const origin = filters.lat != null && filters.lng != null ? { lat: filters.lat, lng: filters.lng } : undefined;
  let cards = rows.map((r) => toCard(r, origin));

  if (filters.sort === 'distance' && origin) {
    cards.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    cards = cards.slice((page - 1) * perPage, page * perPage);
  } else if (filters.sort === 'price') {
    cards.sort((a, b) => (a.fromPrice ?? Infinity) - (b.fromPrice ?? Infinity));
    cards = cards.slice((page - 1) * perPage, page * perPage);
  }

  return { businesses: cards, total, page, perPage, pageCount: Math.ceil(total / perPage) };
}

export async function featuredBusinesses(limit = 8): Promise<BusinessCardData[]> {
  const rows = await db.business.findMany({
    where: { ...LIVE, verification: 'VERIFIED' },
    select: CARD_SELECT,
    orderBy: [{ ratingAverage: 'desc' }, { ratingCount: 'desc' }],
    take: limit,
  });
  return rows.map((r) => toCard(r));
}

export async function popularBusinesses(limit = 8): Promise<BusinessCardData[]> {
  const popular = await db.reservation.groupBy({
    by: ['businessId'],
    where: { createdAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
    _count: { businessId: true },
    orderBy: { _count: { businessId: 'desc' } },
    take: limit,
  });
  if (popular.length === 0) return featuredBusinesses(limit);

  const rows = await db.business.findMany({
    where: { ...LIVE, id: { in: popular.map((p) => p.businessId) } },
    select: CARD_SELECT,
  });
  const order = new Map(popular.map((p, i) => [p.businessId, i]));
  return rows
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
    .map((r) => toCard(r));
}

export async function topCategories(limit = 8) {
  const categories = await db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { position: 'asc' },
    take: limit,
    select: {
      slug: true,
      name: true,
      nameAr: true,
      nameEn: true,
      icon: true,
      _count: { select: { businesses: true } },
    },
  });
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    icon: c.icon,
    count: c._count.businesses,
  }));
}

export async function listCities() {
  return db.city.findMany({
    orderBy: { name: 'asc' },
    select: { slug: true, name: true, nameAr: true },
  });
}

/**
 * What the home page can honestly claim: how many businesses are live and
 * in how many cities. Counted, never hard-coded, so the badge grows with the
 * marketplace and cannot overstate it.
 */
export async function marketplaceStats(): Promise<{ businesses: number; cities: number }> {
  const [businesses, cities] = await Promise.all([
    db.business.count({ where: LIVE }),
    db.city.count({ where: { locations: { some: { business: LIVE } } } }),
  ]);
  return { businesses, cities };
}
