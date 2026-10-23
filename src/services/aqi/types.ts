import type { AqiIndex } from './scale';

export type AqiSourceId = 'cams_global_us' | 'cams_global_eu' | 'cams_europe_eu' | 'atmos_us' | 'waqi_us';

export type AqiSourceFamily = 'open-meteo' | 'atmos' | 'waqi';

export type AqiCoverage = 'global' | 'europe' | 'cities';

export interface AqiSource {
  id: AqiSourceId;
  /** Brand name, never translated. */
  name: string;
  /** Translation key for the one-line description used in the source list. */
  descriptionKey: string;
  family: AqiSourceFamily;
  coverage: AqiCoverage;
  /** Index scale this source reports on. */
  index: AqiIndex;
  /** Open-Meteo `domains` parameter, when applicable. */
  domains?: string;
}

/** One source's current air quality reading, normalized for the comparison list. */
export interface AqiPreview {
  /** Index value on the source's own scale. */
  aqi: number | null;
  index: AqiIndex;
  /** Scale range shown next to the value, e.g. 500 for US AQI. */
  scaleMax: number;
  category: string | null;
  color: string | null;
  pm2_5: number | null;
  pm10: number | null;
  /** Station/city the reading came from, for city-based sources. */
  place?: string | null;
  updatedAt?: string | null;
  isUnavailable: boolean;
  /** Human readable reason when `isUnavailable` is true. */
  reason?: string | null;
}
