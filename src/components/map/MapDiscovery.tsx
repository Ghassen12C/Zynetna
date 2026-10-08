'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Badge, EmptyState, Rating } from '@/components/ui/Primitives';
import { ButtonLink } from '@/components/ui/Button';
import type { TileSource } from '@/server/providers/maps';
import { Arrow } from '@/components/ui/Arrow';
import { localePath, type Locale } from '@/i18n/config';
import { formatCount, formatPrice } from '@/i18n/format';
import type { Messages } from '@/i18n';

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
/** Height a price pin takes above its point, so none is cut off at the top. */
const PIN_HEIGHT = 40;

/** The canvas follows its frame: full width, a height that suits the width. */
function canvasSize(frameWidth: number) {
  const width = Math.max(280, Math.round(frameWidth));
  const height = Math.round(Math.min(620, Math.max(380, width * 0.62)));
  return { width, height };
}

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
  m,
  locale,
  mapPath,
}: {
  tiles: TileSource;
  providerName: string;
  businesses: Pin[];
  categories: { slug: string; name: string }[];
  cities: { slug: string; name: string }[];
  filters: { category: string | null; city: string | null };
  m: {
    map: Messages['map'];
    search: Messages['search'];
    home: Messages['home'];
    business: Messages['business'];
    common: Messages['common'];
  };
  locale: Locale;
  /** Locale-aware /map path, so a filter does not leave the language. */
  mapPath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Pin | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // Server render and first paint use a desktop size; the frame then reports
  // its real width (and again on rotation or resize).
  const [{ width, height }, setSize] = useState(() => canvasSize(1000));
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setSize(canvasSize(frame.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`${mapPath}?${next.toString()}`));
  }

  // Frame the viewport on the pins we actually have; the whole country when
  // there are none. The zoom is the closest one at which every pin fits with
  // a margin, measured in pixels on both axes (a degree of latitude and one
  // of longitude are not the same size on the map).
  const view = useMemo(() => {
    if (businesses.length === 0) {
      return { centerLat: 34.5, centerLng: 9.6, zoom: width < 600 ? 5 : 6 };
    }
    const lats = businesses.map((b) => b.lat);
    const lngs = businesses.map((b) => b.lng);
    const north = Math.max(...lats);
    const south = Math.min(...lats);
    const east = Math.max(...lngs);
    const west = Math.min(...lngs);

    let zoom = 16;
    while (zoom > 5) {
      const spanX = lngToX(east, zoom) - lngToX(west, zoom);
      const spanY = latToY(south, zoom) - latToY(north, zoom);
      if (spanX <= width * 0.8 && spanY + PIN_HEIGHT <= height * 0.78) break;
      zoom -= 1;
    }
    return { centerLat: (north + south) / 2, centerLng: (east + west) / 2, zoom };
  }, [businesses, width, height]);

  const { centerLat, centerLng, zoom } = view;
  const originX = lngToX(centerLng, zoom) - width / 2;
  // Pins stand above their point, so the frame sits a little lower.
  const originY = latToY(centerLat, zoom) - height / 2 - PIN_HEIGHT / 2;

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
  }, [originX, originY, zoom, width, height]);

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
            <h1 className="z-section__title">{m.map.title}</h1>
            <p className="z-section__lead">
              {formatCount(m.home.businessCount, businesses.length, locale)} ·{' '}
              <bdi>{tiles.attribution}</bdi>
            </p>
          </div>
          <ButtonLink href={localePath(locale, '/search')} variant="secondary" size="sm">
            {m.map.listView} <Arrow />
          </ButtonLink>
        </header>

        <div className="z-row" style={{ gap: 'var(--z-space-2)', flexWrap: 'wrap', marginBottom: 'var(--z-space-4)' }}>
          <select
            className="z-select"
            style={{ width: 'auto' }}
            value={filters.category ?? ''}
            onChange={(e) => setParam('category', e.target.value || null)}
            aria-label={m.search.category}
          >
            <option value="">{m.map.allCategories}</option>
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
            aria-label={m.search.city}
          >
            <option value="">{m.search.allTunisia}</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {businesses.length === 0 ? (
          <EmptyState title={m.map.emptyTitle} body={m.map.emptyBody} />
        ) : (
          <div className="z-map" data-provider={providerName} ref={frameRef}>
            <div className="z-map__canvas" style={{ width, height }} role="img" aria-label={m.map.canvasLabel}>
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
                      {pin.fromPrice != null ? formatPrice(pin.fromPrice, locale) : pin.name.slice(0, 12)}
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
                  aria-label={m.common.close}
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
                    {selected.verified ? (
                      <Badge tone="accent">
                        <span aria-hidden="true">✓</span>
                        <span className="z-sr-only">{m.business.verified}</span>
                      </Badge>
                    ) : null}
                  </div>
                  <Rating value={selected.rating} count={selected.ratingCount} size={13} />
                  <p className="z-help">
                    {selected.category ? `${selected.category} · ` : ''}
                    {selected.address}
                  </p>
                  {selected.fromPrice != null ? (
                    <p className="z-bcard__price">
                      <span>{m.business.from}</span> {formatPrice(selected.fromPrice, locale)}
                    </p>
                  ) : null}
                  <div className="z-row" style={{ gap: 'var(--z-space-2)' }}>
                    <ButtonLink href={localePath(locale, `/business/${selected.slug}`)} size="sm">
                      {m.map.view}
                    </ButtonLink>
                    <ButtonLink
                      href={localePath(locale, `/business/${selected.slug}/book`)}
                      variant="secondary"
                      size="sm"
                    >
                      {m.business.book}
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
              <Link href={localePath(locale, `/business/${pin.slug}`)}>
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
