'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, type Locale } from '@/i18n/config';

/**
 * Language switcher.
 *
 * Navigates to the same page under the chosen locale's URL, so the choice is
 * shareable. French is the canonical unprefixed locale, so switching to it
 * strips the prefix rather than adding one.
 *
 * Two things make the switch take effect at once, without the visitor having
 * to reload:
 *  - the choice is written to the locale cookie first. An unprefixed URL
 *    follows that cookie, so without this, switching from English or Arabic
 *    to French landed on "/" and rendered the previous language again.
 *  - it is a full page load, not a client-side transition. The client router
 *    can reuse a page it already holds, rendered in the old language, and the
 *    root layout (lang, dir) is only rebuilt on a real load.
 */
export function LocaleSwitcher({
  current,
  label,
}: {
  current: Locale;
  /** Accessible name for the trigger, already in the current language. */
  label: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  function switchTo(locale: Locale) {
    // The middleware rewrites, so usePathname already reports the unprefixed
    // path; strip any prefix defensively.
    const bare = pathname.replace(new RegExp(`^/(${LOCALES.join('|')})(?=/|$)`), '') || '/';
    const query = params.toString();
    const target =
      (locale === DEFAULT_LOCALE ? bare : `/${locale}${bare === '/' ? '' : bare}`) +
      (query ? `?${query}` : '');

    setOpen(false);
    if (locale === current) return;
    setPending(true);
    // Same name and lifetime as the cookie the middleware sets.
    document.cookie = `zynetna_locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.assign(target);
  }

  return (
    <div className="z-locale">
      <button
        type="button"
        className="z-locale__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        disabled={pending}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M2.5 10h15M10 2.5c2 2.4 2 12.6 0 15M10 2.5c-2 2.4-2 12.6 0 15"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <span>{current.toUpperCase()}</span>
      </button>

      {open ? (
        <ul className="z-locale__menu" role="listbox">
          {LOCALES.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === current}
                className={code === current ? 'is-current' : ''}
                lang={code}
                dir={LOCALE_META[code].dir}
                onClick={() => switchTo(code)}
              >
                {LOCALE_META[code].nativeLabel}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
