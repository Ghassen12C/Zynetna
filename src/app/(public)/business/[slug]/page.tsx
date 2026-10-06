import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import { getBusinessProfile } from '@/server/services/businessProfile';
import { BusinessProfileView } from '@/components/business/BusinessProfileView';
import { db } from '@/lib/db';

export const revalidate = 120;

type Params = { params: Promise<{ slug: string }> };

/** Pre-render the live businesses; the rest render on demand. */
export async function generateStaticParams() {
  const businesses = await db.business.findMany({
    where: { status: 'ACTIVE' },
    select: { slug: true },
    take: 200,
  });
  return businesses.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessProfile(slug);
  if (!business) return { title: 'Établissement introuvable' };

  const city = business.location?.city?.name;
  const category = business.categories.find((c) => c.isPrimary)?.category.name;
  const title = `${business.name}${city ? ` — ${city}` : ''}`;
  const description =
    business.tagline ??
    business.description?.slice(0, 160) ??
    `Réservez en ligne chez ${business.name}${city ? ` à ${city}` : ''}${
      category ? ` — ${category}` : ''
    }.`;

  return {
    title,
    description,
    alternates: { canonical: `/business/${business.slug}` },
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${env.APP_URL}/business/${business.slug}`,
      images: business.cover ? [{ url: business.cover.url }] : undefined,
    },
  };
}

export default async function BusinessPage({ params }: Params) {
  const { slug } = await params;
  const business = await getBusinessProfile(slug);
  if (!business) notFound();

  // Structured data so the profile can win a rich result in search.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    name: business.name,
    description: business.description ?? business.tagline ?? undefined,
    url: `${env.APP_URL}/business/${business.slug}`,
    image: business.cover?.url,
    telephone: business.phone ?? undefined,
    priceRange: business.fromPrice ? `${business.fromPrice} TND+` : undefined,
    address: business.location
      ? {
          '@type': 'PostalAddress',
          streetAddress: business.location.addressLine1,
          addressLocality: business.location.city?.name,
          addressRegion: business.location.city?.governorate.name,
          postalCode: business.location.postalCode ?? undefined,
          addressCountry: 'TN',
        }
      : undefined,
    geo: business.location
      ? {
          '@type': 'GeoCoordinates',
          latitude: business.location.latitude,
          longitude: business.location.longitude,
        }
      : undefined,
    aggregateRating:
      business.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: business.ratingAverage,
            reviewCount: business.ratingCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    openingHoursSpecification: business.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
      ][h.weekday],
      opens: `${String(Math.floor(h.startMin / 60)).padStart(2, '0')}:${String(h.startMin % 60).padStart(2, '0')}`,
      closes: `${String(Math.floor(h.endMin / 60)).padStart(2, '0')}:${String(h.endMin % 60).padStart(2, '0')}`,
    })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Prestations',
      itemListElement: business.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.name, description: s.description ?? undefined },
        price: s.price,
        priceCurrency: business.currency,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Values come from our own database, and JSON.stringify escapes them.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BusinessProfileView business={business} />
    </>
  );
}
