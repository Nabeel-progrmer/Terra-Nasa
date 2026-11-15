import env from '../config/env.js';

const developmentOrigins = env.NODE_ENV === 'development'
  ? ['localhost', '127.0.0.1'].flatMap((host) => Array.from({ length: 8 }, (_, index) => `http://${host}:${5173 + index}`))
  : [];
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter(Boolean)
  .map((domain) => `https://${domain}`);

// Render cannot infer the Vercel deployment URL from its own environment.
// Keep the production frontend origin allowed even if Render's CLIENT_URL
// setting has not yet been synchronized with render.yaml.
export const allowedClientOrigins = new Set([
  env.CLIENT_URL,
  'https://terra-nasa-ta7u.vercel.app',
  ...vercelOrigins,
  ...developmentOrigins,
]);
