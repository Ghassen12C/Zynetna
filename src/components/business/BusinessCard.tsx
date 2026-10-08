import Link from 'next/link';
import { cache } from 'react';
import { db } from '@/lib/db';
import { Badge, Rating } from '@/components/ui/Primitives';
import { LOCALE_META } from '@/i18n/config';
import { formatPrice, localizedName } from '@/i18n/format';
import { translate } from '@/i18n/server';
import { coverStyle } from '@/lib/brand';

export type BusinessCardData = {
  slug: string;
  name: string;
  tagline?: string | null;
  cityName?: string | null;
  categoryName?: string | null;
  ratingAverage: number;
  ratingCount: number;
  verified: boolean;
  coverUrl?: string | null;
  fromPrice?: number | null;
  distanceKm?: number | null;
};

/**
 * Card data carries the French city and category names (the column that is
 * always populated). One lookup per request, shared by every card on the
 * page, maps them to the visitor's language.
 */
const nameTables = cache(async () => {
  const [categories, cities] = await Promise.all([
    db.category.findMany({ select: { name: true, nameAr: true, nameEn: true } }),
    db.city.findMany({ select: { name: true, nameAr: true } }),
  ]);
  return {
    categories: new Map(categories.map((row) => [row.name, row])),
    cities: new Map(cities.map((row) => [row.name, row])),
  };
});

export async function BusinessCard({ business }: { business: BusinessCardData }) {
  const { m, t, locale, path } = await translate();
  const tables = locale === 'fr' ? null : await nameTables();
  const categoryName = business.categoryName
    ? localizedName(
        tables?.categories.get(business.categoryName) ?? { name: business.categoryName },
        locale,
      )
    : null;
  const cityName = business.cityName
    ? localizedName(tables?.cities.get(business.cityName) ?? { name: business.cityName }, locale)
    : null;
  const distance =
    business.distanceKm != null
      ? new Intl.NumberFormat(LOCALE_META[locale].intl, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(business.distanceKm)
      : null;

  return (
    <Link href={path(`/business/${business.slug}`)} className="z-bcard">
      <div className="z-bcard__media">
        {business.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="z-bcard__img"
          />
        ) : (
          <div
            className="z-bcard__placeholder z-cover"
            aria-hidden="true"
            style={coverStyle(business.slug)}
          >
            <svg viewBox="0 0 100 138" width="38" height="52" opacity="0.32">
              <path d="M0 50a50 50 0 0 1 100 0v80a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V50Z" fill="currentColor" />
            </svg>
          </div>
        )}
        {business.verified ? (
          <span className="z-bcard__verified">
            <Badge tone="accent">✓ {m.business.verified}</Badge>
          </span>
        ) : null}
      </div>

      <div className="z-bcard__body">
        <h3 className="z-bcard__name" dir="auto">{business.name}</h3>
        <Rating value={business.ratingAverage} count={business.ratingCount} size={13} />

        <p className="z-bcard__meta">
          {categoryName ? <>{categoryName} · </> : null}
          {cityName}
          {distance != null ? (
            <span className="z-bcard__distance">
              {' · '}
              <bdi>{t(m.business.distanceKm, { distance })}</bdi>
            </span>
          ) : null}
        </p>

        {business.fromPrice != null ? (
          <p className="z-bcard__price">
            <span>{m.business.from}</span> {formatPrice(business.fromPrice, locale)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
