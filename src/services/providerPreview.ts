import { PROVIDERS, getProvider } from './providers/registry';
import type { ProviderId, ProviderPreview, WeatherProvider } from './providers/types';
import { buildOpenMeteoForecastUrl } from './providers/openmeteo';
import { fetchMetNoPreview } from './providers/metno';
import { fetchWttrPreview } from './providers/wttr';
import { fetchJsonWithTimeout } from './providers/http';

export const PREVIEW_TTL_MS = 10 * 60 * 1000;
const STORAGE_KEY = 'app_provider_previews';

export type ProviderPreviewMap = Record<ProviderId, ProviderPreview | null>;

interface PreviewCacheEntry {
  ts: number;
  data: ProviderPreviewMap;
}

const memoryCache = new Map<string, PreviewCacheEntry>();
const inFlight = new Map<string, Promise<ProviderPreviewMap>>();

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)}_${lon.toFixed(2)}`;
}

function emptyMap(): ProviderPreviewMap {
  const map = {} as ProviderPreviewMap;
  for (const provider of PROVIDERS) map[provider.id] = null;
  return map;
}

function readStorage(): Record<string, PreviewCacheEntry> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorage(key: string, entry: PreviewCacheEntry) {
  if (typeof localStorage === 'undefined') return;
  try {
    const all = readStorage();
    all[key] = entry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or private mode: memory cache still works */
  }
}

export function getCachedProviderPreviews(lat: number, lon: number): ProviderPreviewMap | null {
  const key = cacheKey(lat, lon);
  const entry = memoryCache.get(key) || readStorage()[key];
  if (!entry || !entry.data) return null;
  if (Date.now() - entry.ts > PREVIEW_TTL_MS) return null;
  memoryCache.set(key, entry);
  return entry.data;
}

async function fetchPreviewFor(provider: WeatherProvider, lat: number, lon: number, timezone: string): Promise<ProviderPreview | null> {
  if (provider.family === 'metno') return fetchMetNoPreview(lat, lon, timezone);
  if (provider.family === 'wttr') return fetchWttrPreview(lat, lon, timezone);

  const data = await fetchJsonWithTimeout(
    buildOpenMeteoForecastUrl(lat, lon, { models: provider.models, preview: true }),
    { timeout: 6000 }
  );
  if (!data?.current) return null;

  const temp = Number(data.current.temperature_2m);
  return {
    temp: Number.isFinite(temp) ? temp : null,
    code: Number.isFinite(Number(data.current.weather_code)) ? Number(data.current.weather_code) : null,
    isDay: data.current.is_day === undefined ? true : data.current.is_day === 1,
    high: Number.isFinite(Number(data.daily?.temperature_2m_max?.[0])) ? Number(data.daily.temperature_2m_max[0]) : null,
    low: Number.isFinite(Number(data.daily?.temperature_2m_min?.[0])) ? Number(data.daily.temperature_2m_min[0]) : null,
  };
}

/**
 * Fetch every provider's current conditions in parallel for the comparison list.
 * Cached for 10 minutes, dedupes concurrent callers, and never rejects.
 */
export function fetchProviderPreviews(lat: number, lon: number, timezone: string): Promise<ProviderPreviewMap> {
  const key = cacheKey(lat, lon);
  const cached = getCachedProviderPreviews(lat, lon);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const results = await Promise.all(
      PROVIDERS.map(async (provider) => {
        try {
          const preview = await fetchPreviewFor(provider, lat, lon, timezone);
          return [provider.id, preview] as const;
        } catch {
          return [provider.id, null] as const;
        }
      })
    );

    const map = emptyMap();
    for (const [id, preview] of results) map[id] = preview;

    const entry: PreviewCacheEntry = { ts: Date.now(), data: map };
    memoryCache.set(key, entry);
    writeStorage(key, entry);
    return map;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, request);
  return request;
}

export function clearProviderPreviewCache() {
  memoryCache.clear();
  inFlight.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Short label used in Settings for the active provider ("Open-Meteo", "CMA GRAPES", ...). */
export function getProviderLabel(id: ProviderId): string {
  return getProvider(id).name;
}
