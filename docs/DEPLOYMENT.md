# Production deployment

The client is a static Vite/React application and the Express API is exposed through a Vercel serverless function. The function reuses MongoDB connections while warm, but Vercel does not keep a process running between requests, so the periodic push-alert scheduler is not available in this deployment mode.

## Vercel deployment

1. Import the repository in Vercel and set **Root Directory** to the repository root (`.`). The client imports shared JSON files from the root-level `shared` directory, so Vercel must build from the monorepo root.
2. The root `vercel.json` selects Vite, installs development dependencies, builds only the `terra-client` workspace, publishes `client/dist`, and routes `/api/*` to the serverless Express handler in `api/[...path].js`.
3. The API automatically allows the Vercel production and current deployment origins for CORS and trusts Vercel's proxy. Set `MONGODB_URI` to a TLS-enabled MongoDB Atlas URI for account and investigation persistence. Add optional server-only integrations such as SMTP, Groq, NASA, and VAPID keys as needed.
4. Leave `VITE_API_BASE_URL` empty because the browser and API share the same Vercel origin. Never put server secrets in a `VITE_` variable.
5. Deploy. If the frontend domain changes, update `CLIENT_URL` to that exact origin and redeploy.

`vercel.json` sends client-side routes to the SPA entry point. API calls use `VITE_API_BASE_URL`; no server secret belongs in a `VITE_` variable.

## Database and serverless limits

The API health check uses `/api/health`; verify MongoDB readiness after deployment. MongoDB Atlas must allow network access from Vercel's serverless functions, typically through the provider's documented IP access approach. Serverless process-local rate limits and provider caches are per instance and are not globally shared. Push subscriptions can be stored, but periodic alert delivery requires a separately scheduled job and is not run by the Express function.

## Required and optional configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `TRUST_PROXY_HOPS` | Vercel server environment | Set to `1` for Vercel's proxy. |
| `VITE_API_BASE_URL` | Vercel build environment | Leave empty when frontend and API share the Vercel origin. |
| `CLIENT_URL` | Optional Vercel server environment | Override the automatically detected Vercel origin when using a separate custom frontend domain. |
| `MONGODB_URI` | Vercel server environment | TLS-enabled database connection for persistence and accounts. |
| `GROQ_API_KEY` | Vercel server environment | Optional server-side Guide generation. |
| `NASA_API_KEY` | Vercel server environment | Optional higher NASA NeoWs quota. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Vercel server environment | Push subscription configuration; never expose the private key to the frontend. Periodic delivery needs a separate scheduler. |

Use the variable names in [`.env.example`](../.env.example) as the complete application configuration reference. Never put database credentials, Groq keys, NASA keys, SMTP credentials, or the VAPID private key in `VITE_` variables or source control. Configure HTTPS, Atlas network access/backups, and provider credentials in Vercel's encrypted environment settings.

## Verification and limitations

After deployment, verify the client routes, `/api/health`, CORS from the deployed origin, MongoDB readiness, and each configured provider independently. Test PWA installation on actual supported devices and test offline behavior after the first successful load. API data is not available offline.

The build can be verified from this workspace, but live Vercel deployment, production credentials, Atlas access, and device-specific PWA behavior must be verified in their respective environments.
