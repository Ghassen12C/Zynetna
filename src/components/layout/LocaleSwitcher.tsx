'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { DEFAULT_LOCALE, LOCALES, LOCALE_META, type Locale } from '@/i18n/config';

/**
 * Language switcher.
 *
 * Navigates to the same page under the chosen locale's URL, so the choice is
 * shareable and the middleware records it. French is the canonical unprefixed
 * locale, so switching to it strips the prefix rather than adding one.
 */
export function LocaleSwitcher({
  current,
  label,
}: {
  current: Locale;
  /** Accessible name for the trigger, already in the current language. */
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
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
    startTransition(() => {
      router.push(target);
      router.refresh();
    });
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
