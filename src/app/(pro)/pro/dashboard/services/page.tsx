import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ServicesManager } from '@/components/pro/ServicesManager';
import { proContext } from '@/components/pro/ProGuard';
import { variantUrl } from '@/server/services/media';
import { translate } from '@/i18n/server';
import { localizedName } from '@/i18n/format';
import { LOCALE_META } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.pro.services, robots: { index: false } };
}

export default async function ServicesPage() {
  const { m, locale } = await translate();
  const { businessId } = await proContext('business.service.read', '/pro/dashboard/services');

  const [services, staff, categories, business] = await Promise.all([
    db.service.findMany({
      where: { businessId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        staff: { select: { staffMemberId: true } },
        media: { take: 1, orderBy: { position: 'asc' }, include: { asset: true } },
        _count: { select: { items: true } },
        packageItems: { orderBy: { position: 'asc' }, select: { serviceId: true } },
      },
    }),
    db.staffMember.findMany({
      where: { businessId, isActive: true },
      orderBy: { position: 'asc' },
      select: { id: true, displayName: true },
    }),
    db.category.findMany({
      where: { isActive: true, parentId: { not: null } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        nameAr: true,
        nameEn: true,
        parent: { select: { name: true, nameAr: true, nameEn: true } },
      },
    }),
    db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { currency: true, maxAdvanceDays: true },
    }),
  ]);

  // Reference data carries its own translations; sort in the reader's alphabet.
  const collator = new Intl.Collator(LOCALE_META[locale].intl);
  const categoryOptions = categories
    .map((c) => ({
      id: c.id,
      label: c.parent
        ? `${localizedName(c.parent, locale)} · ${localizedName(c, locale)}`
        : localizedName(c, locale),
    }))
    .sort((a, b) => collator.compare(a.label, b.label));

  return (
    <ServicesManager
      m={{ dashSetup: m.dashSetup, common: m.common }}
      locale={locale}
      businessId={businessId}
      currency={business.currency}
      businessMaxAdvanceDays={business.maxAdvanceDays}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        categoryId: s.categoryId,
        price: Number(s.priceAmount),
        durationMinutes: s.durationMinutes,
        bufferMinutes: s.bufferMinutes,
        prepMinutes: s.prepMinutes,
        minNoticeMinutes: s.minNoticeMinutes,
        isActive: s.isActive,
        staffIds: s.staff.map((x) => x.staffMemberId),
        imageUrl: s.media[0] ? variantUrl(s.media[0].asset, 'thumb') : null,
        bookingCount: s._count.items,
        isPackage: s.isPackage,
        includedIds: s.packageItems.map((i) => i.serviceId),
        maxAdvanceDays: s.maxAdvanceDays,
        requiresConfirmation: s.requiresConfirmation,
      }))}
      staff={staff}
      categories={categoryOptions}
    />
  );
}
