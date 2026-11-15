# TERRA backend

Express API source, tests, and deployment configuration for TERRA.

## Local development

From the repository root, install with `npm install`, configure `backend/.env` from `.env.example`, then run `npm run dev --prefix backend`. The API listens on `0.0.0.0` and defaults to port 5000. Public provider routes remain available without MongoDB; accounts, investigations, and push subscriptions require MongoDB. SMTP and push delivery also require their corresponding optional credentials.

Run backend tests with `npm test --prefix backend`.

## Production

The persistent Render service uses this directory as its root, `npm ci` as its build command, `npm start` as its start command, and `/health` as its health check. Configure `CLIENT_URL` to the exact HTTPS origin of the deployed TERRA frontend. Set `MONGODB_URI` when persistence-backed functionality is required. See the repository `render.yaml` and [deployment guide](../docs/DEPLOYMENT.md).

`src/app.js` exports the Express app without listening. `src/server.js` validates production configuration, opens MongoDB when configured, starts the HTTP listener, and manages graceful shutdown.
