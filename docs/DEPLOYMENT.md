# Production deployment

The client is a static Vite/React application and the Express API is exposed through a Vercel serverless function. The function reuses MongoDB connections while warm, but Vercel does not keep a process running between requests, so the periodic push-alert scheduler is not available in this deployment mode.

## Separate Vercel projects

### Backend project

1. Import the repository into Vercel. Set **Root Directory** to `server` and **Framework Preset** to Other.
2. Leave Build Command empty. The explicit `server/api/[...path].js` Function handles `/api/*`; do not use `npm run build --workspace=terra-client` or the long-running `src/server.js` entrypoint for this backend-only project.
3. `CLIENT_URL` defaults to `https://client-z2dm.vercel.app` for this backend project. Add `MONGODB_URI` for account and investigation persistence, plus optional server-only integrations such as SMTP, Groq, NASA, and VAPID keys as needed.
4. Deploy and copy the backend's production URL.

### Frontend project

Set `VITE_API_BASE_URL` in the frontend project's Production environment to the backend's HTTPS origin (for example, `https://your-api.vercel.app`) and redeploy the frontend. The server project allows the origin configured in `CLIENT_URL` for CORS.

## Database and serverless limits

The API health check uses `/api/health`; verify MongoDB readiness after deployment. MongoDB Atlas must allow network access from Vercel's serverless functions, typically through the provider's documented IP access approach. Serverless process-local rate limits and provider caches are per instance and are not globally shared. Push subscriptions can be stored, but periodic alert delivery requires a separately scheduled job and is not run by the Express function.

## Required and optional configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Frontend Vercel project | HTTPS origin of the backend project. |
| `CLIENT_URL` | Backend Vercel project | Defaults to the current frontend origin; override for a different frontend domain. |
| `MONGODB_URI` | Backend Vercel project | TLS-enabled database connection for persistence and accounts. |
| `GROQ_API_KEY` | Backend Vercel project | Optional server-side Guide generation. |
| `NASA_API_KEY` | Backend Vercel project | Optional higher NASA NeoWs quota. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Backend Vercel project | Push subscription configuration; never expose the private key to the frontend. Periodic delivery needs a separate scheduler. |

Use the variable names in [`.env.example`](../.env.example) as the complete application configuration reference. Never put database credentials, Groq keys, NASA keys, SMTP credentials, or the VAPID private key in `VITE_` variables or source control. Configure HTTPS, Atlas network access/backups, and provider credentials in Vercel's encrypted environment settings.

## Verification and limitations

After deployment, verify the backend's `/api/health`, CORS from the frontend origin, MongoDB readiness, and each configured provider independently. Test PWA installation on actual supported devices and test offline behavior after the first successful load. API data is not available offline.

The build can be verified from this workspace, but live Vercel deployment, production credentials, Atlas access, and device-specific PWA behavior must be verified in their respective environments.
