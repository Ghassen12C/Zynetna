import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/server/auth/guard';
import { CategoryManager } from '@/components/admin/CategoryManager';

export const metadata: Metadata = { title: 'Catégories', robots: { index: false } };

export default async function AdminCategoriesPage() {
  await requireSuperAdmin();

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
    />
  );
}
