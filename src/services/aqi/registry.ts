import type { AqiSource, AqiSourceId } from './types';

/**
 * Free air quality sources.
 *
 * Open-Meteo serves the CAMS atmospheric composition forecasts (keyless, coordinate
 * precise) and can report either the US EPA or the European EEA index. atmos.today
 * publishes a keyless, CORS-open city list. WAQI exposes ground monitoring stations
 * (best coverage in Asia) through a keyless proxy endpoint; the token stays on the
 * server side.
 */
export const AQI_SOURCES: AqiSource[] = [
  {
    id: 'cams_global_us',
    name: 'CAMS Global',
    descriptionKey: 'aqi.cams_global_us.detail',
    family: 'open-meteo',
    coverage: 'global',
    index: 'us_epa',
    gridNote: 'Interpolated grid · 45 km',
    domains: 'cams_global',
  },
  {
    id: 'cams_global_eu',
    name: 'CAMS Global',
    descriptionKey: 'aqi.cams_global_eu.detail',
    family: 'open-meteo',
    coverage: 'global',
    index: 'eea',
    gridNote: 'Interpolated grid · 45 km',
    domains: 'cams_global',
  },
  {
    id: 'cams_europe_eu',
    name: 'CAMS Europe',
    descriptionKey: 'aqi.cams_europe_eu.detail',
    family: 'open-meteo',
    coverage: 'europe',
    index: 'eea',
    gridNote: 'Interpolated grid · 11 km',
    domains: 'cams_europe',
  },
  {
    id: 'atmos_us',
    name: 'atmos.today',
    descriptionKey: 'aqi.atmos_us.detail',
    family: 'atmos',
    coverage: 'cities',
    index: 'us_epa',
  },
  {
    id: 'waqi_us',
    name: 'WAQI',
    descriptionKey: 'aqi.waqi_us.detail',
    family: 'waqi',
    coverage: 'cities',
    index: 'us_epa',
  },
];

export const DEFAULT_AQI_SOURCE_ID: AqiSourceId = 'cams_global_us';

const BY_ID = new Map<AqiSourceId, AqiSource>(AQI_SOURCES.map((source) => [source.id, source]));

export function getAqiSource(id: AqiSourceId): AqiSource {
  return BY_ID.get(id) || BY_ID.get(DEFAULT_AQI_SOURCE_ID)!;
}

export function isAqiSourceId(value: unknown): value is AqiSourceId {
  return typeof value === 'string' && BY_ID.has(value as AqiSourceId);
}
