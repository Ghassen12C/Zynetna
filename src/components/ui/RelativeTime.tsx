'use client';

import { useEffect, useState } from 'react';
import { formatDate, formatRelative } from '@/i18n/format';
import type { Locale } from '@/i18n/config';

/**
 * Relative timestamps ("il y a 3 jours") computed on the server and again on
 * the client disagree whenever the two renders straddle a minute boundary,
 * which React reports as a hydration mismatch.
 *
 * The absolute date is rendered first — correct, stable, and identical on both
 * sides — and the relative form is swapped in after mount. The machine-readable
 * value in `dateTime` never changes.
 */
export function RelativeTime({
  value,
  locale = 'fr',
  fallback,
}: {
  value: string | null;
  locale?: Locale;
  fallback?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!value) return <>{fallback ?? '—'}</>;
  const date = new Date(value);

  return (
    <time dateTime={value}>
      {mounted ? formatRelative(date, locale) : formatDate(date, locale)}
    </time>
  );
}
