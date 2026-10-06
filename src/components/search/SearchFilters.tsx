'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';

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
}: {
  cities: City[];
  categories: Category[];
  current: Record<string, string | undefined>;
  total: number;
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
      startTransition(() => router.push(`/search?${next.toString()}`));
    },
    [params, router],
  );

  const roots = categories.filter((c) => c.parentId === null);
  const activeCount = ['category', 'city', 'rating', 'maxPrice', 'gender', 'verified', 'openNow']
    .filter((k) => current[k])
    .length;

  const body = (
    <div className="z-filters__body">
      <div className="z-filters__group">
        <h3>Catégorie</h3>
        <div className="z-filters__chips">
          <button
            type="button"
            className={`z-chip ${!current.category ? 'z-chip--active' : ''}`}
            onClick={() => setParam('category', null)}
          >
            Toutes
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
        <h3>Ville</h3>
        <select
          className="z-select"
          value={current.city ?? ''}
          onChange={(e) => setParam('city', e.target.value || null)}
        >
          <option value="">Toute la Tunisie</option>
          {cities.map((city) => (
            <option key={city.slug} value={city.slug}>
              {city.name}
            </option>
          ))}
        </select>
      </div>

      <div className="z-filters__group">
        <h3>Note minimum</h3>
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
              {value === null ? 'Toutes' : `${value}★ et +`}
            </button>
          ))}
        </div>
      </div>

      <div className="z-filters__group">
        <h3>Budget maximum</h3>
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
              {value === null ? 'Tous' : `≤ ${value} DT`}
            </button>
          ))}
        </div>
      </div>

      <div className="z-filters__group">
        <h3>Pour</h3>
        <div className="z-filters__chips">
          {[
            { value: null, label: 'Tout le monde' },
            { value: 'WOMEN', label: 'Femmes' },
            { value: 'MEN', label: 'Hommes' },
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
        <h3>Autres</h3>
        <label className="z-check">
          <input
            type="checkbox"
            checked={current.verified === '1'}
            onChange={(e) => setParam('verified', e.target.checked ? '1' : null)}
          />
          <span>Établissements vérifiés uniquement</span>
        </label>
        <label className="z-check">
          <input
            type="checkbox"
            checked={current.openNow === '1'}
            onChange={(e) => setParam('openNow', e.target.checked ? '1' : null)}
          />
          <span>Ouvert maintenant</span>
        </label>
      </div>

      <div className="z-filters__group">
        <h3>Trier par</h3>
        <select
          className="z-select"
          value={current.sort ?? 'relevance'}
          onChange={(e) => setParam('sort', e.target.value === 'relevance' ? null : e.target.value)}
        >
          <option value="relevance">Pertinence</option>
          <option value="rating">Mieux notés</option>
          <option value="price">Prix croissant</option>
          {current.lat ? <option value="distance">Distance</option> : null}
        </select>
      </div>

      {activeCount > 0 ? (
        <Button
          variant="ghost"
          block
          onClick={() => startTransition(() => router.push('/search'))}
        >
          Tout effacer ({activeCount})
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
        Filtres{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      <aside className={`z-filters ${pending ? 'is-pending' : ''}`} aria-label="Filtres">
        {body}
      </aside>

      {open ? (
        <div className="z-sheet" role="dialog" aria-modal="true" aria-label="Filtres">
          <div className="z-sheet__backdrop" onClick={() => setOpen(false)} />
          <div className="z-sheet__panel">
            <header className="z-sheet__head">
              <h2>Filtres</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer">
                ×
              </button>
            </header>
            <div className="z-sheet__content">{body}</div>
            <footer className="z-sheet__foot">
              <Button block onClick={() => setOpen(false)}>
                Voir {total} résultat{total > 1 ? 's' : ''}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
