import type { Metadata } from 'next';
import Link from 'next/link';
import { BusinessCard } from '@/components/business/BusinessCard';
import { EmptyState } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import { SearchFilters } from '@/components/search/SearchFilters';
import { listCities, searchBusinesses, topCategories } from '@/server/services/marketplace';
import { db } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Rechercher',
  description:
    'Trouvez un coiffeur, un barbier, un institut de beauté ou un spa près de chez vous en Tunisie.',
};

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
      select: { slug: true, name: true, parentId: true },
    }),
  ]);

  const activeCategory = categories.find((c) => c.slug === params.category);
  const activeCity = cities.find((c) => c.slug === params.city);

  const heading = params.q
    ? `« ${params.q} »`
    : activeCategory
      ? activeCategory.name
      : 'Tous les établissements';

  function pageHref(target: number): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'page') next.set(key, value);
    }
    next.set('page', String(target));
    return `/search?${next.toString()}`;
  }

  return (
    <div className="z-search">
      <div className="z-container">
        <header className="z-search__head">
          <div>
            <h1 className="z-search__title">{heading}</h1>
            <p className="z-search__count">
              {result.total} établissement{result.total > 1 ? 's' : ''}
              {activeCity ? ` à ${activeCity.name}` : ''}
            </p>
          </div>
        </header>

        <div className="z-search__layout">
          <SearchFilters
            cities={cities}
            categories={allCategories}
            current={params}
            total={result.total}
          />

          <div className="z-search__results">
            {result.businesses.length === 0 ? (
              <EmptyState
                title="Aucun établissement ne correspond"
                body="Essayez d’élargir votre recherche, de retirer un filtre, ou de choisir une autre ville."
                action={
                  <ButtonLink href="/search" variant="secondary">
                    Réinitialiser la recherche
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
                  <nav className="z-pagination" aria-label="Pagination">
                    {page > 1 ? (
                      <Link href={pageHref(page - 1)} className="z-btn z-btn--secondary z-btn--sm">
                        ← Précédent
                      </Link>
                    ) : null}
                    <span className="z-pagination__state">
                      Page {page} sur {result.pageCount}
                    </span>
                    {page < result.pageCount ? (
                      <Link href={pageHref(page + 1)} className="z-btn z-btn--secondary z-btn--sm">
                        Suivant →
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
