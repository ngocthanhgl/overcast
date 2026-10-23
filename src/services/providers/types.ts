import type { WeatherData } from '../../types';

export type ProviderId =
  | 'open-meteo-best'
  | 'ecmwf'
  | 'gfs'
  | 'icon'
  | 'cma'
  | 'jma'
  | 'ukmo'
  | 'ukmo10'
  | 'meteofrance'
  | 'gem'
  | 'knmi'
  | 'dmi'
  | 'metno'
  | 'wttr';

export type ProviderFamily = 'open-meteo' | 'metno' | 'wttr';
export type ProviderFidelity = 'full' | 'partial';

export interface WeatherProvider {
  id: ProviderId;
  /** Brand name, never translated. */
  name: string;
  /** Translation key for the one-line description used in Sources. */
  descriptionKey: string;
  family: ProviderFamily;
  fidelity: ProviderFidelity;
  /** Open-Meteo `models` parameter, when applicable. */
  models?: string;
}

/** A provider payload normalized to the app model. Fields a source does not report stay undefined. */
export interface ProviderWeather {
  current: Partial<WeatherData['current']>;
  hourly?: Partial<WeatherData['hourly']>;
  daily?: Partial<WeatherData['daily']>;
}

export interface ProviderPreview {
  temp: number | null;
  code: number | null;
  isDay: boolean;
  high: number | null;
  low: number | null;
}
