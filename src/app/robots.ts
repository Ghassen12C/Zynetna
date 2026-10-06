import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = env.APP_URL.replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private areas and anything behind a session carry no SEO value and
        // should never appear in an index.
        disallow: ['/account', '/pro/', '/admin', '/api/', '/login', '/register', '/reservations/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
