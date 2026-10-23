import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { Location, Settings } from '../types';
import { Icons } from './WeatherIcons';
import { Haptic } from '../lib/haptics';
import { useTranslatedText } from '../lib/translations';
import { AQI_SOURCES, DEFAULT_AQI_SOURCE_ID, getAqiSource } from '../services/aqi/registry';
import { AQI_SCALE_LABEL } from '../services/aqi/scale';
import type { AqiPreview, AqiSourceId, AqiSourceFamily } from '../services/aqi/types';
import { fetchAqiPreviews, getCachedAqiPreviews, emptyAqiPreviewMap, type AqiPreviewMap } from '../services/aqi/preview';

interface AirQualitySourcePageProps {
  settings: Settings;
  location?: Location;
  onSelect: (id: AqiSourceId) => void;
  onClose: () => void;
}

const GROUPS: { titleKey: string; families: AqiSourceFamily[] }[] = [
  { titleKey: 'Model forecasts', families: ['open-meteo'] },
  { titleKey: 'Monitoring stations', families: ['atmos', 'waqi'] },
];

function AqiRow({
  sourceId,
  preview,
  loading,
  selected,
  onSelect,
}: {
  key?: React.Key;
  sourceId: AqiSourceId;
  preview: AqiPreview | null;
  loading: boolean;
  selected: boolean;
  onSelect: (id: AqiSourceId) => void;
}) {
  const source = getAqiSource(sourceId);
  const hasValue = !!preview && !preview.isUnavailable && preview.aqi != null;

  const condition = hasValue
    ? `${preview?.category ?? '—'} · ${AQI_SCALE_LABEL[preview!.index]}`
    : loading && !preview
    ? '…'
    : preview?.reason ?? 'Unavailable';

  return (
    <button
      type="button"
      data-selected={selected ? 'true' : 'false'}
      onClick={() => onSelect(sourceId)}
      className={`w-full flex items-center justify-between gap-4 py-5 px-5 text-left transition-all duration-200 active:bg-app-text/[0.04] ${
        selected ? 'bg-app-text/[0.03]' : 'hover:bg-app-text/[0.01]'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-full bg-app-text/[0.04] border border-app-border flex items-center justify-center text-app-text-dim shrink-0">
          {hasValue && preview?.color ? (
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preview.color }} />
          ) : loading && !preview ? (
            <div className="w-[18px] h-[18px] rounded-full bg-app-text/10 animate-pulse" />
          ) : (
            <Icons.Wind className="w-[18px] h-[18px]" strokeWidth={1.8} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-[15.5px] font-semibold text-app-text tracking-tight leading-tight truncate">
              {source.name}
            </h4>
          </div>
          <p className="text-[13px] text-app-text-dim mt-1.5 leading-snug truncate">
            {loading && !preview ? (
              <span className="block h-3 w-24 rounded-full bg-app-text/10 animate-pulse" />
            ) : (
              condition
            )}
          </p>
          {hasValue && preview?.place ? (
            <p className="text-[11.5px] text-app-text-dim opacity-60 mt-0.5 leading-snug truncate">
              {preview.place}
            </p>
          ) : null}
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
                {hasValue ? preview!.aqi : '—'}
              </p>
              <p className="text-[11.5px] text-app-text-dim tabular-nums mt-1.5 leading-none">
                {hasValue
                  ? `${preview?.pm2_5 != null ? `PM2.5 ${Math.round(preview.pm2_5)} · ` : ''}${preview!.aqi} / ${preview!.scaleMax}`
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

export default function AirQualitySourcePage({ settings, location, onSelect, onClose }: AirQualitySourcePageProps) {
  const lang = settings.language || 'en';
  const selectedId = settings.aqiProvider ?? DEFAULT_AQI_SOURCE_ID;

  const [previews, setPreviews] = useState<AqiPreviewMap>(() => {
    if (!location) return emptyAqiPreviewMap();
    return getCachedAqiPreviews(location.latitude, location.longitude) ?? emptyAqiPreviewMap();
  });
  const [loading, setLoading] = useState(true);

  const lat = location?.latitude;
  const lon = location?.longitude;

  useEffect(() => {
    if (lat == null || lon == null) {
      setLoading(false);
      return;
    }
    let active = true;
    const cached = getCachedAqiPreviews(lat, lon);
    if (cached) {
      setPreviews(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchAqiPreviews(lat, lon)
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
  }, [lat, lon]);

  const pageTitle = useTranslatedText('Air quality source', lang);
  const previewForLabel = useTranslatedText('Preview for', lang);
  const footerNote = useTranslatedText(
    'Model sources interpolate a grid; station sources report a real monitor, possibly in a nearby city. Comparison values are a live preview.',
    lang
  );
  const emptyHint = useTranslatedText('Add a city to compare air quality sources.', lang);
  const groupTitles = [
    useTranslatedText('Model forecasts', lang),
    useTranslatedText('Monitoring stations', lang),
  ];

  const sections = useMemo(
    () =>
      GROUPS.map((group, index) => ({
        ...group,
        title: groupTitles[index],
        sources: AQI_SOURCES.filter((source) => group.families.includes(source.family)),
      })),
    [groupTitles[0], groupTitles[1]]
  );

  return (
    <div
      id="air-quality-source-page"
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

      {location && (
        <div className="flex items-center gap-2 px-1 mb-5">
          <Icons.MapPin className="w-3.5 h-3.5 text-app-text-dim shrink-0" strokeWidth={2} />
          <p className="text-[13px] text-app-text-dim leading-snug truncate">
            {previewForLabel} · {location.name}{location.country ? `, ${location.country}` : ''}
          </p>
        </div>
      )}

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
            {section.sources.map((source) => (
              <AqiRow
                key={source.id}
                sourceId={source.id}
                preview={previews[source.id] ?? null}
                loading={loading}
                selected={source.id === selectedId}
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
