import { allowedClientOrigins } from './clientOrigins.js';

export function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin && allowedClientOrigins.has(origin)) return next();
  return res.status(403).json({ error: 'Untrusted request origin', message: 'This request did not come from an allowed TERRA application origin.' });
}
