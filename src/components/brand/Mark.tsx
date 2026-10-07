/**
 * The Zynetna mark — "the medina arch".
 *
 * The doorway of a Tunisian salon: a half circle on two straight jambs, built
 * on one 50-unit radius. The counter is a single letter read two ways — Latin
 * Z, and Arabic ز once the dot sits above it.
 *
 * Drawn, not imported: it scales to the 24 px floor without a raster asset,
 * costs no network request, and inherits colour from its container.
 */

export type MarkProps = {
  /** Rendered height in pixels. The guide's floor is 24. */
  size?: number;
  /** Arch fill. */
  tone?: string;
  /** Knockout (the Z and its dot). */
  knockout?: string;
  className?: string;
  title?: string;
};

export function Mark({
  size = 40,
  tone = 'var(--z-brand-mark)',
  knockout = 'var(--z-brand-knockout)',
  className,
  title,
}: MarkProps) {
  // viewBox 100 × 138: a 50-radius semicircle on jambs, with the soft base the
  // guide shows. Width follows from the height so the ratio never drifts.
  const width = Math.round((size * 100) / 138);
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 100 138"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M0 50a50 50 0 0 1 100 0v80a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V50Z"
        fill={tone}
      />
      {/* The dot — what turns the Z into ز. */}
      <circle cx="50" cy="42" r="7" fill={knockout} />
      {/* Geometric Z, set on the same 50-unit grid as the arch. */}
      <path
        d="M25 61h50v11L42 96h33v11H25V96l33-24H25V61Z"
        fill={knockout}
      />
    </svg>
  );
}

/** Mark + wordmark, horizontal. The primary lockup. */
export function Logo({
  size = 36,
  tone = 'var(--z-brand-mark)',
  knockout = 'var(--z-brand-knockout)',
  showTagline = false,
  className,
}: MarkProps & { showTagline?: boolean }) {
  return (
    <span className={`z-logo ${className ?? ''}`} style={{ '--logo-size': `${size}px` } as React.CSSProperties}>
      <Mark size={size} tone={tone} knockout={knockout} title="Zynetna" />
      <span className="z-logo__text">
        <span className="z-logo__word" style={{ color: tone }}>
          ZYNETNA
        </span>
        {showTagline ? (
          <span className="z-logo__tagline">BARBER &amp; BEAUTY · TUNISIE</span>
        ) : null}
      </span>
    </span>
  );
}
