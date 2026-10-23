import type { ProviderId, WeatherProvider } from './types';

export const DEFAULT_PROVIDER_ID: ProviderId = 'open-meteo-best';

/**
 * Every source here is keyless and, with the exceptions documented below, serves CORS
 * headers so the client can call it directly.
 *
 * - Open-Meteo models share one endpoint; `models` selects the national model.
 * - MET Norway requires an identifying User-Agent for heavy use, which a browser cannot
 *   send, so the adapter falls back to `/api/metno-proxy` when the direct call fails.
 * - wttr.in wraps WorldWeatherOnline data and is best-effort only.
 */
export const PROVIDERS: WeatherProvider[] = [
  {
    id: 'open-meteo-best',
    name: 'Open-Meteo',
    descriptionKey: 'provider.open-meteo-best.detail',
    family: 'open-meteo',
    fidelity: 'full',
  },
  {
    id: 'ecmwf',
    name: 'ECMWF IFS',
    descriptionKey: 'provider.ecmwf.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'ecmwf_ifs025',
  },
  {
    id: 'gfs',
    name: 'NOAA GFS',
    descriptionKey: 'provider.gfs.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'gfs_seamless',
  },
  {
    id: 'icon',
    name: 'DWD ICON',
    descriptionKey: 'provider.icon.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'icon_seamless',
  },
  {
    id: 'cma',
    name: 'CMA GRAPES',
    descriptionKey: 'provider.cma.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'cma_grapes_global',
  },
  {
    id: 'jma',
    name: 'JMA',
    descriptionKey: 'provider.jma.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'jma_seamless',
  },
  {
    id: 'ukmo',
    name: 'UK Met Office',
    descriptionKey: 'provider.ukmo.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'ukmo_seamless',
  },
  {
    id: 'meteofrance',
    name: 'Météo-France',
    descriptionKey: 'provider.meteofrance.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'meteofrance_seamless',
  },
  {
    id: 'gem',
    name: 'GEM Canada',
    descriptionKey: 'provider.gem.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'gem_seamless',
  },
  {
    id: 'knmi',
    name: 'KNMI',
    descriptionKey: 'provider.knmi.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'knmi_seamless',
  },
  {
    id: 'dmi',
    name: 'DMI',
    descriptionKey: 'provider.dmi.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'dmi_seamless',
  },
  {
    id: 'ukmo10',
    name: 'UKMO 10km',
    descriptionKey: 'provider.ukmo10.detail',
    family: 'open-meteo',
    fidelity: 'full',
    models: 'ukmo_global_deterministic_10km',
  },
  {
    id: 'metno',
    name: 'MET Norway',
    descriptionKey: 'provider.metno.detail',
    family: 'metno',
    fidelity: 'partial',
  },
  {
    id: 'wttr',
    name: 'wttr.in',
    descriptionKey: 'provider.wttr.detail',
    family: 'wttr',
    fidelity: 'partial',
  },
];

const BY_ID = new Map<ProviderId, WeatherProvider>(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: ProviderId): WeatherProvider {
  return BY_ID.get(id) || BY_ID.get(DEFAULT_PROVIDER_ID)!;
}

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && BY_ID.has(value as ProviderId);
}

/** Providers grouped exactly as the picker renders them. */
export const PROVIDER_GROUPS: { titleKey: string; fidelity: 'full' | 'partial' }[] = [
  { titleKey: 'Forecast models', fidelity: 'full' },
  { titleKey: 'Independent sources', fidelity: 'partial' },
];
