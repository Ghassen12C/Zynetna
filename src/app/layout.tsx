import type { Metadata, Viewport } from 'next';
import { Epilogue, Tajawal } from 'next/font/google';
import '@/styles/globals.css';
import { env } from '@/lib/env';

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

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: 'Zynetna — Barber & Beauty · Tunisie',
    template: '%s · Zynetna',
  },
  description:
    'Trouvez et réservez un coiffeur, un barbier, un institut de beauté ou un spa partout en Tunisie. Réservation en ligne, en quelques secondes.',
  applicationName: 'Zynetna',
  openGraph: {
    type: 'website',
    siteName: 'Zynetna',
    locale: 'fr_TN',
    title: 'Zynetna — Barber & Beauty · Tunisie',
    description: 'Réserve ta chaise. Réserve ton éclat.',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F1E8' },
    { media: '(prefers-color-scheme: dark)', color: '#08192B' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" className={`${epilogue.variable} ${tajawal.variable}`}>
      <body>
        <a className="z-skip-link" href="#main">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
