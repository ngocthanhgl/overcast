import type { WeatherData } from '../../types';
import {
  apparentTemperature,
  getMoonPhaseFraction,
  localDateTimeToDate,
  toLocalIsoString,
} from '../../lib/solar';
import { fetchJsonWithTimeout } from './http';
import type { ProviderPreview, ProviderWeather } from './types';

const HOURS = 72;

/** WorldWeatherOnline condition code (as served by wttr.in) to WMO weather code. */
const WWO_TO_WMO: Record<number, number> = {
  113: 0,
  116: 2,
  119: 3,
  122: 3,
  143: 45,
  248: 45,
  260: 45,

  176: 80,
  263: 51,
  266: 51,
  293: 61,
  296: 61,
  299: 63,
  302: 65,
  305: 65,
  308: 65,
  311: 66,
  314: 67,
  353: 80,
  356: 81,
  359: 82,

  179: 71,
  182: 71,
  185: 71,
  227: 71,
  230: 75,
  320: 71,
  323: 71,
  326: 71,
  329: 73,
  332: 73,
  335: 75,
  338: 75,
  350: 77,
  362: 85,
  365: 86,
  368: 85,
  371: 86,
  374: 77,
  377: 77,

  200: 95,
  386: 95,
  389: 95,
  392: 95,
  395: 75,
};

export function wwoCodeToWmo(code: number): number {
  return WWO_TO_WMO[code] ?? 3;
}

interface WttrPoint {
  ms: number;
  temp: number;
  code: number;
  precip: number;
  windMs: number;
  windDir: number;
  humidity: number;
  pop: number;
  uv: number;
  isDay: boolean;
}

