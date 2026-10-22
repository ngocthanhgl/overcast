const RAD = Math.PI / 180;
const SYNODIC_MONTH_DAYS = 29.530588853;

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

function dayOfYearUTC(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86400000) + 1;
}

/**
 * NOAA solar position algorithm. Returns the UTC instant of sunrise/sunset for the
 * UTC calendar day that contains `reference`. Callers pass a timestamp around local
 * noon of the target day so the UTC day always matches.
 */
function sunEventUTC(lat: number, lon: number, reference: Date, sunrise: boolean): Date | null {
  const dayOfYear = dayOfYearUTC(reference);
  const lngHour = lon / 15;
  const t = dayOfYear + ((sunrise ? 6 : 18) - lngHour) / 24;

  const M = 0.9856 * t - 3.289;
  const L = ((M + 1.916 * Math.sin(M * RAD) + 0.020 * Math.sin(2 * M * RAD) + 282.634) % 360 + 360) % 360;

  let RA = (Math.atan(0.91764 * Math.tan(L * RAD)) / RAD + 360) % 360;
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = (RA + (Lquadrant - RAquadrant)) / 15;

  const sinDec = 0.39782 * Math.sin(L * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));

  const cosH =
    (Math.cos(90.833 * RAD) - sinDec * Math.sin(lat * RAD)) /
    (cosDec * Math.cos(lat * RAD));

  // Polar day / polar night
  if (cosH > 1 || cosH < -1) return null;

  let H = sunrise ? 360 - Math.acos(cosH) / RAD : Math.acos(cosH) / RAD;
  H = H / 15;

  const T = H + RA - 0.06571 * t - 6.622;
  const UT = ((T - lngHour) % 24 + 24) % 24;

  const base = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate());
  return new Date(base + UT * 3600000);
}

export function getSunTimes(lat: number, lon: number, reference: Date = new Date()): SunTimes | null {
  const sunrise = sunEventUTC(lat, lon, reference, true);
  const sunset = sunEventUTC(lat, lon, reference, false);
  if (!sunrise || !sunset) return null;
  return { sunrise, sunset };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Format an instant as the same local ISO shape Open-Meteo returns: "YYYY-MM-DDTHH:mm". */
export function toLocalIsoString(date: Date, timeZone: string): string {
  const tz = timeZone && timeZone !== 'auto' ? timeZone : 'UTC';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  } catch {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
      date.getUTCHours()
    )}:${pad(date.getUTCMinutes())}`;
  }
}

/**
 * Convert a wall-clock time in `timeZone` ("2026-10-22" + "12:00") into a real UTC instant.
 * Iterates the Intl offset until it converges, same approach the app already uses elsewhere.
 */
export function localDateTimeToDate(dateStr: string, timeStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const targetMs = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
  const tz = timeZone && timeZone !== 'auto' ? timeZone : 'UTC';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });

    let guessMs = targetMs;
    for (let i = 0; i < 3; i++) {
      const parts = formatter.formatToParts(new Date(guessMs));
      const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
      const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
      const diff = asIfUtc - targetMs;
      if (diff === 0) break;
      guessMs -= diff;
    }
    return new Date(guessMs);
  } catch {
    return new Date(targetMs);
  }
}

/** Moon phase as a 0..1 fraction (0 = new moon, 0.5 = full moon). */
export function getMoonPhaseFraction(date: Date = new Date()): number {
  const knownNewMoonMs = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNewMoonMs) / 86400000;
  const phase = (days % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS;
  return phase < 0 ? phase + 1 : phase;
}

/** Apparent temperature from temperature (°C), wind (m/s) and relative humidity (%). */
export function apparentTemperature(tempC: number, windMs: number, humidity?: number): number {
  if (tempC <= 10 && windMs > 1.3) {
    const windKmh = windMs * 3.6;
    return 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * tempC * Math.pow(windKmh, 0.16);
  }
  if (tempC >= 27 && typeof humidity === 'number') {
    const t = tempC;
    const r = humidity;
    const hi =
      -8.78469475556 +
      1.61139411 * t +
      2.33854883889 * r -
      0.14611605 * t * r -
      0.012308094 * t * t -
      0.0164248277778 * r * r +
      0.002211732 * t * t * r +
      0.00072546 * t * r * r -
      0.000003582 * t * t * r * r;
    return hi;
  }
  return tempC;
}
