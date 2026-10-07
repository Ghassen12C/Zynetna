import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Eyebrow } from '@/components/ui/Primitives';
import { CategoryIcon } from '@/components/brand/CategoryIcon';

export const metadata: Metadata = {
  title: 'Toutes les catégories',
  description:
    'Coiffure, barbier, ongles, esthétique, bien-être — explorez tous les services de beauté et de bien-être disponibles en Tunisie sur Zynetna.',
  alternates: { canonical: '/categories' },
};

export const revalidate = 600;

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { position: 'asc' },
    select: {
      slug: true,
      name: true,
      nameAr: true,
      icon: true,
      description: true,
      _count: { select: { businesses: true } },
      children: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
        select: {
          slug: true,
          name: true,
          _count: { select: { services: true } },
        },
      },
    },
  });

  return (
    <div className="z-section">
      <div className="z-container">
        <header className="z-section__head">
          <div>
            <Eyebrow>Explorer</Eyebrow>
            <h1 className="z-section__title">Toutes les catégories</h1>
            <p className="z-section__lead">
              Du barbier de quartier au spa en bord de mer — trouvez le professionnel qu’il
              vous faut.
            </p>
          </div>
        </header>

        <div className="z-catgrid">
          {categories.map((category) => (
            <section key={category.slug} className="z-panel z-catblock">
              <Link href={`/search?category=${category.slug}`} className="z-catblock__head">
                <span className="z-ctile__icon" aria-hidden="true">
                  <CategoryIcon slug={category.slug} fallback={category.icon ?? '✂'} size={28} />
                </span>
                <span>
                  <h2>{category.name}</h2>
                  <span className="z-help" lang="ar" dir="rtl">
                    {category.nameAr}
                  </span>
                  <span className="z-help">
                    {category._count.businesses} établissement
                    {category._count.businesses > 1 ? 's' : ''}
                  </span>
                </span>
              </Link>

              {category.children.length > 0 ? (
                <ul className="z-catblock__children">
                  {category.children.map((child) => (
                    <li key={child.slug}>
                      <Link href={`/search?category=${child.slug}`} className="z-chip">
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
