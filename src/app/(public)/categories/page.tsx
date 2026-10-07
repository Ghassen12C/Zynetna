import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Eyebrow } from '@/components/ui/Primitives';
import { CategoryIcon } from '@/components/brand/CategoryIcon';
import { formatCount, localizedName } from '@/i18n/format';
import { translate } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return {
    title: m.categories.title,
    description: m.categories.metaDescription,
    alternates: { canonical: '/categories' },
  };
}

export const revalidate = 600;

export default async function CategoriesPage() {
  const { m, locale, path } = await translate();
  const categories = await db.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { position: 'asc' },
    select: {
      slug: true,
      name: true,
      nameAr: true,
      nameEn: true,
      icon: true,
      description: true,
      _count: { select: { businesses: true } },
      children: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
        select: {
          slug: true,
          name: true,
          nameAr: true,
          nameEn: true,
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
            <Eyebrow>{m.home.exploreEyebrow}</Eyebrow>
            <h1 className="z-section__title">{m.categories.title}</h1>
            <p className="z-section__lead">{m.categories.lead}</p>
          </div>
        </header>

        <div className="z-catgrid">
          {categories.map((category) => (
            <section key={category.slug} className="z-panel z-catblock">
              <Link href={path(`/search?category=${category.slug}`)} className="z-catblock__head">
                <span className="z-ctile__icon" aria-hidden="true">
                  <CategoryIcon slug={category.slug} fallback={category.icon ?? '✂'} size={28} />
                </span>
                <span>
                  <h2>{localizedName(category, locale)}</h2>
                  {/* The Arabic name doubles as a signature on the other
                      languages; on an Arabic page it would only repeat. */}
                  {locale === 'ar' ? null : (
                    <span className="z-help" lang="ar" dir="rtl">
                      {category.nameAr}
                    </span>
                  )}
                  <span className="z-help">
                    {formatCount(m.home.businessCount, category._count.businesses, locale)}
                  </span>
                </span>
              </Link>

              {category.children.length > 0 ? (
                <ul className="z-catblock__children">
                  {category.children.map((child) => (
                    <li key={child.slug}>
                      <Link href={path(`/search?category=${child.slug}`)} className="z-chip">
                        {localizedName(child, locale)}
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
