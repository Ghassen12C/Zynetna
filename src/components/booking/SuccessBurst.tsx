'use client';

import { useEffect, useState } from 'react';

/**
 * The confirmation moment: a checkmark that draws itself, with a ring that
 * expands behind it.
 *
 * Pure SVG stroke animation — no confetti library, no canvas. It runs once,
 * and under prefers-reduced-motion the mark is simply there already.
 */
export function SuccessBurst() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setPlay(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  return (
    <div className={`z-burst ${play ? 'is-playing' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 120 120" width="96" height="96">
        <circle className="z-burst__ring" cx="60" cy="60" r="52" fill="none" strokeWidth="3" />
        <circle className="z-burst__disc" cx="60" cy="60" r="44" />
        <path
          className="z-burst__check"
          d="M38 61l15 15 29-31"
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
