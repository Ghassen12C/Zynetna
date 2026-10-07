'use client';

import { LOCALE_META } from '@/i18n/config';
import { formatCount, formatNumber } from '@/i18n/format';
import { interpolate } from '@/i18n/interpolate';
import { useUiText } from './UiText';

/** Star rating. Decorative stars are hidden; the value is announced once. */
export function Rating({
  value,
  count,
  size = 15,
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: number;
  showValue?: boolean;
}) {
  const { locale, ui } = useUiText();
  const rounded = Math.round(value * 2) / 2;
  const shown = new Intl.NumberFormat(LOCALE_META[locale].intl, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
  const label = count
    ? interpolate(ui.ratingWithReviews, {
        value: shown,
        reviews: formatCount(ui.reviews, count, locale),
      })
    : interpolate(ui.ratingOutOf, { value: shown });
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      role="img"
      aria-label={label}
    >
      <span style={{ display: 'inline-flex', gap: 1 }} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20">
            <path
              d="M10 1.6l2.47 5.2 5.53.78-4 3.98.95 5.64L10 14.5l-4.95 2.7.95-5.64-4-3.98 5.53-.78L10 1.6Z"
              fill={rounded >= i ? 'var(--z-jasmin)' : 'var(--z-chaux-300)'}
            />
          </svg>
        ))}
      </span>
      {showValue ? (
        <span style={{ fontSize: 'var(--z-text-sm)', fontWeight: 600 }} aria-hidden="true">
          {value > 0 ? shown : '—'}
          {count !== undefined ? (
            <span style={{ color: 'var(--z-fg-muted)', fontWeight: 400 }}>
              {' '}
              ({formatNumber(count, locale)})
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
