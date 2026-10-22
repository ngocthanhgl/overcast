import type { WeatherData } from '../../types';
import {
  apparentTemperature,
  getMoonPhaseFraction,
  getSunTimes,
  localDateTimeToDate,
  toLocalIsoString,
} from '../../lib/solar';
import { fetchJsonWithTimeout } from './http';
import type { ProviderPreview, ProviderWeather } from './types';

const METNO_ENDPOINT = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const HOURS = 72;

/** MET Norway `symbol_code` (without the day/night suffix) to WMO weather code. */
const SYMBOL_TO_WMO: Record<string, number> = {
  clearsky: 0,
  fair: 1,
  partlycloudy: 2,
  cloudy: 3,
  fog: 45,

  lightrain: 61,
  rain: 63,
  heavyrain: 65,
  lightrainshowers: 80,
  rainshowers: 80,
  heavyrainshowers: 82,

  lightsleet: 66,
  sleet: 66,
  heavysleet: 67,
  lightsleetshowers: 85,
  sleetshowers: 85,
  heavysleetshowers: 86,

  lightsnow: 71,
  snow: 73,
  heavysnow: 75,
  lightsnowshowers: 85,
  snowshowers: 86,
  heavysnowshowers: 86,

  lightrainandthunder: 95,
  rainandthunder: 95,
  heavyrainandthunder: 95,
  lightrainshowersandthunder: 95,
  rainshowersandthunder: 95,
  heavyrainshowersandthunder: 95,
  lightsleetandthunder: 95,
  sleetandthunder: 95,
  heavysleetandthunder: 95,
  lightssleetshowersandthunder: 95,
  sleetshowersandthunder: 95,
  heavysleetshowersandthunder: 95,
  lightsnowandthunder: 95,
  snowandthunder: 95,
  heavysnowandthunder: 95,
  lightssnowshowersandthunder: 95,
  snowshowersandthunder: 95,
  heavysnowshowersandthunder: 95,
};

export function metNoSymbolToWmo(symbol: string): number {
  if (!symbol) return 3;
  const base = symbol.replace(/_(day|night|polartwilight)$/g, '');
  return SYMBOL_TO_WMO[base] ?? 3;
}

function symbolIsDay(symbol: string): boolean | null {
  if (symbol.endsWith('_day')) return true;
  if (symbol.endsWith('_night')) return false;
  return null;
}

interface MetNoEntry {
  time: Date;
  details: Record<string, any>;
  symbol: string;
  precipHour: number | null;
  precipSixHour: number | null;
  uv: number | null;
}

