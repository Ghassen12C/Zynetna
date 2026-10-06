import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { MapDiscovery } from '@/components/map/MapDiscovery';
import { mapProvider } from '@/server/providers/maps';
import { variantUrl } from '@/server/services/media';

export const metadata: Metadata = {
  title: 'Carte',
  description:
    'Trouvez un coiffeur, un barbier, un institut ou un spa près de vous sur la carte de la Tunisie.',
  alternates: { canonical: '/map' },
};

export const revalidate = 300;

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; city?: string }>;
}) {
  const params = await searchParams;

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
      location: { select: { latitude: true, longitude: true, addressLine1: true, city: { select: { name: true } } } },
      categories: {
        where: { isPrimary: true },
        take: 1,
        select: { category: { select: { name: true } } },
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
      select: { slug: true, name: true },
    }),
    db.city.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }),
  ]);

  return (
    <MapDiscovery
      tiles={mapProvider.tiles()}
      providerName={mapProvider.name}
      categories={categories}
      cities={cities}
      filters={{ category: params.category ?? null, city: params.city ?? null }}
      businesses={businesses
        .filter((b) => b.location)
        .map((b) => ({
          slug: b.slug,
          name: b.name,
          lat: b.location!.latitude,
          lng: b.location!.longitude,
          address: `${b.location!.addressLine1}${b.location!.city ? `, ${b.location!.city.name}` : ''}`,
          category: b.categories[0]?.category.name ?? null,
          rating: b.ratingAverage,
          ratingCount: b.ratingCount,
          verified: b.verification === 'VERIFIED',
          fromPrice: b.services[0] ? Number(b.services[0].priceAmount) : null,
          coverUrl: b.media[0] ? variantUrl(b.media[0].asset, 'thumb') : null,
        }))}
    />
  );
}
