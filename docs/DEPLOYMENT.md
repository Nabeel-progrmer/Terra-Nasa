# Production deployment

The client is a static Vite/React application. The Express API can run as a persistent Render web service (recommended when scheduled push delivery is needed) or through the included Vercel serverless adapters. Vercel does not keep a process running between requests, so periodic push delivery is unavailable in serverless mode.

## Render persistent backend

The repository `render.yaml` defines a Node.js web service with root directory `backend`, build command `npm install`, start command `npm start`, and health check `/health`. Connect the repository as a Render Blueprint or create a Node web service with those settings. Render provides `PORT`; the server binds to `0.0.0.0`.

Set `CLIENT_URL` to the exact HTTPS origin of the deployed frontend. Add `MONGODB_URI` for account, investigation, and push-subscription persistence; public provider APIs can run without MongoDB, while persistence-backed routes return an unavailable response. Add SMTP, Groq, NASA, and VAPID settings only for features that need them. Use the names in [`../backend/.env.example`](../backend/.env.example); keep secrets in Render's environment settings.

For local development, create `backend/.env` from `backend/.env.example` and run `npm run dev` from the repository root. To start only the backend, run `npm start --prefix backend`. Health endpoints are `/health` and `/api/health`.

## Separate Vercel projects

### Backend project

1. Import the repository into Vercel. Set **Root Directory** to `backend` and **Framework Preset** to Other.
2. Leave Build Command empty. The `backend/api/[...path].js` function handles `/api/*`; the long-running `src/server.js` entrypoint is for Render or local use.
3. Set `CLIENT_URL` to the exact HTTPS origin of the deployed frontend. Add `MONGODB_URI` for account and investigation persistence and optional server-only integrations as needed.
4. Deploy and copy the backend's production URL.

### Frontend project

Set `VITE_API_BASE_URL` in the frontend project's Production environment to the backend's HTTPS origin (for example, `https://your-api.vercel.app`) and redeploy the frontend. The backend allows the origin configured in `CLIENT_URL` for CORS.

## Database and serverless limits

The health endpoints are `/health` and `/api/health`; verify MongoDB readiness after deployment. MongoDB Atlas must allow network access from the hosting provider. Serverless process-local rate limits and provider caches are per instance and are not globally shared. Push subscriptions can be stored, but periodic alert delivery needs a persistent process or separate scheduler.

## Required and optional configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `PORT` | Render/local backend | HTTP port; Render sets it automatically. |
| `CLIENT_URL` | Backend host | Exact allowed frontend origin; use HTTPS in production. |
| `MONGODB_URI` | Backend host | MongoDB connection for accounts, investigations, and alerts. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Backend host | Optional account email and verification flows. |
| `GROQ_API_KEY`, `GROQ_MODEL` | Backend host | Optional server-side Guide generation. |
| `NASA_API_KEY` | Backend host | Optional higher NASA NeoWs quota. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Backend host | Push configuration; never expose the private key to the frontend. |
| `CACHE_TTL_SECONDS`, `RATE_LIMIT_MAX`, `PROVIDER_TIMEOUT_MS`, `TRUST_PROXY_HOPS`, `ALERT_CHECK_INTERVAL_MS` | Backend host | Backend cache, request limits, timeouts, proxy, and alert schedule. |

Never put database credentials, Groq keys, NASA keys, SMTP credentials, or the VAPID private key in `VITE_` variables or source control. Configure provider credentials in the host's encrypted environment settings.

## Verification and limitations

After deployment, verify `/health`, CORS from the frontend origin, MongoDB readiness, and each configured provider independently. Live deployment, production credentials, database access, and device-specific push delivery must be verified in their respective environments.
