import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import '@/styles/globals.css';
import '@/styles/areas/dash.css';
import '@/styles/areas/dashSetup.css';
import '@/styles/areas/admin.css';
import '@/styles/areas/public.css';
import { env } from '@/lib/env';
import { LOCALE_META, LOCALES } from '@/i18n/config';
import { translate } from '@/i18n/server';
import { UiTextProvider } from '@/components/ui/UiText';
import { THEME_COLOR, THEME_COOKIE, themeFrom } from '@/lib/theme';

/**
 * Fonts from the brand guide, shipped with the app from npm (@fontsource):
 * no request to a third party at runtime, and none at build time either, so a
 * deploy never fails because a font server did not answer. Each file carries
 * one alphabet (unicode-range), so a phone downloads Arabic glyphs only for
 * Arabic text.
 */
import '@fontsource/epilogue/400.css';
import '@fontsource/epilogue/500.css';
import '@fontsource/epilogue/600.css';
import '@fontsource/epilogue/700.css';
import '@fontsource/epilogue/800.css';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';

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

export async function generateViewport(): Promise<Viewport> {
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  return { width: 'device-width', initialScale: 1, themeColor: THEME_COLOR[theme] };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // lang and dir come from the resolved locale, so Arabic genuinely renders
  // right-to-left and the Arabic typeface switches via :lang(ar).
  const { locale, m, dir } = await translate();
  // The visitor's own choice (header toggle); light unless they picked dark.
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={theme}
    >
      <body>
        <a className="z-skip-link" href="#main">
          {m.common.skipToContent}
        </a>
        <UiTextProvider value={{ locale, ui: m.labels.ui }}>{children}</UiTextProvider>
      </body>
    </html>
  );
}
