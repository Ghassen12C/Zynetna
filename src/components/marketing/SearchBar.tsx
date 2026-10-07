'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Messages } from '@/i18n';
import { cueHost } from '@/lib/hostBus';

/**
 * The landing search. Submits to /search as a plain navigation, so results are
 * server-rendered, shareable and indexable rather than trapped in client state.
 *
 * Geolocation is strictly optional: the control is never required, a denial is
 * silent, and the page works identically without permission.
 */
export function SearchBar({
  cities,
  m,
  searchPath,
}: {
  cities: { slug: string; name: string }[];
  m: { search: Messages['search']; home: Messages['home'] };
  /** Locale-aware /search path, so searching does not leave the language. */
  searchPath: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(false);

  function submit(extra?: Record<string, string>) {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (city) params.set('city', city);
    for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
    // The host looks busy while the results load — it reacts to the search,
    // it does not pretend to perform it.
    cueHost({ state: 'THINKING', line: 'thinking' });
    startTransition(() => router.push(`${searchPath}?${params.toString()}`));
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        submit({
          lat: position.coords.latitude.toFixed(5),
          lng: position.coords.longitude.toFixed(5),
          sort: 'distance',
        });
      },
      // A refusal is not an error state: the form stays perfectly usable.
      () => setLocating(false),
      { timeout: 8000, maximumAge: 300_000 },
    );
  }

  return (
    <form
      className="z-searchbar"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="z-searchbar__field">
        <label className="z-sr-only" htmlFor="q">
          {m.home.searchLabel}
        </label>
        <svg className="z-searchbar__icon" width="19" height="19" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="m13.6 13.6 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="q"
          className="z-searchbar__input"
          placeholder={m.home.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Focusing the field turns the host towards the visitor; leaving it
          // lets the host settle again.
          onFocus={() => cueHost({ state: 'LISTENING', line: 'listening' })}
          onBlur={() => {
            if (!pending) cueHost({ state: 'IDLE' });
          }}
          autoComplete="off"
        />
      </div>

      <div className="z-searchbar__divider" aria-hidden="true" />

      <div className="z-searchbar__field z-searchbar__field--city">
        <label className="z-sr-only" htmlFor="city">
          {m.home.locationPlaceholder}
        </label>
        <svg className="z-searchbar__icon" width="19" height="19" viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M10 18s6-5.2 6-9.4A6 6 0 0 0 4 8.6C4 12.8 10 18 10 18Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="10" cy="8.4" r="2.1" fill="currentColor" />
        </svg>
        <select
          id="city"
          className="z-searchbar__input z-searchbar__select"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">{m.search.allTunisia}</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="z-searchbar__locate"
        onClick={useMyLocation}
        disabled={locating}
        title={m.home.useMyLocation}
      >
        {locating ? <span className="z-spinner" aria-hidden="true" /> : <span aria-hidden="true">⌖</span>}
        <span className="z-sr-only">{m.home.nearMe}</span>
      </button>

      <button type="submit" className="z-btn z-btn--primary z-btn--md z-searchbar__submit" disabled={pending}>
        {pending ? <span className="z-spinner" aria-hidden="true" /> : null}
        {m.home.search}
      </button>
    </form>
  );
}
