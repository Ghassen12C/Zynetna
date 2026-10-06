import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const revalidate = 3600;

/**
 * Sitemap. Only live businesses and active categories are listed — a sitemap
 * that advertises a suspended business wastes crawl budget and sends people to
 * a 404.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [businesses, categories] = await Promise.all([
    db.business.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { subscription: null },
          { subscription: { status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE'] } } },
        ],
      },
      select: { slug: true, updatedAt: true },
      take: 10_000,
    }),
    db.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const base = env.APP_URL.replace(/\/$/, '');

  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/search`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/pro`, changeFrequency: 'weekly', priority: 0.8 },
    ...categories.map((category) => ({
      url: `${base}/search?category=${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...businesses.map((business) => ({
      url: `${base}/business/${business.slug}`,
      lastModified: business.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
