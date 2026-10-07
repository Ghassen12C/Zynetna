import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BusinessProfileView } from '@/components/business/BusinessProfileView';
import { proContext } from '@/components/pro/ProGuard';
import { getBusinessProfile } from '@/server/services/businessProfile';
import { db } from '@/lib/db';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.dash.preview.metaTitle, robots: { index: false } };
}

/**
 * "How customers see my business".
 *
 * Renders the exact same component and the exact same query as the public
 * page, with preview: true so a draft or suspended business is still visible
 * to its own owner. There is no second implementation to drift.
 */
export default async function PreviewPage() {
  const { businessId } = await proContext('business.read', '/pro/preview');

  const business = await db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { slug: true },
  });

  const profile = await getBusinessProfile(business.slug, { preview: true });
  if (!profile) notFound();

  return <BusinessProfileView business={profile} preview />;
}
