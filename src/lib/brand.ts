/**
 * Brand artwork shared by the interface and the demo-image generator.
 *
 * The zellige tile is the one Tunisian motif Zynetna leans on: an
 * eight-pointed star — the khatam of Nabeul ceramics and medina doorways —
 * joined to its neighbours by a fine lattice, drawn as a thin lime-wash line
 * over the brand's own gradient. It is defined once here; the CSS fallback
 * cover carries the same tile, and a test fails if the two drift apart.
 */

/** On-brand gradients only: Medina, Jasmin, Encre and Slate. No stray hues. */
export const COVER_TONES: readonly (readonly [string, string])[] = [
  ['#0E3B66', '#246A9F'], // Medina
  ['#C9913A', '#E0A94E'], // Jasmin
  ['#0A1C2E', '#16507F'], // Encre → Medina
  ['#44566B', '#7FA8C8'], // Slate
  ['#07213A', '#0E3B66'], // deep Medina
  ['#B57F2C', '#E0A94E'], // warm Jasmin
];

/** A stable tone for a business, so its fallback cover never changes colour. */
export function coverToneFor(key: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return COVER_TONES[Math.abs(hash) % COVER_TONES.length]!;
}

/** Edge of one tile, in user units. */
export const ZELLIGE_TILE = 80;

/**
 * One repeating tile: the star at the centre, a diamond where four tiles
 * meet, and the lattice lines that tie the star's points to the tile edge so
 * the repeat reads as one continuous pattern rather than a grid of stamps.
 */
export function zelligeTile(stroke = '#F5F1E8', opacity = 0.16): string {
  const c = ZELLIGE_TILE / 2;
  const r = 17; // half-side of the upright square
  const d = r * Math.SQRT2; // reach of the rotated square
  const f = (n: number) => Number(n.toFixed(2));

  // The khatam outline itself: sixteen vertices alternating between the
  // eight tips (distance d) and the eight notches between them, rather than
  // two overlapping squares, which at low opacity reads as an octagon.
  const notch = r / Math.cos(Math.PI / 8);
  const star = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const radius = i % 2 === 0 ? d : notch;
    return [c + radius * Math.cos(angle), c + radius * Math.sin(angle)];
  });
  const poly = (pts: number[][]) => `M${pts.map(([x, y]) => `${f(x!)} ${f(y!)}`).join('L')}Z`;

  const corner = 9;
  const diamonds = [
    [0, 0],
    [ZELLIGE_TILE, 0],
    [0, ZELLIGE_TILE],
    [ZELLIGE_TILE, ZELLIGE_TILE],
  ]
    .map(([x, y]) => poly([[x!, y! - corner], [x! + corner, y!], [x!, y! + corner], [x! - corner, y!]]))
    .join('');

  const lattice = [
    `M${c} ${f(c - d)}V0`,
    `M${f(c + d)} ${c}H${ZELLIGE_TILE}`,
    `M${c} ${f(c + d)}V${ZELLIGE_TILE}`,
    `M${f(c - d)} ${c}H0`,
  ].join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ZELLIGE_TILE}" height="${ZELLIGE_TILE}" viewBox="0 0 ${ZELLIGE_TILE} ${ZELLIGE_TILE}">` +
    `<g fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="1.2" stroke-linejoin="round">` +
    `<path d="${poly(star)}"/>` +
    `<circle cx="${c}" cy="${c}" r="3.2"/>` +
    `<path d="${diamonds}"/>` +
    `<path d="${lattice}"/>` +
    `</g></svg>`
  );
}

/** The tile as a CSS `url()` value. */
export function zelligeDataUri(stroke?: string, opacity?: number): string {
  return `url("data:image/svg+xml,${encodeURIComponent(zelligeTile(stroke, opacity))}")`;
}
