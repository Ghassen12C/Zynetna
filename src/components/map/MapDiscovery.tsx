'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Badge, EmptyState, Rating } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import type { TileSource } from '@/server/providers/maps';
import { formatPrice } from '@/i18n/format';

type Pin = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  category: string | null;
  rating: number;
  ratingCount: number;
  verified: boolean;
  fromPrice: number | null;
  coverUrl: string | null;
};

/**
 * Map discovery.
 *
 * Tiles are fetched directly from the configured provider and positioned with
 * Web Mercator maths — a few dozen lines instead of a 150 KB mapping SDK, and
 * no vendor coupling. The tile source comes from `MapProvider`, so switching
 * to Azure Maps or Mapbox changes configuration, not this component.
 */
const TILE = 256;
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 620;

function lngToX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * TILE * 2 ** zoom;
}
function latToY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE * 2 ** zoom
  );
}

export function MapDiscovery({
  tiles,
  providerName,
  businesses,
  categories,
  cities,
  filters,
}: {
  tiles: TileSource;
  providerName: string;
  businesses: Pin[];
  categories: { slug: string; name: string }[];
  cities: { slug: string; name: string }[];
  filters: { category: string | null; city: string | null };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Pin | null>(null);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/map?${next.toString()}`));
  }

  // Frame the viewport on the pins we actually have, with Tunis as a fallback.
  const view = useMemo(() => {
    if (businesses.length === 0) {
      return { centerLat: 34.5, centerLng: 9.6, zoom: 6 };
    }
    const lats = businesses.map((b) => b.lat);
    const lngs = businesses.map((b) => b.lng);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const span = Math.max(
      Math.max(...lats) - Math.min(...lats),
      Math.max(...lngs) - Math.min(...lngs),
      0.02,
    );
    // Choose the zoom that makes the spread of pins FILL about 70% of the
    // viewport. Merely fitting the bounds leaves everything clustered in the
    // middle of an empty map, which is what "fit" looked like in practice.
    const targetPx = VIEW_WIDTH * 0.7;
    const idealZoom = Math.log2((targetPx * 360) / (TILE * span));
    const zoom = Math.max(5, Math.min(16, Math.floor(idealZoom)));
    return { centerLat, centerLng, zoom };
  }, [businesses]);

  const width = VIEW_WIDTH;
  const height = VIEW_HEIGHT;
  const { centerLat, centerLng, zoom } = view;
  const originX = lngToX(centerLng, zoom) - width / 2;
  const originY = latToY(centerLat, zoom) - height / 2;

  // Only the tiles that intersect the viewport.
  const tileList = useMemo(() => {
    const out: { x: number; y: number; left: number; top: number }[] = [];
    const max = 2 ** zoom;
    const firstX = Math.floor(originX / TILE);
    const lastX = Math.floor((originX + width) / TILE);
    const firstY = Math.floor(originY / TILE);
    const lastY = Math.floor((originY + height) / TILE);

    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = firstY; y <= lastY; y += 1) {
        if (y < 0 || y >= max) continue;
        out.push({
          x: ((x % max) + max) % max,
          y,
          left: x * TILE - originX,
          top: y * TILE - originY,
        });
      }
    }
    return out;
  }, [originX, originY, zoom]);

  function tileUrl(x: number, y: number) {
    const subdomain = tiles.subdomains?.[(x + y) % tiles.subdomains.length] ?? '';
    return tiles.urlTemplate
      .replace('{s}', subdomain)
      .replace('{z}', String(zoom))
      .replace('{x}', String(x))
      .replace('{y}', String(y));
  }

  return (
    <div className="z-mappage">
      <div className="z-container">
        <header className="z-section__head">
          <div>
            <h1 className="z-section__title">Sur la carte</h1>
            <p className="z-section__lead">
              {businesses.length} établissement{businesses.length > 1 ? 's' : ''} ·{' '}
              {tiles.attribution}
            </p>
          </div>
          <ButtonLink href="/search" variant="secondary" size="sm">
            Vue liste →
          </ButtonLink>
        </header>

        <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap', marginBottom: 'var(--z-space-4)' }}>
          <select
            className="z-select"
            style={{ width: 'auto' }}
            value={filters.category ?? ''}
            onChange={(e) => setParam('category', e.target.value || null)}
            aria-label="Catégorie"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="z-select"
            style={{ width: 'auto' }}
            value={filters.city ?? ''}
            onChange={(e) => setParam('city', e.target.value || null)}
            aria-label="Ville"
          >
            <option value="">Toute la Tunisie</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {businesses.length === 0 ? (
          <EmptyState
            title="Aucun établissement sur cette zone"
            body="Essayez une autre catégorie ou une autre ville."
          />
        ) : (
          <div className="z-map" data-provider={providerName}>
            <div className="z-map__canvas" style={{ width, height }} role="img" aria-label="Carte des établissements">
              {tileList.map((tile) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${tile.x}-${tile.y}`}
                  src={tileUrl(tile.x, tile.y)}
                  alt=""
                  width={TILE}
                  height={TILE}
                  loading="lazy"
                  className="z-map__tile"
                  style={{ left: tile.left, top: tile.top }}
                  // A tile that fails (offline, blocked, rate-limited) hides
                  // itself: the pins stay usable on the backdrop instead of
                  // the map filling with broken-image icons.
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                  }}
                />
              ))}

              {businesses.map((pin) => {
                const left = lngToX(pin.lng, zoom) - originX;
                const top = latToY(pin.lat, zoom) - originY;
                if (left < -40 || left > width + 40 || top < -60 || top > height + 40) return null;

                return (
                  <button
                    key={pin.slug}
                    type="button"
                    className={`z-map__pin ${selected?.slug === pin.slug ? 'is-selected' : ''}`}
                    style={{ left, top }}
                    onClick={() => setSelected(pin)}
                    aria-label={`${pin.name}${pin.category ? ` — ${pin.category}` : ''}`}
                  >
                    <span className="z-map__pin-label">
                      {pin.fromPrice != null ? formatPrice(pin.fromPrice) : pin.name.slice(0, 12)}
                    </span>
                  </button>
                );
              })}
            </div>

            {selected ? (
              <aside className="z-map__card">
                <button
                  type="button"
                  className="z-map__close"
                  onClick={() => setSelected(null)}
                  aria-label="Fermer"
                >
                  ×
                </button>

                {selected.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.coverUrl} alt="" className="z-map__cover" />
                ) : null}

                <div className="z-map__body">
                  <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap' }}>
                    <h2>{selected.name}</h2>
                    {selected.verified ? <Badge tone="accent">✓</Badge> : null}
                  </div>
                  <Rating value={selected.rating} count={selected.ratingCount} size={13} />
                  <p className="z-help">
                    {selected.category ? `${selected.category} · ` : ''}
                    {selected.address}
                  </p>
                  {selected.fromPrice != null ? (
                    <p className="z-bcard__price">
                      <span>à partir de</span> {formatPrice(selected.fromPrice)}
                    </p>
                  ) : null}
                  <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
                    <ButtonLink href={`/business/${selected.slug}`} size="sm">
                      Voir
                    </ButtonLink>
                    <ButtonLink href={`/business/${selected.slug}/book`} variant="secondary" size="sm">
                      Réserver
                    </ButtonLink>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        )}

        <ul className="z-maplist">
          {businesses.slice(0, 24).map((pin) => (
            <li key={pin.slug}>
              <Link href={`/business/${pin.slug}`}>
                <strong>{pin.name}</strong>
                <span className="z-help">
                  {pin.category ? `${pin.category} · ` : ''}
                  {pin.address}
                </span>
              </Link>
              <Rating value={pin.rating} count={pin.ratingCount} size={12} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
