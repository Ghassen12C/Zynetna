import type { Metadata, Viewport } from 'next';
import { Epilogue, Tajawal } from 'next/font/google';
import '@/styles/globals.css';
import '@/styles/areas/dash.css';
import '@/styles/areas/dashSetup.css';
import '@/styles/areas/admin.css';
import '@/styles/areas/public.css';
import { env } from '@/lib/env';
import { LOCALE_META, LOCALES } from '@/i18n/config';
import { translate } from '@/i18n/server';
import { UiTextProvider } from '@/components/ui/UiText';

/**
 * Fonts from the brand guide, self-hosted by next/font at build time: no
 * runtime request to a third party, no layout shift, and a subset small enough
 * for Tunisian mobile data.
 */
const epilogue = Epilogue({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-epilogue',
  display: 'swap',
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
  display: 'swap',
});

const OG_LOCALE = { fr: 'fr_TN', ar: 'ar_TN', en: 'en_US' } as const;

export async function generateMetadata(): Promise<Metadata> {
  const { m, locale } = await translate();
  const title = `${m.brand.name} — ${m.brand.descriptor}`;

  return {
    metadataBase: new URL(env.APP_URL),
    title: {
      default: title,
      template: `%s · ${m.brand.name}`,
    },
    description: m.home.metaDescription,
    applicationName: m.brand.name,
    openGraph: {
      type: 'website',
      siteName: m.brand.name,
      locale: OG_LOCALE[locale],
      title,
      description: m.brand.tagline,
    },
    twitter: { card: 'summary_large_image' },
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((code) => [
          LOCALE_META[code].intl,
          code === 'fr' ? '/' : `/${code}`,
        ]),
      ),
    },
    robots: { index: true, follow: true },
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/apple-icon.png' }],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F1E8' },
    { media: '(prefers-color-scheme: dark)', color: '#08192B' },
  ],
};

/**
 * Mirrors the system colour scheme onto <html data-theme> before first paint.
 *
 * The colour tokens already follow `prefers-color-scheme`, but component-level
 * dark adjustments are written against `[data-theme='dark']`; without this
 * they never applied to visitors in system dark mode. Runs inline in <head>
 * so the page never flashes the wrong theme, and follows the setting live.
 * The attribute is set outside React, hence suppressHydrationWarning on <html>.
 */
const THEME_SCRIPT = `(function(){try{var d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');var s=function(){d.setAttribute('data-theme',m.matches?'dark':'light')};s();m.addEventListener('change',s)}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // lang and dir come from the resolved locale, so Arabic genuinely renders
  // right-to-left and the Arabic typeface switches via :lang(ar).
  const { locale, m, dir } = await translate();

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${epilogue.variable} ${tajawal.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="z-skip-link" href="#main">
          {m.common.skipToContent}
        </a>
        <UiTextProvider value={{ locale, ui: m.labels.ui }}>{children}</UiTextProvider>
      </body>
    </html>
  );
}
