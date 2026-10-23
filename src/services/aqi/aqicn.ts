import { fetchJsonWithTimeout } from '../providers/http';

/**
 * AQICN / WAQI needs a token. Two ways to supply it:
 *
 * 1. Embedded, build time: the CI passes `AQICN_TOKEN`, vite.config scrambles it, and the
 *    bundle only carries the scrambled blob (no plaintext token in the APK).
 * 2. Proxy: set `VITE_AQI_PROXY_BASE` and the request goes through `/api/aqicn-proxy`,
 *    where the token lives in the server environment instead.
 *
 * The proxy wins when configured, so moving off the embedded token needs no code change.
 */
declare const __AQICN_SCRAMBLED__: string;

const PROXY_BASE = (import.meta.env.VITE_AQI_PROXY_BASE || '').replace(/\/+$/, '');
const SCRAMBLE_SEED = 'overcast-aqi-v1';

let cachedToken: string | null = null;

function unscramble(blob: string): string {
  if (!blob) return '';
  try {
    const raw = atob(blob);
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      out += String.fromCharCode(raw.charCodeAt(i) ^ SCRAMBLE_SEED.charCodeAt(i % SCRAMBLE_SEED.length));
    }
    return out;
  } catch {
    return '';
  }
}

export function getAqicnToken(): string {
  if (cachedToken === null) {
    cachedToken = typeof __AQICN_SCRAMBLED__ === 'string' ? unscramble(__AQICN_SCRAMBLED__) : '';
  }
  return cachedToken;
}

export function aqicnFeedUrl(lat: number, lon: number): string | null {
  const path = `/feed/geo:${lat};${lon}/`;
  if (PROXY_BASE) return `${PROXY_BASE}/api/aqicn-proxy?path=${encodeURIComponent(path)}`;

  const token = getAqicnToken();
  if (!token) return null;
  return `https://api.waqi.info${path}?token=${encodeURIComponent(token)}`;
}

/** Raw WAQI payload, or null when no token/proxy is configured or the request fails. */
export function fetchAqicnFeed(lat: number, lon: number): Promise<any | null> {
  const url = aqicnFeedUrl(lat, lon);
  if (!url) return Promise.resolve(null);
  return fetchJsonWithTimeout(url, { timeout: 8000 });
}

/** Human readable reason for a failed/absent WAQI reading, shown in the source list. */
export function aqicnFailureReason(): string {
  if (PROXY_BASE) return 'Proxy unreachable';
  if (!getAqicnToken()) return 'Token not configured';
  return 'Request failed';
}
