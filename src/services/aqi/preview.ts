import { AQI_SOURCES, getAqiSource } from './registry';
import type { AqiPreview, AqiSource, AqiSourceId } from './types';
import { AQI_SCALE_MAX, categoryFor, type AqiIndex } from './scale';
import { fetchJsonWithTimeout } from '../providers/http';
import { fetchAqicnFeed } from './aqicn';

export const AQI_PREVIEW_TTL_MS = 10 * 60 * 1000;
const CITY_LIST_TTL_MS = 60 * 60 * 1000;
/** atmos.today only publishes a fixed city list; ignore matches further away than this. */
const MAX_CITY_DISTANCE_KM = 75;

export type AqiPreviewMap = Record<AqiSourceId, AqiPreview | null>;

interface CacheEntry {
  ts: number;
  data: AqiPreviewMap;
}

interface AtmosCity {
  name: string;
  country: string;
  lat: number;
  lon: number;
  aqi: number | null;
  category: string | null;
  pm25: number | null;
  pm10: number | null;
  updatedAt: string | null;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<AqiPreviewMap>>();
let atmosCities: { ts: number; cities: AtmosCity[] } | null = null;
let atmosCitiesInFlight: Promise<AtmosCity[]> | null = null;

function unavailable(index: AqiIndex, reason: string): AqiPreview {
  return {
    aqi: null,
    index,
    scaleMax: AQI_SCALE_MAX[index],
    category: null,
    color: null,
    pm2_5: null,
    pm10: null,
    isUnavailable: true,
    reason,
  };
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

export function emptyAqiPreviewMap(): AqiPreviewMap {
  const map = {} as AqiPreviewMap;
  for (const source of AQI_SOURCES) map[source.id] = null;
  return map;
}

/** Great-circle distance in kilometres. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchAtmosCities(): Promise<AtmosCity[]> {
  if (atmosCities && Date.now() - atmosCities.ts < CITY_LIST_TTL_MS) return atmosCities.cities;
  if (atmosCitiesInFlight) return atmosCitiesInFlight;

  atmosCitiesInFlight = (async () => {
    const raw = await fetchJsonWithTimeout('https://atmos.today/api/aqi', { timeout: 8000 });
    const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.cities) ? raw.cities : [];
    const cities: AtmosCity[] = list
      .map((c) => ({
        name: String(c?.name ?? ''),
        country: String(c?.country ?? ''),
        lat: Number(c?.lat),
        lon: Number(c?.lon),
        aqi: finiteOrNull(c?.aqi),
        category: c?.category ? String(c.category) : null,
        pm25: finiteOrNull(c?.pm25),
        pm10: finiteOrNull(c?.pm10),
        updatedAt: c?.updatedAt ? String(c.updatedAt) : null,
      }))
      .filter((c) => c.name && Number.isFinite(c.lat) && Number.isFinite(c.lon));

    if (cities.length > 0) atmosCities = { ts: Date.now(), cities };
    return cities;
  })().finally(() => {
    atmosCitiesInFlight = null;
  });

  return atmosCitiesInFlight;
}

function buildPreview(
  source: AqiSource,
  value: number,
  extras: Partial<AqiPreview>
): AqiPreview {
  const band = categoryFor(value, source.index);
  return {
    aqi: value,
    index: source.index,
    scaleMax: AQI_SCALE_MAX[source.index],
    category: band.label,
    color: band.color,
    pm2_5: null,
    pm10: null,
    isUnavailable: false,
    ...extras,
  };
}

async function fetchOpenMeteoPreview(source: AqiSource, lat: number, lon: number): Promise<AqiPreview> {
  const domains = source.domains ? `&domains=${source.domains}` : '';
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=us_aqi,european_aqi,pm2_5,pm10&timezone=auto${domains}`;

  const res = await fetchJsonWithTimeout(url, { timeout: 8000 });
  const current = res?.current;
  const raw = source.index === 'eea' ? current?.european_aqi : current?.us_aqi;
  const value = finiteOrNull(raw);
  if (value == null) {
    return unavailable(
      source.index,
      source.coverage === 'europe' ? 'Outside Europe' : 'No data'
    );
  }

  return buildPreview(source, value, {
    pm2_5: finiteOrNull(current?.pm2_5),
    pm10: finiteOrNull(current?.pm10),
    updatedAt: current?.time ?? null,
  });
}

async function fetchAtmosPreview(source: AqiSource, lat: number, lon: number): Promise<AqiPreview> {
  const cities = await fetchAtmosCities();
  if (cities.length === 0) return unavailable(source.index, 'Unavailable');

  let best: AtmosCity | null = null;
  let bestDistance = Infinity;
  for (const city of cities) {
    const d = distanceKm(lat, lon, city.lat, city.lon);
    if (d < bestDistance) {
      bestDistance = d;
      best = city;
    }
  }

  if (!best || bestDistance > MAX_CITY_DISTANCE_KM) {
    return unavailable(source.index, `No station within ${MAX_CITY_DISTANCE_KM} km`);
  }
  if (best.aqi == null) return unavailable(source.index, 'Station offline');

  return buildPreview(source, best.aqi, {
    category: best.category ?? categoryFor(best.aqi, source.index).label,
    pm2_5: best.pm25,
    pm10: best.pm10,
    place: `${best.name}, ${best.country}`,
    updatedAt: best.updatedAt,
  });
}

async function fetchWaqiPreview(source: AqiSource, lat: number, lon: number): Promise<AqiPreview> {
  const raw = await fetchAqicnFeed(lat, lon);
  if (!raw) return unavailable(source.index, 'Token required');
  if (raw.status !== 'ok') return unavailable(source.index, 'No station nearby');

  const data = raw.data;
  const value = finiteOrNull(data?.aqi);
  if (value == null) return unavailable(source.index, 'No station nearby');

  return buildPreview(source, value, {
    pm2_5: finiteOrNull(data?.iaqi?.pm25?.v),
    pm10: finiteOrNull(data?.iaqi?.pm10?.v),
    place: data?.city?.name ? String(data.city.name) : null,
    updatedAt: data?.time?.iso ?? data?.time?.s ?? null,
  });
}

async function fetchPreviewFor(source: AqiSource, lat: number, lon: number): Promise<AqiPreview> {
  if (source.family === 'atmos') return fetchAtmosPreview(source, lat, lon);
  if (source.family === 'waqi') return fetchWaqiPreview(source, lat, lon);
  return fetchOpenMeteoPreview(source, lat, lon);
}

/** Single source fetch, used when a specific source drives the app's AQI. */
export function fetchAqiPreviewForSource(id: AqiSourceId, lat: number, lon: number): Promise<AqiPreview> {
  return fetchPreviewFor(getAqiSource(id), lat, lon);
}

/**
 * Fetch every source's current reading in parallel for the comparison list.
 * Cached for 10 minutes, dedupes concurrent callers, and never rejects.
 */
export function fetchAqiPreviews(lat: number, lon: number): Promise<AqiPreviewMap> {
  const key = cacheKey(lat, lon);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.ts < AQI_PREVIEW_TTL_MS) return Promise.resolve(cached.data);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const results = await Promise.all(
      AQI_SOURCES.map(async (source) => {
        try {
          return [source.id, await fetchPreviewFor(source, lat, lon)] as const;
        } catch {
          return [source.id, unavailable(source.index, 'Unavailable')] as const;
        }
      })
    );

    const map = emptyAqiPreviewMap();
    for (const [id, preview] of results) map[id] = preview;

    memoryCache.set(key, { ts: Date.now(), data: map });
    return map;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, request);
  return request;
}

export function getCachedAqiPreviews(lat: number, lon: number): AqiPreviewMap | null {
  const entry = memoryCache.get(cacheKey(lat, lon));
  if (!entry || Date.now() - entry.ts > AQI_PREVIEW_TTL_MS) return null;
  return entry.data;
}

export function clearAqiPreviewCache() {
  memoryCache.clear();
  inFlight.clear();
  atmosCities = null;
}

export function getAqiSourceLabel(id: AqiSourceId): string {
  return getAqiSource(id).name;
}
