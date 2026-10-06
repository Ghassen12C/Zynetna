import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, type Locale, isLocale } from './config';
import { type Messages, messagesFor } from './index';

/**
 * Resolve the active locale for a server render.
 *
 * The middleware puts it in a request header; the cookie is the fallback for
 * anything the middleware did not touch. Pure read — never a side effect.
 */
export async function getLocale(): Promise<Locale> {
  const headerList = await headers();
  const fromHeader = headerList.get('x-zynetna-locale');
  if (fromHeader && isLocale(fromHeader)) return fromHeader;

  const store = await cookies();
  const fromCookie = store.get('zynetna_locale')?.value;
  if (fromCookie && isLocale(fromCookie)) return fromCookie;

  return DEFAULT_LOCALE;
}

export type Translation = {
  locale: Locale;
  m: Messages;
  dir: 'ltr' | 'rtl';
  /** Prefix a path with the locale, leaving the default locale unprefixed. */
  path: (href: string) => string;
};

/** The one call a server component makes to render in the visitor's language. */
export async function translate(): Promise<Translation> {
  const locale = await getLocale();
  const { LOCALE_META } = await import('./config');

  return {
    locale,
    m: messagesFor(locale),
    dir: LOCALE_META[locale].dir,
    path: (href: string) =>
      locale === DEFAULT_LOCALE ? href : `/${locale}${href === '/' ? '' : href}`,
  };
}
