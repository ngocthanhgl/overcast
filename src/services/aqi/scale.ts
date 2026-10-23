/**
 * Air quality index scales. Every source reports on its own scale, so bands, colours,
 * gauge range and labels all come from here instead of a hardcoded 0–500.
 */
export type AqiIndex = 'us_epa' | 'eea' | 'cpcb';

export interface AqiBand {
  /** Inclusive upper bound of the band. */
  max: number;
  label: string;
  color: string;
  recommendation: string;
}

const US_EPA_BANDS: AqiBand[] = [
  { max: 50, label: 'Good', color: '#00e400', recommendation: 'Ideal for outdoor activities.' },
  { max: 100, label: 'Moderate', color: '#FED60A', recommendation: 'Acceptable quality; sensitive groups should limit exertion.' },
  { max: 150, label: 'Unhealthy for Sensitive Groups', color: '#ff7e00', recommendation: 'Sensitive groups should reduce prolonged outdoor activity.' },
  { max: 200, label: 'Unhealthy', color: '#ff0000', recommendation: 'Everyone should reduce prolonged outdoor exertion.' },
  { max: 300, label: 'Very Unhealthy', color: '#8f3f97', recommendation: 'Avoid outdoor activity. Keep windows closed.' },
  { max: Infinity, label: 'Hazardous', color: '#7e0023', recommendation: 'Stay indoors. Health emergency conditions.' },
];

const EEA_BANDS: AqiBand[] = [
  { max: 20, label: 'Good', color: '#50f0e6', recommendation: 'Excellent air quality. Perfect for outdoor activity.' },
  { max: 40, label: 'Fair', color: '#50ccaa', recommendation: 'Air quality is acceptable for most people.' },
  { max: 60, label: 'Moderate', color: '#f0e641', recommendation: 'Sensitive groups may notice mild symptoms.' },
  { max: 80, label: 'Poor', color: '#ff5050', recommendation: 'Reduce strenuous outdoor activity.' },
  { max: 100, label: 'Very Poor', color: '#960032', recommendation: 'Avoid outdoor exertion. Keep windows closed.' },
  { max: Infinity, label: 'Extremely Poor', color: '#7d2181', recommendation: 'Stay indoors. Follow local health advice.' },
];

const CPCB_BANDS: AqiBand[] = [
  { max: 50, label: 'Good', color: '#00b050', recommendation: 'Ideal for outdoor activities.' },
  { max: 100, label: 'Satisfactory', color: '#92d050', recommendation: 'Acceptable air quality for general public.' },
  { max: 200, label: 'Moderate', color: '#FED60A', recommendation: 'May cause breathing discomfort to people with sensitive lungs.' },
  { max: 300, label: 'Poor', color: '#ff7e00', recommendation: 'May cause breathing discomfort on prolonged exposure.' },
  { max: 400, label: 'Very Poor', color: '#ff0000', recommendation: 'May cause respiratory illness on prolonged exposure.' },
  { max: Infinity, label: 'Severe', color: '#7e0023', recommendation: 'May cause respiratory effects even on healthy people.' },
];

const BANDS: Record<AqiIndex, AqiBand[]> = {
  us_epa: US_EPA_BANDS,
  eea: EEA_BANDS,
  cpcb: CPCB_BANDS,
};

/** Highest value the gauge shows. Open ended bands sit at the end of the track. */
export const AQI_SCALE_MAX: Record<AqiIndex, number> = {
  us_epa: 500,
  eea: 100,
  cpcb: 500,
};

export const AQI_SCALE_LABEL: Record<AqiIndex, string> = {
  us_epa: 'AQI (US)',
  eea: 'EAQI (EU)',
  cpcb: 'AQI (India)',
};

export function bandsFor(index: AqiIndex): AqiBand[] {
  return BANDS[index] ?? US_EPA_BANDS;
}

export function categoryFor(value: number, index: AqiIndex = 'us_epa'): AqiBand {
  const bands = bandsFor(index);
  for (const band of bands) {
    if (value <= band.max) return band;
  }
  return bands[bands.length - 1];
}

/** Position on an even-band gauge, 0–100. Matches the classic US EPA layout. */
export function percentInScale(value: number, index: AqiIndex = 'us_epa'): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const bands = bandsFor(index);
  const segment = 100 / bands.length;
  let previousMax = 0;
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (value <= band.max) {
      const span = band.max - previousMax;
      const within = span > 0 ? Math.min(1, Math.max(0, (value - previousMax) / span)) : 0;
      return segment * i + within * segment;
    }
    if (i === bands.length - 1) return 100;
    previousMax = band.max;
  }
  return 100;
}

export interface AqiTick {
  label: string;
  percent: number;
}

/** Gauge ticks: 0, each finite band edge, and the scale maximum. */
export function ticksFor(index: AqiIndex): AqiTick[] {
  const bands = bandsFor(index);
  const segment = 100 / bands.length;
  const ticks: AqiTick[] = [{ label: '0', percent: 0 }];
  let position = 0;
  for (let i = 0; i < bands.length; i++) {
    position = segment * (i + 1);
    const last = i === bands.length - 1;
    if (last) {
      const max = AQI_SCALE_MAX[index];
      const lastFinite = bands[bands.length - 2]?.max ?? 0;
      if (max > lastFinite) ticks.push({ label: String(max), percent: 100 });
    } else {
      ticks.push({ label: String(bands[i].max), percent: position });
    }
  }
  return ticks;
}

/** Gradient stops for the gauge track, one colour per band. */
export function gradientStops(index: AqiIndex): { color: string; from: number; to: number }[] {
  const bands = bandsFor(index);
  const segment = 100 / bands.length;
  return bands.map((band, i) => ({ color: band.color, from: segment * i, to: segment * (i + 1) }));
}
