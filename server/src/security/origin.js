import env from '../config/env.js';

const developmentOrigins = env.NODE_ENV === 'development'
  ? ['localhost', '127.0.0.1'].flatMap((host) => Array.from({ length: 8 }, (_, index) => `http://${host}:${5173 + index}`))
  : [];
const trustedOrigins = new Set([env.CLIENT_URL, ...developmentOrigins]);

export function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin && trustedOrigins.has(origin)) return next();
  return res.status(403).json({ error: 'Untrusted request origin', message: 'This request did not come from an allowed TERRA application origin.' });
}
