import { Location, WeatherData } from '../types';
import { getActiveProviderId } from '../services/providers/active';
import { DEFAULT_PROVIDER_ID } from '../services/providers/registry';
import type { ProviderId } from '../services/providers/types';

const STORAGE_KEYS = {
  SETTINGS: 'app_settings',
  LOCATIONS: 'app_locations',
  ACTIVE_INDEX: 'app_active_index',
  WEATHER_CACHE: 'app_weather_cache', // Record<cityKey, { data: WeatherData, ts: number, provider: ProviderId }>
};

export function getCityKey(location: Location): string {
  if (!location) return 'unknown';
  return `${location.name}_${location.latitude.toFixed(2)}_${location.longitude.toFixed(2)}`
    .replace(/\s+/g, "_")
    .toLowerCase();
}

let pendingWriteSeq = 0;

export function saveWeatherData(locationKey: string, data: WeatherData, providerId: ProviderId = getActiveProviderId()) {
  const seq = ++pendingWriteSeq;
  const write = () => {
    // Only the most recent save runs; stale saves are dropped to avoid redundant main-thread JSON work
    if (seq !== pendingWriteSeq) return;
    try {
      const cacheRaw = localStorage.getItem(STORAGE_KEYS.WEATHER_CACHE);
      const cache = cacheRaw ? JSON.parse(cacheRaw) : {};
      cache[locationKey] = { data, ts: Date.now(), provider: providerId };
      localStorage.setItem(STORAGE_KEYS.WEATHER_CACHE, JSON.stringify(cache));
    } catch (e) {
      console.error('Failed to save weather data to cache', e);
    }
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(write, { timeout: 2000 });
  } else {
    setTimeout(write, 300);
  }
}

export function getCachedWeatherData(
  locationKey: string,
  providerId: ProviderId = getActiveProviderId()
): { data: WeatherData; ts: number; provider: ProviderId } | null {
  try {
    const cacheRaw = localStorage.getItem(STORAGE_KEYS.WEATHER_CACHE);
    if (!cacheRaw) return null;
    const cache = JSON.parse(cacheRaw);
    const cached = cache[locationKey];
    if (!cached || !cached.data) return null;
    // Never paint numbers that belong to a different provider than the one selected now.
    const cachedProvider: ProviderId = cached.provider || DEFAULT_PROVIDER_ID;
    if (cachedProvider !== providerId) return null;
    // Validate required fields to ensure no corrupted/incomplete data is loaded
    const d = cached.data;
    if (!d.current || !d.hourly || !d.daily || !d.timezone) {
      return null;
    }
    return { data: d, ts: cached.ts, provider: cachedProvider };
  } catch {
    return null;
  }
}

export { STORAGE_KEYS };
export const CACHE_EXPIRY = 3 * 60 * 60 * 1000; // 3 hours
