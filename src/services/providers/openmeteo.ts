const CURRENT_FIELDS =
  'temperature_2m,relative_humidity_2m,' +
  'apparent_temperature,weather_code,' +
  'wind_speed_10m,wind_direction_10m,' +
  'surface_pressure,precipitation,visibility';

const HOURLY_FIELDS =
  'temperature_2m,weather_code,' +
  'precipitation_probability,precipitation,' +
  'wind_speed_10m,visibility,uv_index,' +
  'relative_humidity_2m';

const DAILY_FIELDS =
  'weather_code,temperature_2m_max,' +
  'temperature_2m_min,sunrise,sunset,' +
  'precipitation_probability_max,' +
  'wind_speed_10m_max,uv_index_max,' +
  'precipitation_sum';

export interface OpenMeteoUrlOptions {
  models?: string;
  /** Light request used by the provider comparison list. */
  preview?: boolean;
}

export function buildOpenMeteoForecastUrl(lat: number, lon: number, opts: OpenMeteoUrlOptions = {}): string {
  const models = opts.models ? `&models=${opts.models}` : '';

  if (opts.preview) {
    return (
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}` +
      `&longitude=${lon}` +
      `&current=temperature_2m,weather_code,is_day` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `${models}` +
      `&timezone=auto` +
      `&forecast_days=1`
    );
  }

  return (
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&current=${CURRENT_FIELDS}` +
    `&hourly=${HOURLY_FIELDS}` +
    `&daily=${DAILY_FIELDS}` +
    `${models}` +
    `&timezone=auto` +
    `&wind_speed_unit=ms` +
    `&forecast_days=8`
  );
}