function parseClock(value: string): string | null {
  // "05:58 AM" -> "05:58"
  const match = value?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function buildPoints(payload: any, timezone: string): WttrPoint[] {
  const points: WttrPoint[] = [];
  for (const day of payload?.weather ?? []) {
    const dateStr = day?.date;
    if (!dateStr) continue;
    for (const slot of day?.hourly ?? []) {
      const hour = Math.round(parseInt(slot?.time ?? '0', 10) / 100);
      const instant = localDateTimeToDate(dateStr, `${String(hour).padStart(2, '0')}:00`, timezone);
      const temp = Number(slot?.tempC);
      points.push({
        ms: instant.getTime(),
        temp: Number.isFinite(temp) ? temp : 0,
        code: wwoCodeToWmo(Number(slot?.weatherCode ?? 113)),
        precip: Number(slot?.precipMM ?? 0),
        windMs: Number(slot?.windspeedKmph ?? 0) / 3.6,
        windDir: Number(slot?.winddirDegree ?? 0),
        humidity: Number(slot?.humidity ?? 0),
        pop: Number(slot?.chanceofrain ?? 0),
        uv: Number(slot?.uvIndex ?? 0),
        isDay: hour >= 6 && hour < 18,
      });
    }
  }
  return points.sort((a, b) => a.ms - b.ms);
}

function buildHourly(points: WttrPoint[], timezone: string): Partial<WeatherData['hourly']> {
  const startMs = Math.floor(points[0].ms / 3600000) * 3600000;
  const time: string[] = [];
  const temperature: number[] = [];
  const weatherCode: number[] = [];
  const precipitation: number[] = [];
  const precipitationProbability: number[] = [];
  const windSpeed: number[] = [];
  const windDirection: number[] = [];
  const uvIndex: number[] = [];
  const relativeHumidity: number[] = [];

  for (let i = 0; i < HOURS; i++) {
    const target = startMs + i * 3600000;

    let before: WttrPoint | null = null;
    let after: WttrPoint | null = null;
    for (const point of points) {
      if (point.ms <= target) before = point;
      if (point.ms >= target && !after) after = point;
    }
    // wttr only reports every 3 hours: interpolate temperature, hold the rest on the nearest slot.
    const reference = before && after && after.ms - target < target - before.ms ? after : before || after;
    if (!reference) continue;

    let temp = reference.temp;
    if (before && after && after.ms > before.ms) {
      const ratio = (target - before.ms) / (after.ms - before.ms);
      temp = before.temp + (after.temp - before.temp) * ratio;
    }

    time.push(toLocalIsoString(new Date(target), timezone));
    temperature.push(Math.round(temp * 10) / 10);
    weatherCode.push(reference.code);
    precipitation.push(Math.round(reference.precip * 10) / 10);
    precipitationProbability.push(reference.pop);
    windSpeed.push(Math.round(reference.windMs * 10) / 10);
    windDirection.push(reference.windDir);
    uvIndex.push(reference.uv);
    relativeHumidity.push(reference.humidity);
  }

  return {
    time,
    temperature,
    temperature_2m: temperature,
    weatherCode,
    weathercode: weatherCode,
    precipitation,
    precipitationProbability,
    windSpeed,
    windDirection,
    uvIndex,
    relativeHumidity,
  };
}

function buildDaily(payload: any, timezone: string): Partial<WeatherData['daily']> {
  const time: string[] = [];
  const weatherCode: number[] = [];
  const temperatureMax: number[] = [];
  const temperatureMin: number[] = [];
  const sunrise: string[] = [];
  const sunset: string[] = [];
  const moonrise: string[] = [];
  const moonset: string[] = [];
  const uvIndex: number[] = [];
  const precipitationSum: number[] = [];
  const moonPhase: number[] = [];

  for (const day of payload?.weather ?? []) {
    const dateStr = day?.date;
    if (!dateStr) continue;

    const astronomy = day?.astronomy?.[0] ?? {};
    const noon = day?.hourly?.find((slot: any) => Number(slot?.time) === 1200) ?? day?.hourly?.[0];

    const sunriseClock = parseClock(astronomy.sunrise);
    const sunsetClock = parseClock(astronomy.sunset);
    const moonriseClock = parseClock(astronomy.moonrise);
    const moonsetClock = parseClock(astronomy.moonset);

    time.push(dateStr);
    weatherCode.push(wwoCodeToWmo(Number(noon?.weatherCode ?? 113)));
    temperatureMax.push(Math.round(Number(day?.maxtempC ?? 0)));
    temperatureMin.push(Math.round(Number(day?.mintempC ?? 0)));
    sunrise.push(sunriseClock ? toLocalIsoString(localDateTimeToDate(dateStr, sunriseClock, timezone), timezone) : '');
    sunset.push(sunsetClock ? toLocalIsoString(localDateTimeToDate(dateStr, sunsetClock, timezone), timezone) : '');
    moonrise.push(moonriseClock ? toLocalIsoString(localDateTimeToDate(dateStr, moonriseClock, timezone), timezone) : '');
    moonset.push(moonsetClock ? toLocalIsoString(localDateTimeToDate(dateStr, moonsetClock, timezone), timezone) : '');
    uvIndex.push(Math.round(Number(day?.uvIndex ?? 0)));

    const precip = (day?.hourly ?? []).reduce((sum: number, slot: any) => sum + Number(slot?.precipMM ?? 0), 0);
    precipitationSum.push(Math.round(precip * 10) / 10);
    moonPhase.push(getMoonPhaseFraction(localDateTimeToDate(dateStr, '12:00', timezone)));
  }

  return {
    time,
    weatherCode,
    temperatureMax,
    temperatureMin,
    sunrise,
    sunset,
    moonrise,
    moonset,
    uvIndex,
    precipitationSum,
    moonPhase,
  };
}

export async function fetchWttrWeather(lat: number, lon: number, timezone: string): Promise<ProviderWeather | null> {
  const payload = await fetchJsonWithTimeout(`https://wttr.in/${lat},${lon}?format=j1`, { timeout: 8000 });
  const current = payload?.current_condition?.[0];
  if (!current) return null;

  const points = buildPoints(payload, timezone);
  const temp = Number(current.temp_C ?? NaN);
  const windMs = Number(current.windspeedKmph ?? 0) / 3.6;
  const humidity = Number(current.humidity ?? 0);
  const now = points.length ? points[0] : null;

  const currentWeather: Partial<WeatherData['current']> = {
    time: now ? new Date(now.ms).toISOString() : new Date().toISOString(),
    temperature: Math.round(Number.isFinite(temp) ? temp : 0),
    apparentTemperature: Math.round(apparentTemperature(Number.isFinite(temp) ? temp : 0, windMs, humidity)),
    relativeHumidity: Math.round(humidity),
    weatherCode: wwoCodeToWmo(Number(current.weatherCode ?? 113)),
    windSpeed: Math.round(windMs),
    windDirection: Math.round(Number(current.winddirDegree ?? 0)),
    surfacePressure: Number.isFinite(Number(current.pressure)) ? Math.round(Number(current.pressure)) : undefined,
    precipitation: Number.isFinite(Number(current.precipMM)) ? Number(current.precipMM) : undefined,
    visibility: Number.isFinite(Number(current.visibility)) ? Number(current.visibility) * 1000 : undefined,
    uvIndex: Number.isFinite(Number(current.uvIndex)) ? Number(current.uvIndex) : undefined,
    isDay: now?.isDay ?? true,
  };

  return {
    current: currentWeather,
    hourly: points.length ? buildHourly(points, timezone) : undefined,
    daily: buildDaily(payload, timezone),
  };
}

export async function fetchWttrPreview(lat: number, lon: number, timezone: string): Promise<ProviderPreview | null> {
  const weather = await fetchWttrWeather(lat, lon, timezone);
  if (!weather?.current) return null;
  return {
    temp: typeof weather.current.temperature === 'number' ? weather.current.temperature : null,
    code: weather.current.weatherCode ?? null,
    isDay: weather.current.isDay ?? true,
    high: weather.daily?.temperatureMax?.[0] ?? null,
    low: weather.daily?.temperatureMin?.[0] ?? null,
  };
}
