import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { Location, Settings } from '../types';
import { Icons, WeatherIcon } from './WeatherIcons';
import { getWeatherInfo } from '../services/weatherService';
import { Haptic } from '../lib/haptics';
import { useTranslatedText } from '../lib/translations';
import {
  PROVIDERS,
  DEFAULT_PROVIDER_ID,
  getProvider,
} from '../services/providers/registry';
import type { ProviderId, ProviderPreview } from '../services/providers/types';
import {
  fetchProviderPreviews,
  getCachedProviderPreviews,
  type ProviderPreviewMap,
} from '../services/providerPreview';

interface WeatherSourcePageProps {
  settings: Settings;
  location?: Location;
  onSelect: (id: ProviderId) => void;
  onClose: () => void;
}

function emptyPreviewMap(): ProviderPreviewMap {
  const map = {} as ProviderPreviewMap;
  for (const provider of PROVIDERS) map[provider.id] = null;
  return map;
}

const GROUPS: { titleKey: string; fidelity: 'full' | 'partial' }[] = [
  { titleKey: 'Forecast models', fidelity: 'full' },
  { titleKey: 'Independent sources', fidelity: 'partial' },
];

function ProviderRow({
  providerId,
  preview,
  loading,
  selected,
  settings,
  onSelect,
}: {
  key?: React.Key;
  providerId: ProviderId;
  preview: ProviderPreview | null;
  loading: boolean;
  selected: boolean;
  settings: Settings;
  onSelect: (id: ProviderId) => void;
}) {
  const provider = getProvider(providerId);
  const info = preview ? getWeatherInfo(preview.code ?? 0, preview.isDay) : null;

  const condition = preview
    ? info?.label ?? 'Unknown'
    : loading
    ? '…'
    : 'Unavailable';

  return (
    <button
      type="button"
      data-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect(providerId)}
      className={`w-full flex items-center justify-between gap-4 py-5 px-5 text-left transition-all duration-200 active:bg-app-text/[0.04] ${
        selected ? 'bg-app-text/[0.03]' : 'hover:bg-app-text/[0.01]'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-full bg-app-text/[0.04] border border-app-border flex items-center justify-center text-app-text-dim shrink-0">
          {preview ? (
            <WeatherIcon
              name={info?.icon ?? 'Cloud'}
              style={settings.iconStyle}
              className="w-[22px] h-[22px]"
              isSettingsPreview
            />
          ) : (
            <div className="w-[18px] h-[18px] rounded-full bg-app-text/10 animate-pulse" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-[15.5px] font-semibold text-app-text tracking-tight leading-tight truncate">
              {provider.name}
            </h4>
          </div>
          <p className="text-[13px] text-app-text-dim mt-1.5 leading-snug truncate">
            {loading && !preview ? (
              <span className="block h-3 w-24 rounded-full bg-app-text/10 animate-pulse" />
            ) : (
              condition
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <div className="text-right">
          {loading && !preview ? (
            <div className="flex flex-col items-end gap-1.5">
              <span className="block h-4 w-9 rounded-full bg-app-text/10 animate-pulse" />
              <span className="block h-2.5 w-12 rounded-full bg-app-text/[0.07] animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-[17px] font-semibold text-app-text tracking-tight tabular-nums leading-none">
                {preview?.temp != null ? `${Math.round(preview.temp)}°` : '—'}
              </p>
              <p className="text-[11.5px] text-app-text-dim tabular-nums mt-1.5 leading-none">
                {preview?.high != null && preview?.low != null
                  ? `${Math.round(preview.high)}° / ${Math.round(preview.low)}°`
                  : ''}
              </p>
            </>
          )}
        </div>

        <div className="w-[18px] flex items-center justify-center shrink-0">
          {selected && <Check className="w-[18px] h-[18px] text-app-text" strokeWidth={2.6} />}
        </div>
      </div>
    </button>
  );
}

export default function WeatherSourcePage({ settings, location, onSelect, onClose }: WeatherSourcePageProps) {
  const lang = settings.language || 'en';
  const selectedId = settings.weatherProvider ?? DEFAULT_PROVIDER_ID;

  const [previews, setPreviews] = useState<ProviderPreviewMap>(() => {
    if (!location) return emptyPreviewMap();
    return getCachedProviderPreviews(location.latitude, location.longitude) ?? emptyPreviewMap();
  });
  const [loading, setLoading] = useState(true);

  const lat = location?.latitude;
  const lon = location?.longitude;
  const timezone = location?.timezone || 'auto';

  useEffect(() => {
    if (lat == null || lon == null) {
      setLoading(false);
      return;
    }
    let active = true;
    const cached = getCachedProviderPreviews(lat, lon);
    if (cached) {
      setPreviews(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchProviderPreviews(lat, lon, timezone)
      .then((map) => {
        if (!active) return;
        setPreviews(map);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lat, lon, timezone]);

  const pageTitle = useTranslatedText('Weather source', lang);
  const footerNote = useTranslatedText(
    'Partial sources report fewer fields; missing values are filled from Open-Meteo. Comparison values are a live preview.',
    lang
  );
  const emptyHint = useTranslatedText('Add a city to compare weather sources.', lang);
  const groupTitles = [
    useTranslatedText('Forecast models', lang),
    useTranslatedText('Independent sources', lang),
  ];

  const sections = useMemo(
    () =>
      GROUPS.map((group, index) => ({
        ...group,
        title: groupTitles[index],
        providers: PROVIDERS.filter((p) => p.fidelity === group.fidelity),
      })),
    [groupTitles[0], groupTitles[1]]
  );

  return (
    <div
      id="weather-source-page"
      data-no-swipe
      className="max-w-[390px] mx-auto min-h-screen px-6 pt-[calc(env(safe-area-inset-top,24px)+56px)] pb-32"
    >
      <header className="flex items-center justify-between mb-8 px-1 h-10 w-full">
        <h1 className="text-[28px] font-bold text-app-text tracking-tight">{pageTitle}</h1>
        <button
          type="button"
          onClick={() => {
            Haptic.light(settings.hapticEnabled);
            onClose();
          }}
          className="w-12 h-12 bg-app-surface border border-app-border rounded-full flex items-center justify-center text-app-text hover:bg-app-surface/80 transition-all shadow-xl select-none"
        >
          <Icons.ChevronLeft className="w-5.5 h-5.5 text-app-text" strokeWidth={2.5} />
        </button>
      </header>

      {!location && (
        <div className="w-full bg-app-surface border border-app-border rounded-[24px] px-5 py-6 mb-8">
          <p className="text-[13px] text-app-text-dim leading-snug">{emptyHint}</p>
        </div>
      )}

      {sections.map((section) => (
        <div key={section.titleKey} className="mb-8">
          <h3 className="text-[11px] font-semibold tracking-[0.1em] text-app-text-dim uppercase mb-3 px-1">
            {section.title}
          </h3>
          <div className="w-full bg-app-surface border border-app-border rounded-[24px] divide-y divide-app-border overflow-hidden shadow-2xl">
            {section.providers.map((provider) => (
              <ProviderRow
                key={provider.id}
                providerId={provider.id}
                preview={previews[provider.id] ?? null}
                loading={loading}
                selected={provider.id === selectedId}
                settings={settings}
                onSelect={(id) => {
                  if (id === selectedId) return;
                  Haptic.medium(settings.hapticEnabled);
                  onSelect(id);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <p className="text-[12px] text-app-text-dim opacity-60 leading-relaxed px-1 mb-8">{footerNote}</p>

      <div className="flex flex-col items-center justify-center pt-4 pb-4 text-center w-full">
        <p className="text-[12px] font-semibold text-app-text-dim opacity-40 tracking-tight">&copy; 2026 Overcast</p>
      </div>
    </div>
  );
}
