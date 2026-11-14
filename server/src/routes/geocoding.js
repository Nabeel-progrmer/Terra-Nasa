import { Router } from 'express';
import { z } from 'zod';
import env from '../config/env.js';
import { cached } from '../services/providerCache.js';
import { fetchJson } from '../services/providerFetch.js';

const router = Router();
const schema = z.object({
  q: z.string().trim().min(2).max(100),
}).strict();

router.get('/geocode', async (req, res) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid place search', message: 'Enter a place name between 2 and 100 characters.' });
  const query = parsed.data.q;
  try {
    const snapshot = await cached(`geocode:${query.toLocaleLowerCase()}`, env.CACHE_TTL_SECONDS, async () => {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.search = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' });
      const payload = await fetchJson(url);
      if (payload.results !== undefined && !Array.isArray(payload.results)) {
        const error = new Error('Open-Meteo returned an incomplete geocoding response.');
        error.status = 502;
        throw error;
      }
      const results = (payload.results || []).flatMap((place) => {
        if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)
          || place.latitude < -90 || place.latitude > 90 || place.longitude < -180 || place.longitude > 180
          || !Number.isSafeInteger(place.id) || typeof place.name !== 'string') return [];
        return [{
          id: String(place.id),
          name: place.name,
          region: [place.admin1, place.country].filter((part) => typeof part === 'string' && part.length > 0).join(', '),
          latitude: place.latitude,
          longitude: place.longitude,
        }];
      });
      return { results, retrievalTime: new Date().toISOString() };
    });
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return res.json({
      source: 'Open-Meteo Geocoding API',
      attribution: 'Geocoding data by GeoNames',
      query,
      ...snapshot,
    });
  } catch (error) {
    const status = error.name === 'TimeoutError' || error.name === 'AbortError' ? 504 : 502;
    return res.status(status).json({
      error: status === 504 ? 'Place search timed out' : 'Place search unavailable',
      message: status === 504 ? 'The place search provider did not respond before the timeout. Please retry.' : 'The place search provider could not complete this request. Please retry.',
      source: 'Open-Meteo Geocoding API',
    });
  }
});

export default router;
