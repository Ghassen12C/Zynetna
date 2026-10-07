/**
 * Whether a horizontal scroller sits at either end of its run.
 *
 * `scrollLeft` runs negative in RTL, so only its magnitude is compared; the
 * two-pixel slack absorbs sub-pixel rounding at fractional zoom levels.
 */
export function scrollEdges(el: HTMLElement): { atStart: boolean; atEnd: boolean } {
  const left = Math.abs(el.scrollLeft);
  const max = el.scrollWidth - el.clientWidth;
  return { atStart: left <= 2, atEnd: left >= max - 2 };
}
