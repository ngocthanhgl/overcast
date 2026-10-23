<p align="center">
  <img src="brand/logo/logo-lockup.png" width="320" alt="Solnim">
</p>

<div align="center">
  <h3>Solnim</h3>
  <p>A clean weather app: real-time conditions, hourly and 7-day forecasts, air quality, UV index and live radar — built as a fast, offline-friendly PWA and Android app.</p>
  <p><sub>sol (sun) + nim (nimbus)</sub></p>
</div>

<p align="center">
  <img alt="Downloads" src="https://img.shields.io/github/downloads/ngocthanhgl/solnim/total?style=for-the-badge&logo=github">
  <img alt="Latest Release" src="https://img.shields.io/github/v/release/ngocthanhgl/solnim?style=for-the-badge">
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge">
</p>

---

## Features

- **Real-time weather** — temperature, humidity, precipitation, visibility, wind, pressure
- **Hourly + 7-day forecast** with switchable animated / static / outline icons
- **Air quality** — five sources with their own index scale (US EPA, European EEA, CPCB): CAMS Global (US + EU), CAMS Europe, atmos.today, WAQI ground stations
- **Weather source picker** — compare 15 forecast providers side by side, then pick the one the app uses
- **UV index, sun & moon, pollen, rain graph** tiles you can reorder
- **Live radar** (Windy) with a map reset control for stuck pinch gestures
- **Multi-city** — swipe between cities, background location refresh
- **Alerts** — rain, snow, storm, severe weather and air quality thresholds, plus push notifications
- **Light and dark** themes, 8 accent colours, 17 languages

## Data sources

| Data | Source |
|------|--------|
| Weather | [Open-Meteo](https://open-meteo.com) model families (ECMWF, GFS, ICON, CMA, JMA, UKMO, Météo-France, GEM, KNMI, DMI), plus MET Norway and wttr.in |
| Air quality | CAMS via Open-Meteo, [atmos.today](https://atmos.today) and WAQI/AQICN ground stations (via a server-side proxy) |
| Geocoding | Open-Meteo geocoding (GeoNames) + Photon (OpenStreetMap), Nominatim as a last resort |
| Radar | [Windy](https://windy.com) embed |
| Icons | [amCharts](https://amcharts.com) weather icons, [Lucide](https://lucide.dev) |

## Requirements

- Node.js 22+
- Android SDK (only for building the APK)

## Development

```bash
npm ci
npm run dev      # Vite dev server
npm run build    # web app -> dist/, plus the Node server bundle
```

Environment (optional, server side only):

| Variable | Purpose |
|----------|---------|
| `AQICN_TOKEN` | WAQI/AQICN token. Used at build time (scrambled into the bundle) and by `api/aqicn-proxy` if you prefer a proxy. |
| `VITE_AQI_PROXY_BASE` | Public base URL of an AQICN proxy. When set, the app calls the proxy instead of carrying the token. |
| `GEMINI_API_KEY` | Translation/feedback endpoints in `server.ts`. |

## Android

The APK is built by `.github/workflows/build-apk.yml`: it builds the web app, scaffolds Capacitor, applies the launcher resources from `brand/android/res`, removes the splash art, disables the WebView scrollbars natively, signs with the release keystore and publishes a GitHub Release.

`applicationId`: `app.solnim.weather`

## Project layout

```
src/            React app (components, services, providers, lib)
api/            Vercel serverless functions (proxies, cron)
brand/          Logo, icons, social preview, Android launcher resources
public/         Static assets served by the web app
.github/        CI: signed APK build + release
```

## Brand

Logo, icon and palette: see [`brand/BRAND.md`](brand/BRAND.md).

## Licence

MIT.

Solnim is a fork of [aryannvx/overcast](https://github.com/aryannvx/overcast) (MIT). The original project's copyright notice is retained, and thanks go to its author and to the data providers listed above.
