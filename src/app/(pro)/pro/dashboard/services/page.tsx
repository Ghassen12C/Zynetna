import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { ServicesManager } from '@/components/pro/ServicesManager';
import { proContext } from '@/components/pro/ProGuard';
import { variantUrl } from '@/server/services/media';

export const metadata: Metadata = { title: 'Prestations', robots: { index: false } };

export default async function ServicesPage() {
  const { businessId } = await proContext('business.service.read', '/pro/dashboard/services');

  const [services, staff, categories, business] = await Promise.all([
    db.service.findMany({
      where: { businessId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        staff: { select: { staffMemberId: true } },
        media: { take: 1, orderBy: { position: 'asc' }, include: { asset: true } },
        _count: { select: { items: true } },
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
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
    db.business.findUniqueOrThrow({ where: { id: businessId }, select: { currency: true } }),
  ]);

  return (
    <ServicesManager
      businessId={businessId}
      currency={business.currency}
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
      }))}
      staff={staff}
      categories={categories.map((c) => ({
        id: c.id,
        label: c.parent ? `${c.parent.name} · ${c.name}` : c.name,
      }))}
    />
  );
}
