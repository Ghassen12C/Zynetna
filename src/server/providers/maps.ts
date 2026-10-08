import { env } from '@/lib/env';

/**
 * Map provider abstraction.
 *
 * Business logic never names a map vendor. Switching to Azure Maps, Mapbox or
 * Google is a configuration change, and no tile SDK is bundled into the
 * application — the default provider uses OpenStreetMap tiles, which cost
 * nothing and need no key to evaluate the product.
 */
export type TileSource = {
  urlTemplate: string;
  attribution: string;
  maxZoom: number;
  /** Subdomains to round-robin, where the provider uses them. */
  subdomains?: string[];
};

export interface MapProvider {
  readonly name: string;
  tiles(): TileSource;
  /** A link that opens directions in whatever the visitor has installed. */
  directionsUrl(lat: number, lng: number, label?: string): string;
  staticMapUrl?(lat: number, lng: number, zoom: number, width: number, height: number): string;
}

function googleDirections(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

class OpenStreetMapProvider implements MapProvider {
  readonly name = 'osm';
  tiles(): TileSource {
    return {
      urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    };
  }
  /**
   * Directions open in Google Maps, which most visitors in Tunisia have on
   * their phone. A Maps URL (no key, no API call) is free to link to.
   */
  directionsUrl(lat: number, lng: number) {
    return googleDirections(lat, lng);
  }
}

class AzureMapsProvider implements MapProvider {
  readonly name = 'azure';
  tiles(): TileSource {
    return {
      urlTemplate: `https://atlas.microsoft.com/map/tile?api-version=2.0&tilesetId=microsoft.base.road&zoom={z}&x={x}&y={y}&subscription-key=${env.MAP_API_KEY ?? ''}`,
      attribution: '© Microsoft, © TomTom',
      maxZoom: 22,
    };
  }
  directionsUrl(lat: number, lng: number, label?: string) {
    return `https://www.bing.com/maps?rtp=~pos.${lat}_${lng}_${encodeURIComponent(label ?? '')}`;
  }
}

class MapboxProvider implements MapProvider {
  readonly name = 'mapbox';
  tiles(): TileSource {
    return {
      urlTemplate: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${env.MAP_API_KEY ?? ''}`,
      attribution: '© Mapbox, © OpenStreetMap',
      maxZoom: 22,
    };
  }
  directionsUrl(lat: number, lng: number) {
    return googleDirections(lat, lng);
  }
}

const PROVIDERS: Record<string, MapProvider> = {
  osm: new OpenStreetMapProvider(),
  azure: new AzureMapsProvider(),
  mapbox: new MapboxProvider(),
  // Google's map imagery may only be shown through its paid Maps JavaScript
  // API; reading its tile servers directly is against its terms. Until that
  // API is wired in, "google" keeps OpenStreetMap tiles and Google directions.
  google: new OpenStreetMapProvider(),
};

export const mapProvider: MapProvider = PROVIDERS[env.MAP_PROVIDER] ?? PROVIDERS.osm!;

/** Approximate bounds around a point, for a default viewport. */
export function boundsAround(lat: number, lng: number, km: number) {
  const latDelta = km / 111;
  const lngDelta = km / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    west: lng - lngDelta,
  };
}
