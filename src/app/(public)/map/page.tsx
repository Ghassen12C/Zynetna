import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { MapDiscovery } from '@/components/map/MapDiscovery';
import { mapProvider } from '@/server/providers/maps';
import { variantUrl } from '@/server/services/media';
import { localizedName } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return {
    title: m.nav.map,
    description: m.map.metaDescription,
    alternates: { canonical: '/map' },
  };
}

export const revalidate = 300;

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; city?: string }>;
}) {
  const [params, { m, locale, path }] = await Promise.all([searchParams, translate()]);

  const businesses = await db.business.findMany({
    where: {
      status: 'ACTIVE',
      location: { isNot: null },
      OR: [
        { subscription: null },
        { subscription: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE'] } } },
      ],
      ...(params.category
        ? {
            categories: {
              some: {
                category: {
                  OR: [{ slug: params.category }, { parent: { slug: params.category } }],
                },
              },
            },
          }
        : {}),
      ...(params.city ? { location: { city: { slug: params.city } } } : {}),
    },
    select: {
      slug: true,
      name: true,
      ratingAverage: true,
      ratingCount: true,
      verification: true,
      location: { select: { latitude: true, longitude: true, addressLine1: true, city: { select: { name: true, nameAr: true } } } },
      categories: {
        where: { isPrimary: true },
        take: 1,
        select: { category: { select: { name: true, nameAr: true, nameEn: true } } },
      },
      services: { where: { isActive: true }, orderBy: { priceAmount: 'asc' }, take: 1, select: { priceAmount: true } },
      media: {
        where: { role: 'COVER' },
        take: 1,
        select: { asset: { select: { storageKey: true, variants: true } } },
      },
    },
    take: 500,
  });

  const [categories, cities] = await Promise.all([
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { position: 'asc' },
      select: { slug: true, name: true, nameAr: true, nameEn: true },
    }),
    db.city.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true, nameAr: true } }),
  ]);

  return (
    <MapDiscovery
      tiles={mapProvider.tiles()}
      providerName={mapProvider.name}
      categories={categories.map((c) => ({ slug: c.slug, name: localizedName(c, locale) }))}
      cities={cities.map((c) => ({ slug: c.slug, name: localizedName(c, locale) }))}
      m={{ map: m.map, search: m.search, home: m.home, business: m.business, common: m.common }}
      locale={locale}
      mapPath={path('/map')}
      filters={{ category: params.category ?? null, city: params.city ?? null }}
      businesses={businesses
        .filter((b) => b.location)
        .map((b) => ({
          slug: b.slug,
          name: b.name,
          lat: b.location!.latitude,
          lng: b.location!.longitude,
          address: `${b.location!.addressLine1}${
            b.location!.city ? `, ${localizedName(b.location!.city, locale)}` : ''
          }`,
          category: b.categories[0] ? localizedName(b.categories[0].category, locale) : null,
          rating: b.ratingAverage,
          ratingCount: b.ratingCount,
          verified: b.verification === 'VERIFIED',
          fromPrice: b.services[0] ? Number(b.services[0].priceAmount) : null,
          coverUrl: b.media[0] ? variantUrl(b.media[0].asset, 'thumb') : null,
        }))}
    />
  );
}
