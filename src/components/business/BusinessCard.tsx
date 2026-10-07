import Link from 'next/link';
import { Badge, Rating } from '@/components/ui/Primitives';
import { formatPrice } from '@/i18n/format';
import type { CSSProperties } from 'react';
import { coverToneFor } from '@/lib/brand';

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

/** Each business keeps one stable tone, so its fallback never changes colour. */
function coverStyle(key: string): CSSProperties {
  const [from, to] = coverToneFor(key);
  return { ['--cover-from' as string]: from, ['--cover-to' as string]: to };
}

export function BusinessCard({ business }: { business: BusinessCardData }) {
  return (
    <Link href={`/business/${business.slug}`} className="z-bcard">
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
            <Badge tone="accent">✓ Vérifié</Badge>
          </span>
        ) : null}
      </div>

      <div className="z-bcard__body">
        <h3 className="z-bcard__name">{business.name}</h3>
        <Rating value={business.ratingAverage} count={business.ratingCount} size={13} />

        <p className="z-bcard__meta">
          {business.categoryName ? <>{business.categoryName} · </> : null}
          {business.cityName}
          {business.distanceKm != null ? (
            <span className="z-bcard__distance"> · {business.distanceKm.toFixed(1)} km</span>
          ) : null}
        </p>

        {business.fromPrice != null ? (
          <p className="z-bcard__price">
            <span>à partir de</span> {formatPrice(business.fromPrice)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
