# TERRA verification report

Last checked: 2026-11-15.

## Automated checks

- Client: `npm test` — 14 test files passed, 62 tests passed.
- Server: `npm run test:server` — 6 test files passed, 65 tests passed, 1 skipped.
- Client production build: `npm run build --prefix client` — passed.
- Backend install: `npm ci --prefix backend` — passed with the synchronized lockfile.
- Backend dependency audit: `npm audit --prefix backend` — 0 vulnerabilities.
- The client suite checks page behavior, localization, PWA handling, stale/offline state, selected provider-response flows, and submitting a single-location trend analysis. The server suite checks request validation, health endpoints, production configuration diagnostics, response normalization, failure handling, source metadata, atmosphere and astronomy endpoints, PDS decoding, and NASA POWER trend behavior using deterministic fixtures.

Chart tests emit non-fatal Recharts zero-size-container warnings in the test DOM. They do not fail the suite.

## Scientific-method review

- The regional trend implementation uses NASA POWER monthly point data for four documented variables. Annual means are weighted by calendar days; years with fewer than 10 valid months are excluded; Sen slopes use actual year differences; the two-sided Mann–Kendall test applies tie correction; and Benjamini–Hochberg adjustment is applied across successfully analyzed selected regions.
- Automated trend fixtures cover a known linear trend, a Student-t OLS slope interval, and missing-month coverage. They do not establish scientific validity for every source record, location, time period, or research question.
- The OLS interval is for the OLS slope, not the Sen slope. Its interpretation depends on regression assumptions. Serial correlation and spatial dependence are not corrected, the Mann–Kendall p-value uses a normal approximation, and significance is not evidence of causation or practical importance.
- The standard-atmosphere endpoint is a calculation from the documented 1976 reference model, not an observation or a locally varying atmosphere. The Astronomy Engine endpoint is an approximate calculation and carries no numeric accuracy guarantee.
- Provider records are validated and normalized according to the code and fixtures; automated tests do not independently certify the scientific accuracy of provider instruments, upstream processing, live data freshness, or every provider schema change.

## External verification and limits

- NASA POWER monthly parameter availability and meteorological source descriptions were checked against NASA POWER's official API and methodology documentation: [Monthly API](https://power.larc.nasa.gov/docs/services/api/temporal/monthly/), [meteorological sources](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/), and [temporal processing](https://power.larc.nasa.gov/docs/methodology/data/processing/).
- The 1976 standard-atmosphere source is NASA NTRS report [19770009539](https://ntrs.nasa.gov/citations/19770009539).
- This review did not constitute a live end-to-end validation of every external provider or a physical-device/browser compatibility study. Provider uptime, source schema changes, account/push delivery, and live database persistence remain environment-dependent.
- No independent scientific peer review, formal regulatory approval, or universal accuracy guarantee is claimed. For research or operational decisions, users should verify the underlying source records and consult a domain expert appropriate to the use case.
