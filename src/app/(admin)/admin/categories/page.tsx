import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/server/auth/guard';
import { CategoryManager } from '@/components/admin/CategoryManager';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.admin.nav.categories, robots: { index: false } };
}

export default async function AdminCategoriesPage() {
  await requireSuperAdmin();
  const { m, locale } = await translate();

  const categories = await db.category.findMany({
    orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
    select: {
      id: true, parentId: true, slug: true, name: true, nameAr: true, nameEn: true,
      icon: true, servedGender: true, position: true, isActive: true,
      _count: { select: { businesses: true, services: true, children: true } },
    },
  });

  return (
    <CategoryManager
      categories={categories.map((c) => ({
        id: c.id,
        parentId: c.parentId,
        slug: c.slug,
        name: c.name,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        icon: c.icon,
        servedGender: c.servedGender,
        position: c.position,
        isActive: c.isActive,
        businesses: c._count.businesses,
        services: c._count.services,
        children: c._count.children,
      }))}
      m={{ admin: m.admin, labels: m.labels, common: m.common }}
      locale={locale}
    />
  );
}
