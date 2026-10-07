import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES, DEFAULT_LOCALE, negotiateLocale } from '@/i18n/config';

/**
 * Locale routing.
 *
 * `/ar/business/x` is rewritten to `/business/x` with the locale carried in a
 * request header and a cookie. Every route therefore keeps its single
 * implementation — no 47-route restructure — while each language still has its
 * own URL, which is what hreflang and sharing need.
 *
 * The default locale (French) is served unprefixed, so the canonical Tunisian
 * URL stays `/business/x` rather than `/fr/business/x`.
 */
export const LOCALE_COOKIE = 'zynetna_locale';
export const LOCALE_HEADER = 'x-zynetna-locale';

const PREFIXED = new RegExp(`^/(${LOCALES.join('|')})(/.*)?$`);

/** Paths that never need a locale and should not pay for this work. */
function isExempt(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/media/') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/icon.svg' ||
    pathname === '/favicon.ico'
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // One canonical origin: www.zynetna.tn answers with a permanent redirect to
  // zynetna.tn, so links, SEO and the host-only session cookie all agree on a
  // single host. Built from the Host header because behind App Service the
  // request URL the server sees is the internal one.
  const host = request.headers.get('host') ?? '';
  if (host.startsWith('www.')) {
    return NextResponse.redirect(`https://${host.slice(4)}${pathname}${search}`, 308);
  }
  if (isExempt(pathname)) return NextResponse.next();

  const match = PREFIXED.exec(pathname);

  if (match) {
    const locale = match[1] as (typeof LOCALES)[number];
    const rest = match[2] ?? '/';

    // French is the canonical unprefixed locale; redirect /fr/... to /...
    // so the same page never exists at two URLs.
    if (locale === DEFAULT_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = rest;
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    url.pathname = rest;

    const response = NextResponse.rewrite(url, {
      request: { headers: new Headers({ ...Object.fromEntries(request.headers), [LOCALE_HEADER]: locale }) },
    });
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return response;
  }

  // Unprefixed: honour a previously chosen locale, else the browser's
  // preference, else French. A choice already made always wins.
  const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    chosen && (LOCALES as readonly string[]).includes(chosen)
      ? chosen
      : negotiateLocale(request.headers.get('accept-language'));

  // Someone whose locale is not French lands on their own URL, so the page
  // they share carries the language they read it in.
  if (locale !== DEFAULT_LOCALE && !request.cookies.has(LOCALE_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(request.headers), [LOCALE_HEADER]: locale }) },
  });
  if (!chosen) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
