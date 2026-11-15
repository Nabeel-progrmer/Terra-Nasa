import { Router } from 'express';
import { z } from 'zod';
import env from '../config/env.js';
import { cached } from '../services/providerCache.js';
import { fetchJson } from '../services/providerFetch.js';

const router = Router();
const schema = z.object({
  feed: z.enum(['all_hour', 'all_day', 'all_week', 'all_month']).default('all_day'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  minMagnitude: z.coerce.number().min(-1).max(10).optional(),
}).strict();

router.get('/events', async (req, res) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid event query', message: 'Use a supported feed, a limit from 1 to 100, and a magnitude from -1 to 10.' });
  const { feed, limit, minMagnitude } = parsed.data;

  try {
    const snapshot = await cached(`usgs:${feed}`, Math.min(env.CACHE_TTL_SECONDS, 60), async () => {
      const payload = await fetchJson(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`);
      if (!Array.isArray(payload.features) || !Number.isFinite(payload.metadata?.count)) {
        const error = new Error('USGS returned an incomplete earthquake feed.');
        error.status = 502;
        throw error;
      }
      return { payload, retrievedAt: new Date().toISOString() };
    });

    const features = snapshot.payload.features.filter((feature) => {
      const magnitude = feature.properties?.mag;
      return minMagnitude === undefined || (Number.isFinite(magnitude) && magnitude >= minMagnitude);
    });
    const events = features.slice(0, limit).flatMap((feature) => {
      const properties = feature.properties || {};
      const coordinates = feature.geometry?.coordinates;
      const eventTime = new Date(properties.time);
      if (!Array.isArray(coordinates) || coordinates.length < 3 || !coordinates.slice(0, 3).every(Number.isFinite) || !Number.isFinite(eventTime.getTime())) return [];
      return [{
        id: String(feature.id),
        place: typeof properties.place === 'string' ? properties.place : 'Location not reported',
        magnitude: Number.isFinite(properties.mag) ? properties.mag : null,
        depthKm: coordinates[2],
        time: eventTime.toISOString(),
        coordinates: coordinates.slice(0, 3),
        source: properties.sources || 'USGS',
        detailUrl: typeof properties.url === 'string' ? properties.url : null,
      }];
    });
    const count = minMagnitude === undefined ? snapshot.payload.metadata.count : features.length;
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    return res.json({ source: 'USGS Earthquake Hazards Program', feed, retrievalTime: snapshot.retrievedAt, count, returned: events.length, events });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Earthquake provider timed out' : 'Earthquake feed unavailable',
      message: timedOut ? 'USGS did not respond before the request timeout. Please retry.' : error.message,
      source: 'USGS Earthquake Hazards Program',
    });
  }
});

export default router;
