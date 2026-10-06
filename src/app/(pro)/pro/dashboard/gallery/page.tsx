import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { MediaManager } from '@/components/pro/MediaManager';
import { proContext } from '@/components/pro/ProGuard';
import { variantUrl } from '@/server/services/media';
import { entitlementsFor } from '@/server/services/subscriptions';

export const metadata: Metadata = { title: 'Photos', robots: { index: false } };

export default async function GalleryPage() {
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
