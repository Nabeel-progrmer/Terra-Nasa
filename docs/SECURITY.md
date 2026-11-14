# Backend security and privacy

## Implemented controls

- Helmet security headers; Express fingerprint header disabled.
- Exact-origin CORS allowlist; local Vite origins are enabled only in development.
- JSON body limit of 256 KB, URL-encoded body limit of 32 KB, and strict Zod schemas for user-controlled query/body fields.
- Global per-IP rate limit, an additional change-analysis rate limit, and a stricter investigation-create limit.
- In-memory rate limits and provider cache are per server process. Multi-instance deployments need a shared rate-limit store and shared cache for consistent limits and deduplication.
- Fixed provider hostnames; no user-controlled URL is fetched by provider adapters.
- Push subscriptions accept HTTPS endpoints only on the supported browser push-service hosts; arbitrary endpoints and custom ports are rejected before storage or delivery.
- Account passwords use Node.js scrypt with per-password random salts; sessions and email action tokens are random, expire, and are stored only as SHA-256 hashes.
- Session cookies are HttpOnly, SameSite=Lax in local development and Secure/SameSite=None in production for the separate Vercel/API origins. Mutating account and private-note routes require an exact trusted Origin; CORS allows credentials only for configured origins.
- Research notes are filtered by authenticated `ownerId`; learning bookmarks, completion, and recent history are persisted to the signed-in user's record.
- Upstream JSON requests have a timeout, schema sanity checks, bounded in-memory cache, and generic provider failure handling.
- MongoDB inputs are validated scalar fields; arbitrary Mongo query objects are never accepted.
- Secret values are not returned by `/api/config-status` or intentionally logged.
- Production requires MongoDB and an HTTPS client origin. Provider-backed read endpoints stay available in degraded database state; persistence returns 503.

## Account and legacy-data limitations

Email-based account flows require valid SMTP credentials, which are not present in this workspace. They return a clear service-unavailable response until configured. MongoDB-backed integration, email delivery, session expiry, and multi-account isolation have not been tested against a live deployment. CORS is a browser policy, not a substitute for authentication; private routes also enforce session and owner checks.

Investigation records created by the earlier anonymous version have no `ownerId`. They are deliberately inaccessible through the authenticated API and require a separately reviewed, explicitly authorized migration before they can be assigned to accounts.

## Deployment requirements

- Serve the browser and API over HTTPS.
- Use a dedicated, least-privilege MongoDB account and TLS-enabled database connection; restrict network access and maintain protected backups.
- Store `MONGODB_URI` in a deployment secret manager. Never commit `.env` files.
- If deployed behind a reverse proxy, set `TRUST_PROXY_HOPS` to the exact trusted hop count so rate limits use the client address safely. Do not trust arbitrary forwarded headers.
- Set `CLIENT_URL` to the precise frontend origin.
- Apply dependency updates and monitor MongoDB/provider availability.

## Not implemented

Authentication roles, application-level encryption of research notes, security audit logging, and migration of legacy anonymous notes are not implemented. Account authentication, email verification/reset, per-user notes, and learning-state sync are implemented but require production MongoDB/SMTP configuration and integration verification.