async function fetchMetNoSeries(lat: number, lon: number): Promise<any[] | null> {
  const directUrl = `${METNO_ENDPOINT}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
  const direct = await fetchJsonWithTimeout(directUrl, {
    timeout: 7000,
    headers: { Accept: 'application/json' },
  });
  if (direct?.properties?.timeseries?.length) return direct.properties.timeseries;

  // Browser cannot set the identifying User-Agent MET Norway asks for, so retry through
  // our server route which can.
  if (typeof window !== 'undefined' && window.location?.origin) {
    const proxyUrl = `${window.location.origin}/api/metno-proxy?lat=${lat}&lon=${lon}`;
    const proxied = await fetchJsonWithTimeout(proxyUrl, { timeout: 7000 });
    if (proxied?.properties?.timeseries?.length) return proxied.properties.timeseries;
  }

  return null;
}

function parseEntries(series: any[]): MetNoEntry[] {
  return series
    .map((raw) => {
      const time = new Date(raw?.time);
      if (isNaN(time.getTime())) return null;
      const details = raw?.data?.instant?.details ?? {};
      const next1 = raw?.data?.next_1_hours;
      const next6 = raw?.data?.next_6_hours;
      return {
        time,
        details,
        symbol: next1?.summary?.symbol_code || next6?.summary?.symbol_code || '',
        precipHour: typeof next1?.details?.precipitation_amount === 'number' ? next1.details.precipitation_amount : null,
        precipSixHour: typeof next6?.details?.precipitation_amount === 'number' ? next6.details.precipitation_amount : null,
        uv: typeof details.ultraviolet_index_clear_sky === 'number' ? details.ultraviolet_index_clear_sky : null,
      } as MetNoEntry;
    })
    .filter((entry): entry is MetNoEntry => !!entry)
    .sort((a, b) => a.time.getTime() - b.time.getTime());
}

function nearestIndex(entries: MetNoEntry[], targetMs: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < entries.length; i++) {
    const diff = Math.abs(entries[i].time.getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/**
 * MET Norway reports hourly for roughly 2.5 days, then every 6 hours. Interpolate to a
 * full hourly series so the app's 24-hour view keeps its usual spacing.
 */
function buildHourly(entries: MetNoEntry[], timezone: string): Partial<WeatherData['hourly']> {
  const startMs = Math.floor(entries[0].time.getTime() / 3600000) * 3600000;
  const time: string[] = [];
  const temperature: number[] = [];
  const weatherCode: number[] = [];
  const precipitation: number[] = [];
  const windSpeed: number[] = [];
  const windDirection: number[] = [];
  const uvIndex: number[] = [];
  const relativeHumidity: number[] = [];

  for (let i = 0; i < HOURS; i++) {
    const targetMs = startMs + i * 3600000;

    let before: MetNoEntry | null = null;
    let after: MetNoEntry | null = null;
    for (const entry of entries) {
      const ms = entry.time.getTime();
      if (ms <= targetMs) before = entry;
      if (ms >= targetMs && !after) after = entry;
    }
    const nearest = nearestIndex(entries, targetMs);
    const reference = before || entries[nearest];
    const tempA = before ? before.details.air_temperature : reference.details.air_temperature;
    const tempB = after ? after.details.air_temperature : reference.details.air_temperature;

    let temp = reference.details.air_temperature;
    if (typeof tempA === 'number' && typeof tempB === 'number' && after && before) {
      const span = after.time.getTime() - before.time.getTime();
      const ratio = span > 0 ? (targetMs - before.time.getTime()) / span : 0;
      temp = tempA + (tempB - tempA) * ratio;
    }

    time.push(toLocalIsoString(new Date(targetMs), timezone));
    temperature.push(Number.isFinite(temp) ? Math.round(temp * 10) / 10 : 0);
    weatherCode.push(metNoSymbolToWmo(entries[nearest].symbol));
    precipitation.push(entries[nearest].precipHour ?? (entries[nearest].precipSixHour != null ? entries[nearest].precipSixHour! / 6 : 0));
    windSpeed.push(Math.round((entries[nearest].details.wind_speed ?? 0) * 10) / 10);
    windDirection.push(Math.round(entries[nearest].details.wind_from_direction ?? 0));
    uvIndex.push(entries[nearest].uv ?? 0);
    relativeHumidity.push(Math.round(entries[nearest].details.relative_humidity ?? 0));
  }

  return {
    time,
    temperature,
    temperature_2m: temperature,
    weatherCode,
    weathercode: weatherCode,
    precipitation,
    windSpeed,
    windDirection,
    uvIndex,
    relativeHumidity,
  };
}

function buildDaily(entries: MetNoEntry[], lat: number, lon: number, timezone: string): Partial<WeatherData['daily']> {
  const buckets = new Map<string, MetNoEntry[]>();
  const dateOrder: string[] = [];

  for (const entry of entries) {
    const dateStr = toLocalIsoString(entry.time, timezone).slice(0, 10);
    if (!buckets.has(dateStr)) {
      buckets.set(dateStr, []);
      if (dateOrder.length < 8) dateOrder.push(dateStr);
    }
    buckets.get(dateStr)!.push(entry);
  }

  const time = dateOrder;
  const weatherCode: number[] = [];
  const temperatureMax: number[] = [];
  const temperatureMin: number[] = [];
  const sunrise: string[] = [];
  const sunset: string[] = [];
  const uvIndex: number[] = [];
  const precipitationSum: number[] = [];
  const moonPhase: number[] = [];

  for (const dateStr of dateOrder) {
    const dayEntries = buckets.get(dateStr)!;
    const temps = dayEntries.map((e) => e.details.air_temperature).filter((v): v is number => typeof v === 'number');

    const noonInstant = localDateTimeToDate(dateStr, '12:00', timezone);
    const noonEntry = dayEntries[nearestIndex(dayEntries, noonInstant.getTime())];
    const sun = getSunTimes(lat, lon, noonInstant);

    weatherCode.push(metNoSymbolToWmo(noonEntry.symbol));
    temperatureMax.push(temps.length ? Math.round(Math.max(...temps)) : 0);
    temperatureMin.push(temps.length ? Math.round(Math.min(...temps)) : 0);
    sunrise.push(sun ? toLocalIsoString(sun.sunrise, timezone) : '');
    sunset.push(sun ? toLocalIsoString(sun.sunset, timezone) : '');

    const uvs = dayEntries.map((e) => e.uv).filter((v): v is number => typeof v === 'number');
    uvIndex.push(uvs.length ? Math.round(Math.max(...uvs)) : 0);

    const precip = dayEntries.reduce((sum, entry) => sum + (entry.precipHour ?? entry.precipSixHour ?? 0), 0);
    precipitationSum.push(Math.round(precip * 10) / 10);

    moonPhase.push(getMoonPhaseFraction(noonInstant));
  }

  return {
    time,
    weatherCode,
    temperatureMax,
    temperatureMin,
    sunrise,
    sunset,
    moonrise: time.map(() => ''),
    moonset: time.map(() => ''),
    uvIndex,
    moonPhase,
    precipitationSum,
  };
}

export async function fetchMetNoWeather(lat: number, lon: number, timezone: string): Promise<ProviderWeather | null> {
  const series = await fetchMetNoSeries(lat, lon);
  if (!series || series.length === 0) return null;

  const entries = parseEntries(series);
  if (entries.length === 0) return null;

  const tz = timezone || 'UTC';
  const first = entries[0];
  const symbol = first.symbol;
  const currentTemp = first.details.air_temperature;
  const currentWind = first.details.wind_speed ?? 0;
  const dayFromSymbol = symbolIsDay(symbol);
  const sun = getSunTimes(lat, lon, first.time);

  let isDay = dayFromSymbol;
  if (isDay === null) {
    isDay = sun ? first.time >= sun.sunrise && first.time < sun.sunset : true;
  }

  const current: Partial<WeatherData['current']> = {
    time: first.time.toISOString(),
    temperature: Math.round(currentTemp ?? 0),
    apparentTemperature: Math.round(apparentTemperature(currentTemp ?? 0, currentWind, first.details.relative_humidity)),
    relativeHumidity: Math.round(first.details.relative_humidity ?? 0),
    weatherCode: metNoSymbolToWmo(symbol),
    windSpeed: Math.round(currentWind),
    windDirection: Math.round(first.details.wind_from_direction ?? 0),
    surfacePressure: first.details.air_pressure_at_sea_level != null
      ? Math.round(first.details.air_pressure_at_sea_level)
      : undefined,
    precipitation: first.precipHour ?? undefined,
    isDay,
  };

  return {
    current,
    hourly: buildHourly(entries, tz),
    daily: buildDaily(entries, lat, lon, tz),
  };
}

export async function fetchMetNoPreview(lat: number, lon: number, timezone: string): Promise<ProviderPreview | null> {
  const weather = await fetchMetNoWeather(lat, lon, timezone);
  if (!weather?.current) return null;
  return {
    temp: typeof weather.current.temperature === 'number' ? weather.current.temperature : null,
    code: weather.current.weatherCode ?? null,
    isDay: weather.current.isDay ?? true,
    high: weather.daily?.temperatureMax?.[0] ?? null,
    low: weather.daily?.temperatureMin?.[0] ?? null,
  };
}
