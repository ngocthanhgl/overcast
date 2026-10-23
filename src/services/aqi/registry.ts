import type { AqiSource, AqiSourceId } from './types';

/**
 * Free air quality sources.
 *
 * Open-Meteo serves the CAMS atmospheric composition forecasts (keyless, coordinate
 * precise). atmos.today publishes a keyless, CORS-open city list. WAQI exposes ground
 * monitoring stations (best coverage in Asia) but needs a token, so it reports as
 * unavailable until one is configured.
 */
export const AQI_SOURCES: AqiSource[] = [
  {
    id: 'cams_global',
    name: 'CAMS Global',
    descriptionKey: 'aqi.cams_global.detail',
    family: 'open-meteo',
    coverage: 'global',
    domains: 'cams_global',
  },
  {
    id: 'cams_europe',
    name: 'CAMS Europe',
    descriptionKey: 'aqi.cams_europe.detail',
    family: 'open-meteo',
    coverage: 'europe',
    domains: 'cams_europe',
  },
  {
    id: 'atmos',
    name: 'atmos.today',
    descriptionKey: 'aqi.atmos.detail',
    family: 'atmos',
    coverage: 'cities',
  },
  {
    id: 'waqi',
    name: 'WAQI Stations',
    descriptionKey: 'aqi.waqi.detail',
    family: 'waqi',
    coverage: 'cities',
  },
];

export const DEFAULT_AQI_SOURCE_ID: AqiSourceId = 'cams_global';

const BY_ID = new Map<AqiSourceId, AqiSource>(AQI_SOURCES.map((source) => [source.id, source]));

export function getAqiSource(id: AqiSourceId): AqiSource {
  return BY_ID.get(id) || BY_ID.get(DEFAULT_AQI_SOURCE_ID)!;
}

export function isAqiSourceId(value: unknown): value is AqiSourceId {
  return typeof value === 'string' && BY_ID.has(value as AqiSourceId);
}
