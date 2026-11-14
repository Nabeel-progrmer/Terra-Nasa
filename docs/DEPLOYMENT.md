# Production deployment

The client is a static Vite/React application and can be deployed on Vercel. The Express API starts a long-lived alert scheduler and uses process-local caches, so it should run as a separate persistent Node web service rather than being moved into Vercel Functions without a redesign.

## Vercel frontend

1. Import the repository in Vercel and set **Root Directory** to `client`.
2. Select the Vite preset. Use `npm run build` and `dist` if Vercel does not detect them automatically.
3. Set the build environment variable `VITE_API_BASE_URL` to the HTTPS origin of the API service, for example `https://your-api.example.com`. This value is public configuration, not a secret.
4. Deploy and note the final HTTPS frontend origin.
5. Add the final origin (including any custom domain) to the API service's `CLIENT_URL`, then redeploy the API.

`client/vercel.json` sends client-side routes to the SPA entry point. API calls use `VITE_API_BASE_URL`; no server secret belongs in a `VITE_` variable.

## Express API on Render

The root `render.yaml` describes the existing long-running Express service. Create the service from the Blueprint and configure:

- `CLIENT_URL`: the exact Vercel frontend origin, such as `https://your-project.vercel.app`.
- `MONGODB_URI`: a TLS-enabled MongoDB Atlas URI for a least-privilege application user.
- `TRUST_PROXY_HOPS`: keep the Blueprint's `1` only if Render is the sole trusted proxy; otherwise set the exact verified proxy-hop count.
- Optional server-only integrations: `GROQ_API_KEY`, `NASA_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.

The API health check uses `/api`, which confirms the process is responding without treating an optional provider or database outage as a failed process health check. Verify `/api/health` separately for database readiness after deployment.

## Required and optional configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Vercel build environment | Public HTTPS API origin used by the browser. |
| `CLIENT_URL` | API service | Exact allowed frontend origin for CORS. |
| `MONGODB_URI` | API service secret store | Database connection; required by the existing production startup validation. |
| `GROQ_API_KEY` | API service secret store | Optional server-side Guide generation. |
| `NASA_API_KEY` | API service secret store | Optional higher NASA NeoWs quota. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | API service configuration | Optional push-alert delivery. Never expose the private key to the frontend. |

Use the variable names in [`.env.example`](../.env.example) as the complete application configuration reference. Never put database credentials, Groq keys, NASA keys, or the VAPID private key in Vercel client variables or source control. Configure HTTPS, Atlas network access/backups, and provider credentials in their respective dashboards.

## Verification and limitations

After deployment, verify the client routes, `/api/health`, CORS from the deployed origin, MongoDB readiness, and each configured provider independently. Test PWA installation on actual supported devices and test offline behavior after the first successful load. API data is not available offline.

No deployment has been run or verified from this workspace. Production credentials, Atlas access, Vercel/Render project access, final domains, and physical devices were not provided.
