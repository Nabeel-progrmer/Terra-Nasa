# TERRA backend setup

## Requirements

- Node.js 20 or newer (the server uses native `fetch` and `AbortSignal.timeout`).
- MongoDB for saved investigations. Public weather, earthquake, data-source, and trend endpoints can run without MongoDB.
- Network access from the server to Open-Meteo Forecast and Geocoding APIs, USGS, and NASA POWER.
- Network access to NOAA SWPC, NASA NeoWs, the NASA PDS Registry and supported PDS data hosts, and the NASA Exoplanet Archive for the Space Explorer. Astronomy Engine ephemerides are calculated locally.

## Local setup

1. Copy `.env.example` to `server/.env` (or the project root `.env`; the server loads both locations).
2. To save investigations, start MongoDB locally and set `MONGODB_URI=mongodb://127.0.0.1:27017/terra`, or use a MongoDB deployment with a dedicated, least-privilege account. Leave it blank for provider-only use.
3. Install dependencies with `npm install` from the project root.
4. Start the stack with `npm run dev`.
5. Open `GET http://localhost:5000/api` for the endpoint index and `GET /api/health` for liveness/readiness.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | `development` or `production`. |
| `PORT` | No | Express listen port; defaults to 5000. |
| `CLIENT_URL` | Production | Exact browser origin allowed by CORS. Production requires HTTPS. |
| `MONGODB_URI` | For saved investigations; always in production | Mongoose connection URI. Keep credentials in a secret manager. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | For account email | SMTP transport for verification and password-reset links. Credentials stay on the API server. |
| `GROQ_API_KEY` | No | Optional server-only key for Groq-generated Guide answers. Never expose it in the client or commit it. |
| `GROQ_MODEL` | No | Groq model ID enabled for your account; defaults to `openai/gpt-oss-120b`. |
| `NASA_API_KEY` | No | NASA key for NeoWs. The app falls back to NASA's shared `DEMO_KEY`, which has a low shared quota; add your own key for regular or production use. Keep it server-side. |
| `OPEN_METEO_BASE_URL` | No | Open-Meteo forecast API host; defaults to `https://api.open-meteo.com`. |
| `CACHE_TTL_SECONDS` | No | In-memory provider response cache. Use 0 to disable; defaults to 300. |
| `RATE_LIMIT_MAX` | No | General per-IP limit per 15-minute window; defaults to 250. |
| `PROVIDER_TIMEOUT_MS` | No | Upstream request timeout from 1000 to 60000 ms; defaults to 12000. |
| `TRUST_PROXY_HOPS` | Deployment dependent | Number of trusted reverse-proxy hops. Leave 0 unless the service is behind a known proxy. |

The implemented public endpoints can run without MongoDB. NASA NeoWs uses a shared `DEMO_KEY` if `NASA_API_KEY` is absent, but its shared quota is limited. NOAA SWPC, PDS, NASA Exoplanet Archive, and Astronomy Engine do not require a key. NASA POWER's monthly meteorological fields are MERRA-2 reanalysis estimates, not direct satellite measurements. PDS decoding is opt-in and limited to supported delimited product schemas. Groq Guide users can explicitly attach a provider-backed weather or space-weather context; the default sends no user-specific live data. See [data sources](./DATA_SOURCES.md), [scientific methods](./SCIENTIFIC_METHODS.md), and [Guide and alert setup](./GUIDE_AND_ALERTS.md).

## MongoDB behavior

The service starts in development without MongoDB, but saved-investigation endpoints return HTTP 503 and `/api/health` reports degraded readiness. In production, `MONGODB_URI` and an HTTPS `CLIENT_URL` are required at startup. If MongoDB becomes unavailable after startup, provider-backed read endpoints continue working while persisted investigation requests return 503.

Account registration and password reset return an explicit service-unavailable error until SMTP is configured. Verification links expire after 24 hours; password-reset links expire after one hour. Sessions are random opaque tokens stored as hashes in MongoDB, expire after 30 days, and use HttpOnly cookies. Cross-site production cookies require HTTPS and exact CORS `CLIENT_URL` configuration.

Research notes and Learning Center bookmarks/progress are available only to a signed-in, verified account. Legacy anonymous investigation records have no owner and are deliberately excluded from the private API; they are not automatically assigned to any account.

### MongoDB Atlas DNS troubleshooting

- If startup reports `querySrv ECONNREFUSED`, Node could not resolve the Atlas SRV record. On Windows, TERRA now reads the operating system's configured IPv4 DNS servers for MongoDB Atlas resolution; it does not change Windows network settings.
- If connection still fails, confirm that the Atlas cluster is running, copy a fresh driver connection string from Atlas, and check Atlas Network Access and the database user's permissions. Network allow-list or credentials errors occur after DNS resolution; do not paste a URI or password into an issue or chat.
- The health endpoint remains `degraded` and persisted investigations return `503` until MongoDB actually connects. Public provider-backed weather and science pages remain available.

## Reverse proxies and deployment

- Terminate TLS at a trusted proxy and set `CLIENT_URL` to the exact HTTPS frontend origin.
- Set `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops; do not set it broadly to `true` on an internet-facing service.
- Configure MongoDB network access, TLS, backups, and least-privilege credentials separately.
- Health endpoint: `/api/health` (process liveness plus MongoDB readiness).
- API index: `/api`.
