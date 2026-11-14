# TERRA — Earth change intelligence

TERRA brings together public Earth and space science data with a guided regional trend-analysis workspace. It distinguishes observations, model/reanalysis estimates, forecasts, catalog records, and calculations, and displays source provenance and known limitations alongside results.

## NASA Space Apps 2026 challenge workflow

The Earth Change workspace lets a user select one of four NASA POWER monthly meteorological variables, choose one or more of six example coordinates, set a period of at least ten years, and retrieve and chart annual values. It reports a Theil–Sen rate of change, period change, Mann–Kendall trend evidence, a within-request adjusted q-value, and a separately labeled approximate OLS slope interval. The workflow accepts a single location as well as comparisons. NASA POWER points represent nearest MERRA-2 grid cells, not entire regions. See [challenge fit and limitations](docs/NASA_SPACE_APPS_REQUIREMENT_REVIEW.md) before interpreting results.

## Other application areas

- **Earth Explorer:** place-name lookup, USGS earthquake reports, and NASA GIBS Aura OMI total-column ozone imagery. Image colors are not point-level ozone measurements or health guidance.
- **Weather:** Open-Meteo current model fields and forecast timelines, labeled as model/forecast output rather than local station readings.
- **Space Explorer:** the 1976 U.S. Standard Atmosphere reference model; NOAA SWPC indices, GOES X-ray observations and propagated solar-wind estimates; NASA/JPL close-approach predictions; Astronomy Engine calculations; NASA Exoplanet Archive records; and bounded NASA PDS browsing with opt-in decoding of supported PDS4 tables.
- **Learning Center and Guide:** searchable articles, article-aware guide context, and optional server-configured Groq replies. Generated answers may be wrong and require source verification.
- **Accounts and investigations:** email-verified accounts, server sessions, account learning-state sync, and owner-filtered research notes when MongoDB and SMTP are configured.
- **Alerts:** browser push subscriptions when MongoDB, VAPID configuration, browser permission, and a reachable continuously running server are available.

The language selector offers **English and Urdu**. English is canonical. Urdu translations cover the shared interface catalogs and Learning Center articles, but some hard-coded page copy, source names, scientific terms, provider text, and dynamic data labels may remain English or in their original form. Urdu content has not received independent fluent editorial review.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install` from the project root.
3. Configure server settings in `.env` when needed. MongoDB is required for account and investigation persistence; SMTP is required for account email; VAPID keys are required for push notifications. Do not commit secrets.
4. Start the client and API with `npm run dev`.
5. Open the Vite URL, normally `http://localhost:5173`. The API index is normally at `http://localhost:5000/api`.

Without MongoDB, public provider pages can still work, while persistence-dependent operations report a degraded/unavailable state. Production requires HTTPS and correct client/API origin configuration. See [deployment notes](docs/DEPLOYMENT.md).

## Implemented backend APIs

- `GET /api/health` and `GET /api/config-status` — health and non-secret configuration status.
- `GET /api/weather?latitude=24.86&longitude=67.01` and `GET /api/geocode?q=Karachi` — weather and place lookup.
- `GET /api/events?feed=all_day&limit=20` — USGS earthquake feed.
- `GET /api/variables` and `GET /api/change-analysis?...` — NASA POWER variable catalog and trend workflow.
- `GET /api/earth/ozone` — NASA GIBS OMI imagery date and tile metadata.
- `GET /api/space/atmosphere`, `/api/space/space-weather`, `/api/space/near-earth-objects`, `/api/space/ephemeris`, and `/api/space/exoplanets` — space and atmosphere features.
- `GET /api/space/planetary-archive` and `/api/space/planetary-archive/decode` — NASA PDS registry and supported table decoding.
- `GET /api/data-sources` — implemented source registry; it does not claim provider uptime.
- `/api/auth/*`, `/api/account/learning-state`, and `/api/investigations/*` — account and persistence endpoints.

## Checks

- `npm test` — client tests.
- `npm run test:server` — server tests.
- `npm run build` — production client build.

Read [data sources](docs/DATA_SOURCES.md), [scientific methods](docs/SCIENTIFIC_METHODS.md), [challenge fit](docs/NASA_SPACE_APPS_REQUIREMENT_REVIEW.md), [Learning Center](docs/LEARNING_CENTER.md), [security](docs/SECURITY.md), and [testing report](docs/TESTING_REPORT.md) for details and limits.
