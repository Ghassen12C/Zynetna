'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import type { Locale, Messages } from '@/i18n';
import { formatCount, formatPrice, interpolate } from '@/i18n';

/**
 * Filters.
 *
 * State lives in the URL, not in React: a filtered result is shareable,
 * bookmarkable, indexable and survives the back button. On desktop this is a
 * sidebar; on mobile it becomes a bottom sheet, which is the pattern that
 * actually works on a phone.
 */
type Category = { slug: string; name: string; parentId: string | null };
type City = { slug: string; name: string };

export function SearchFilters({
  cities,
  categories,
  current,
  total,
  m,
  locale,
  searchPath,
}: {
  cities: City[];
  categories: Category[];
  current: Record<string, string | undefined>;
  total: number;
  /** Only the slices this component renders, not the whole dictionary. */
  m: { search: Messages['search']; common: Messages['common'] };
  locale: Locale;
  /** Locale-aware /search path, so a filter does not leave the language. */
  searchPath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      next.delete('page');
      startTransition(() => router.push(`${searchPath}?${next.toString()}`));
    },
    [params, router, searchPath],
  );

  const roots = categories.filter((c) => c.parentId === null);
  const activeCount = ['category', 'city', 'rating', 'maxPrice', 'gender', 'verified', 'openNow']
    .filter((k) => current[k])
    .length;

  const body = (
    <div className="z-filters__body">
      <div className="z-filters__group">
        <h3>{m.search.category}</h3>
        <div className="z-filters__chips">
          <button
            type="button"
            className={`z-chip ${!current.category ? 'z-chip--active' : ''}`}
            onClick={() => setParam('category', null)}
          >
            {m.search.all}
          </button>
          {roots.map((category) => (
            <button
              key={category.slug}
              type="button"
              className={`z-chip ${current.category === category.slug ? 'z-chip--active' : ''}`}
              onClick={() => setParam('category', category.slug)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="z-filters__group">
        <h3>{m.search.city}</h3>
        <select
          className="z-select"
          value={current.city ?? ''}
          onChange={(e) => setParam('city', e.target.value || null)}
        >
          <option value="">{m.search.allTunisia}</option>
          {cities.map((city) => (
            <option key={city.slug} value={city.slug}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      <div className="z-filters__group">
        <h3>{m.search.minRating}</h3>
        <div className="z-filters__chips">
          {[null, 3, 4, 4.5].map((value) => (
            <button
              key={String(value)}
              type="button"
              className={`z-chip ${
                (current.rating ?? '') === (value === null ? '' : String(value))
                  ? 'z-chip--active'
                  : ''
              }`}
              onClick={() => setParam('rating', value === null ? null : String(value))}
            >
              {value === null
                ? m.search.all
                : interpolate(m.search.ratingAndUp, { rating: value })}
            </button>
          ))}
        </div>
      </div>

      <div className="z-filters__group">
        <h3>{m.search.maxBudget}</h3>
        <div className="z-filters__chips">
          {[null, 25, 50, 100].map((value) => (
            <button
              key={String(value)}
              type="button"
              className={`z-chip ${
                (current.maxPrice ?? '') === (value === null ? '' : String(value))
                  ? 'z-chip--active'
                  : ''
              }`}
              onClick={() => setParam('maxPrice', value === null ? null : String(value))}
            >
              {value === null
                ? m.search.allMasc
                : interpolate(m.search.upTo, { price: formatPrice(value, locale) })}
            </button>
          ))}
        </div>
      </div>

      <div className="z-filters__group">
        <h3>{m.search.servedGender}</h3>
        <div className="z-filters__chips">
          {[
            { value: null, label: m.search.everyone },
            { value: 'WOMEN', label: m.search.women },
            { value: 'MEN', label: m.search.men },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={`z-chip ${
                (current.gender ?? '') === (option.value ?? '') ? 'z-chip--active' : ''
              }`}
              onClick={() => setParam('gender', option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="z-filters__group">
        <h3>{m.search.other}</h3>
        <label className="z-check">
          <input
            type="checkbox"
            checked={current.verified === '1'}
            onChange={(e) => setParam('verified', e.target.checked ? '1' : null)}
          />
          <span>{m.search.verifiedOnly}</span>
        </label>
        <label className="z-check">
          <input
            type="checkbox"
            checked={current.openNow === '1'}
            onChange={(e) => setParam('openNow', e.target.checked ? '1' : null)}
          />
          <span>{m.search.openNow}</span>
        </label>
      </div>

      <div className="z-filters__group">
        <h3>{m.search.sortBy}</h3>
        <select
          className="z-select"
          value={current.sort ?? 'relevance'}
          onChange={(e) => setParam('sort', e.target.value === 'relevance' ? null : e.target.value)}
        >
          <option value="relevance">{m.search.sortRelevance}</option>
          <option value="rating">{m.search.sortRating}</option>
          <option value="price">{m.search.sortPriceAsc}</option>
          {current.lat ? <option value="distance">{m.search.sortDistance}</option> : null}
        </select>
      </div>

      {activeCount > 0 ? (
        <Button
          variant="ghost"
          block
          onClick={() => startTransition(() => router.push(searchPath))}
        >
          {interpolate(m.search.clearFiltersCount, { count: activeCount })}
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="z-filters__toggle z-btn z-btn--secondary z-btn--md"
        onClick={() => setOpen(true)}
      >
        {activeCount > 0
          ? interpolate(m.search.filtersCount, { count: activeCount })
          : m.search.filters}
      </button>

      <aside className={`z-filters ${pending ? 'is-pending' : ''}`} aria-label={m.search.filters}>
        {body}
      </aside>

      {open ? (
        <div className="z-sheet" role="dialog" aria-modal="true" aria-label={m.search.filters}>
          <div className="z-sheet__backdrop" onClick={() => setOpen(false)} />
          <div className="z-sheet__panel">
            <header className="z-sheet__head">
              <h2>{m.search.filters}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={m.common.close}>
                ×
              </button>
            </header>
            <div className="z-sheet__content">{body}</div>
            <footer className="z-sheet__foot">
              <Button block onClick={() => setOpen(false)}>
                {formatCount(m.search.seeResults, total, locale)}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
