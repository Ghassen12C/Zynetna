import type { ReactNode } from 'react';

/**
 * Category icons — one hand-drawn line set on a 24px grid.
 *
 * These replace the emoji the categories shipped with. Emoji render
 * differently on every operating system, carry their own colour, and are
 * the quickest tell of a templated product. A single stroke weight and
 * corner style, drawn in the brand's own ink, reads as one designed family.
 *
 * Keyed by slug so the set follows the taxonomy. A category added later in
 * the admin without a drawing here falls back to whatever the admin typed.
 */
const PATHS: Record<string, ReactNode> = {
  // ── Top-level categories ────────────────────────────────────────────
  'coiffure-femme': (
    <>
      <path d="M3 9a4 4 0 0 1 4-4h8v8H7a4 4 0 0 1-4-4Z" />
      <path d="M15 7h4.5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H15" />
      <path d="M8 13l1.2 7h2.6L10.6 13" />
      <circle cx="7" cy="9" r="1.2" />
    </>
  ),
  barbier: (
    <>
      <rect x="8" y="5" width="8" height="14" rx="1.5" />
      <path d="M6.5 5h11M6.5 19h11M12 2.5V5M12 19v2.5" />
      <path d="M8 10.5l8-3M8 14.5l8-3" />
    </>
  ),
  ongles: (
    <>
      <path d="M7 11.5h10v7.5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7.5Z" />
      <path d="M9 11.5V9h6v2.5" />
      <path d="M10.2 9V3.5h3.6V9" />
    </>
  ),
  esthetique: (
    <>
      <path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7L11 3.5Z" />
      <path d="M18.5 14.5v5M16 17h5" />
    </>
  ),
  'bien-etre': (
    <>
      <path d="M12 4c2 2.5 3 5 3 7.5S13.6 17 12 18c-1.6-1-3-3.5-3-6.5S10 6.5 12 4Z" />
      <path d="M9.3 9.6C6.6 9.1 4 9.6 3 10.6c.6 4 3.6 7 9 7.4" />
      <path d="M14.7 9.6c2.7-.5 5.3 0 6.3 1-.6 4-3.6 7-9 7.4" />
      <path d="M5 21h14" />
    </>
  ),

  // ── Hair ────────────────────────────────────────────────────────────
  'coupe-femme': (
    <>
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.2 15.9 17.5 3.5M15.8 15.9 6.5 3.5" />
    </>
  ),
  brushing: (
    <>
      <rect x="9" y="2.5" width="6" height="12.5" rx="3" />
      <path d="M12 15v6.5M6.5 6h2.5M6.5 9h2.5M6.5 12h2.5M15 6h2.5M15 9h2.5M15 12h2.5" />
    </>
  ),
  coloration: (
    <>
      <path d="M4 20l5.5-5.5" />
      <path d="M8.5 11.5l4 4 6.3-6.3a2.8 2.8 0 0 0-4-4l-6.3 6.3Z" />
      <path d="M18.5 21a2 2 0 0 0 2-2c0-1.3-2-3.8-2-3.8s-2 2.5-2 3.8a2 2 0 0 0 2 2Z" />
    </>
  ),
  'soin-cheveux': (
    <>
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
      <path d="M9.4 14.4A2.6 2.6 0 0 0 12 17" />
    </>
  ),

  // ── Barber ──────────────────────────────────────────────────────────
  // Clippers, with the comb teeth that make them clippers rather than a jar.
  'coupe-homme': (
    <>
      <rect x="7.5" y="8.5" width="9" height="12.5" rx="2.6" />
      <path d="M7.2 8.5h9.6l-.9-3.6H8.1Z" />
      <path d="M9.2 4.9V2.8M11.2 4.9V2.8M13.2 4.9V2.8M15.2 4.9V2.8" />
      <path d="M10.5 13.5h3" />
    </>
  ),
  barbe: (
    <>
      <path d="M5 8c0 7 3 12.5 7 12.5S19 15 19 8" />
      <path d="M5 8c2 2 4.5 3 7 3s5-1 7-3" />
      <path d="M8.6 14c1-.9 2.2-1 3.4-.2 1.2-.8 2.4-.7 3.4.2" />
    </>
  ),
  // A folding straight razor: the long blade, the pivot, the angled handle.
  rasage: (
    <>
      <path d="M2.5 7.5h11l2.2 2.2v1.8H4.6a2.1 2.1 0 0 1-2.1-2.1V7.5Z" />
      <circle cx="14.2" cy="11.6" r="1" />
      <path d="M14.9 12.4l5.6 6.1a1.4 1.4 0 0 1-2.1 1.9l-5-5.6" />
    </>
  ),

  // ── Nails ───────────────────────────────────────────────────────────
  manucure: (
    <>
      <path d="M9 21.5V8a3 3 0 0 1 6 0v13.5" />
      <path d="M10.2 9.4a1.8 1.8 0 0 1 3.6 0V12h-3.6V9.4Z" />
    </>
  ),
  pedicure: (
    <>
      <path d="M9.5 21c-2.6 0-3.6-2.6-3.1-5.7.4-2.6 1.4-5.3 3-5.3s2.2 2.3 2.2 5c0 2.4.7 6-2.1 6Z" />
      <circle cx="8.6" cy="6.2" r="1.3" />
      <circle cx="11.6" cy="5" r="1.1" />
      <circle cx="14.2" cy="6" r="1" />
      <circle cx="16" cy="8.2" r="0.9" />
    </>
  ),

  // ── Beauty ──────────────────────────────────────────────────────────
  maquillage: (
    <>
      <path d="M9 21.5h6V12H9v9.5Z" />
      <path d="M10 12V7.8l4-3.3V12" />
    </>
  ),
  cils: (
    <>
      <path d="M2.5 13s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z" />
      <circle cx="12" cy="13" r="2.4" />
      <path d="M12 8V5M7.6 9 6 6.5M16.4 9 18 6.5" />
    </>
  ),
  sourcils: (
    <>
      <path d="M3.5 9.5c3.5-3.5 13.5-3.5 17 0" />
      <path d="M4 16s3.2-3.5 8-3.5 8 3.5 8 3.5-3.2 3.5-8 3.5S4 16 4 16Z" />
      <circle cx="12" cy="16" r="1.6" />
    </>
  ),
  'soin-visage': (
    <>
      <path d="M12 3c4 0 7 3 7 8 0 5.2-3 10-7 10s-7-4.8-7-10c0-5 3-8 7-8Z" />
      <path d="M9.4 11h.01M14.6 11h.01" />
      <path d="M9.6 15.4c1.4 1 3.4 1 4.8 0" />
    </>
  ),

  // ── Wellness ────────────────────────────────────────────────────────
  massage: (
    <>
      <ellipse cx="12" cy="18.2" rx="8" ry="2.6" />
      <ellipse cx="12" cy="13.2" rx="6" ry="2.2" />
      <ellipse cx="12" cy="8.8" rx="4" ry="1.8" />
      <path d="M10.4 4.6c.6-.8.6-1.6 0-2.4M13.6 4.6c.6-.8.6-1.6 0-2.4" />
    </>
  ),
  spa: (
    <>
      <path d="M12 3s3.5 3.8 3.5 6.3a3.5 3.5 0 0 1-7 0C8.5 6.8 12 3 12 3Z" />
      <path d="M3 16c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />
      <path d="M3 20c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />
    </>
  ),
  // A hammam's dome, with the finial a Tunisian eye expects on top.
  hammam: (
    <>
      <path d="M4.5 20.5V13a7.5 7.5 0 0 1 15 0v7.5" />
      <path d="M3 20.5h18M12 5.5V3" />
      <path d="M12 3a1.4 1.4 0 0 0 1.2.7" />
      <path d="M10 20.5V17a2 2 0 0 1 4 0v3.5" />
    </>
  ),
};

export function hasCategoryIcon(slug: string): boolean {
  return slug in PATHS;
}

export function CategoryIcon({
  slug,
  fallback,
  size = 24,
  className,
}: {
  slug: string;
  /** What the admin typed, used only when no drawing exists for this slug. */
  fallback?: string | null;
  size?: number;
  className?: string;
}) {
  const drawing = PATHS[slug];
  if (!drawing) {
    return fallback ? (
      <span className={className} aria-hidden="true">
        {fallback}
      </span>
    ) : null;
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {drawing}
    </svg>
  );
}
