import type { Metadata } from 'next';
import Link from 'next/link';
import { BusinessCard } from '@/components/business/BusinessCard';
import { EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { SearchFilters } from '@/components/search/SearchFilters';
import { listCities, searchBusinesses, topCategories } from '@/server/services/marketplace';
import { db } from '@/lib/db';
import { translate } from '@/i18n/server';
import { formatCount, localizedName } from '@/i18n/format';

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await translate();
  return { title: m.search.metaTitle, description: m.search.metaDescription };
}

type Search = {
  q?: string;
  category?: string;
  city?: string;
  rating?: string;
  maxPrice?: string;
  gender?: string;
  verified?: string;
  openNow?: string;
  sort?: string;
  lat?: string;
  lng?: string;
  page?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const { m, t, locale, path } = await translate();

  const [result, cities, categories, allCategories] = await Promise.all([
    searchBusinesses({
      q: params.q,
      categorySlug: params.category,
      citySlug: params.city,
      minRating: params.rating ? Number(params.rating) : undefined,
      maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
      servedGender:
        params.gender === 'WOMEN' || params.gender === 'MEN' ? params.gender : undefined,
      verifiedOnly: params.verified === '1',
      openNow: params.openNow === '1',
      lat: params.lat ? Number(params.lat) : undefined,
      lng: params.lng ? Number(params.lng) : undefined,
      sort: (params.sort as 'relevance' | 'rating' | 'price' | 'distance') ?? 'relevance',
      page,
    }),
    listCities(),
    topCategories(12),
    db.category.findMany({
      where: { isActive: true },
      orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
      select: { slug: true, name: true, nameAr: true, nameEn: true, parentId: true },
    }),
  ]);

  const activeCategory = categories.find((c) => c.slug === params.category);
  const activeCity = cities.find((c) => c.slug === params.city);

  const heading = params.q
    ? `« ${params.q} »`
    : activeCategory
      ? localizedName(activeCategory, locale)
      : m.search.allBusinesses;

  function pageHref(target: number): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'page') next.set(key, value);
    }
    next.set('page', String(target));
    return path(`/search?${next.toString()}`);
  }

  return (
    <div className="z-search">
      <div className="z-container">
        <header className="z-search__head">
          <div>
            <h1 className="z-search__title">{heading}</h1>
            <p className="z-search__count">
              {formatCount(m.search.resultsCount, result.total, locale)}
              {activeCity
                ? ` ${t(m.search.inCity, { city: localizedName(activeCity, locale) })}`
                : ''}
            </p>
          </div>
        </header>

        <div className="z-search__layout">
          <SearchFilters
            // Names are localised here, on the server, so the client component
            // never needs to know which columns hold translations.
            cities={cities.map((c) => ({ slug: c.slug, name: localizedName(c, locale) }))}
            categories={allCategories.map((c) => ({
              slug: c.slug,
              name: localizedName(c, locale),
              parentId: c.parentId,
            }))}
            current={params}
            total={result.total}
            m={{ search: m.search, common: m.common }}
            locale={locale}
            searchPath={path('/search')}
          />

          <div className="z-search__results">
            {result.businesses.length === 0 ? (
              <EmptyState
                title={m.search.noResults}
                body={m.search.noResultsLong}
                action={
                  <ButtonLink href={path('/search')} variant="secondary">
                    {m.search.reset}
                  </ButtonLink>
                }
              />
            ) : (
              <>
                <div className="z-grid z-grid--3">
                  {result.businesses.map((business) => (
                    <BusinessCard key={business.slug} business={business} />
                  ))}
                </div>

                {result.pageCount > 1 ? (
                  <nav className="z-pagination" aria-label={m.search.pagination}>
                    {page > 1 ? (
                      <Link href={pageHref(page - 1)} className="z-btn z-btn--secondary z-btn--sm">
                        ← {m.common.previous}
                      </Link>
                    ) : null}
                    <span className="z-pagination__state">
                      {t(m.search.pageState, { page, total: result.pageCount })}
                    </span>
                    {page < result.pageCount ? (
                      <Link href={pageHref(page + 1)} className="z-btn z-btn--secondary z-btn--sm">
                        {m.common.next} →
                      </Link>
                    ) : null}
                  </nav>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
