/**
 * A direction-aware arrow for "next", "back" and "opens elsewhere" links.
 *
 * Unicode arrows are not mirrored by the bidi algorithm, so a literal "→"
 * still points right on an Arabic page, which there means "back". These spans
 * flip under `[dir='rtl']` (see `.z-arrow` in globals.css). Decorative: the
 * link text carries the meaning.
 */
const GLYPH = { forward: '→', back: '←', external: '↗' } as const;

export function Arrow({ to = 'forward' }: { to?: keyof typeof GLYPH }) {
  return (
    <span className="z-arrow" aria-hidden="true">
      {GLYPH[to]}
    </span>
  );
}
