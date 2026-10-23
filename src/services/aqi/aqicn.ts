import { fetchJsonWithTimeout } from '../providers/http';

/**
 * AQICN / WAQI needs a token, so the app never calls api.waqi.info directly: it goes
 * through our own proxy (`/api/aqicn-proxy`) which injects the token server side.
 *
 * `VITE_AQI_PROXY_BASE` is the public base URL of the proxy host. Leave it empty to use
 * the current origin (works for the deployed PWA).
 */
const PROXY_BASE = (import.meta.env.VITE_AQI_PROXY_BASE || '').replace(/\/+$/, '');

export function aqicnFeedUrl(lat: number, lon: number): string {
  const path = encodeURIComponent(`/feed/geo:${lat};${lon}/`);
  return `${PROXY_BASE}/api/aqicn-proxy?path=${path}`;
}

/** Returns the raw WAQI payload, or null when the proxy is missing/misconfigured. */
export function fetchAqicnFeed(lat: number, lon: number): Promise<any | null> {
  return fetchJsonWithTimeout(aqicnFeedUrl(lat, lon), { timeout: 8000 });
}
