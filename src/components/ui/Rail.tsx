'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/**
 * A horizontal row of cards that scrolls instead of wrapping.
 *
 * A wrapping grid strands a lone card on its last row whenever the count is
 * not a multiple of the column count, which the server cannot know. A rail
 * holds any count gracefully: it swipes on a phone and pages with buttons on
 * a desktop, and the buttons only appear when there is somewhere to go.
 */
export function Rail({
  children,
  labels,
}: {
  children: ReactNode;
  labels: { previous: string; next: string; region: string };
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const left = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: left <= 2, end: left >= max - 2 });
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  function page(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    // In RTL the scroll axis is mirrored, so "next" moves toward negative x.
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: direction * el.clientWidth * 0.85 * (rtl ? -1 : 1), behavior: 'smooth' });
  }

  const scrollable = !(edges.start && edges.end);

  return (
    <div className="z-rail" data-scrollable={scrollable}>
      <div
        ref={track}
        className="z-rail__track"
        onScroll={measure}
        role="region"
        aria-label={labels.region}
        // Focusable so a keyboard user can scroll it with the arrow keys.
        tabIndex={0}
      >
        {children}
      </div>
      {scrollable ? (
        <div className="z-rail__controls">
          <button
            type="button"
            className="z-rail__btn"
            onClick={() => page(-1)}
            disabled={edges.start}
            aria-label={labels.previous}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="z-rail__btn"
            onClick={() => page(1)}
            disabled={edges.end}
            aria-label={labels.next}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
