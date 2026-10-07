import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { MediaManager } from '@/components/pro/MediaManager';
import { proContext } from '@/components/pro/ProGuard';
import { variantUrl } from '@/server/services/media';
import { entitlementsFor } from '@/server/services/subscriptions';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.pro.gallery, robots: { index: false } };
}

export default async function GalleryPage() {
  const { m, locale } = await translate();
  const { businessId } = await proContext('business.media.manage', '/pro/dashboard/gallery');

  const [media, entitlements] = await Promise.all([
    db.businessMedia.findMany({
      where: { businessId },
      orderBy: [{ role: 'asc' }, { position: 'asc' }],
      include: { asset: true },
    }),
    entitlementsFor(businessId),
  ]);

  return (
    <MediaManager
      m={{ dashSetup: m.dashSetup, common: m.common, labels: m.labels }}
      locale={locale}
      businessId={businessId}
      maxImages={entitlements.maxGalleryImages}
      media={media.map((m) => ({
        id: m.id,
        role: m.role,
        position: m.position,
        url: variantUrl(m.asset, 'card'),
        thumbUrl: variantUrl(m.asset, 'thumb'),
        width: m.asset.width,
        height: m.asset.height,
        bytes: m.asset.bytes,
      }))}
    />
  );
}
