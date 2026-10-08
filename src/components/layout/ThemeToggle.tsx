'use client';

import { useState } from 'react';
import { THEME_COLOR, THEME_COOKIE, type Theme } from '@/lib/theme';

/**
 * Light / dark switch. Flips <html data-theme> at once and stores the choice
 * in a cookie for a year, so the server renders the same theme next time.
 * The icon shows the theme you would switch to.
 */
export function ThemeToggle({
  initial,
  labels,
}: {
  initial: Theme;
  labels: { toDark: string; toLight: string };
}) {
  const [theme, setTheme] = useState<Theme>(initial);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? labels.toDark : labels.toLight;

  function toggle() {
    document.documentElement.setAttribute('data-theme', next);
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[next]);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="z-theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {next === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
