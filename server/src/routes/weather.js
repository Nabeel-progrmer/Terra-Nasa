import { Router } from 'express';
import { z } from 'zod';
import env from '../config/env.js';
import { cached } from '../services/providerCache.js';
import { fetchJson } from '../services/providerFetch.js';

const router = Router();
const querySchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
}).strict();

router.get('/weather', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid weather location', message: 'Provide latitude from -90 to 90 and longitude from -180 to 180.' });

  const { latitude, longitude } = parsed.data;
  const cacheKey = `weather:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
  try {
    const snapshot = await cached(cacheKey, Math.min(env.CACHE_TTL_SECONDS, 300), async () => {
      const url = new URL('/v1/forecast', env.OPEN_METEO_BASE_URL);
      url.search = new URLSearchParams({
        latitude: String(latitude), longitude: String(longitude),
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,dew_point_2m,cloud_cover,surface_pressure,shortwave_radiation,is_day',
        hourly: 'temperature_2m,precipitation_probability,precipitation,wind_speed_10m,relative_humidity_2m,cloud_cover',
        daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
        timezone: 'auto', forecast_days: '7',
      });
      const data = await fetchJson(url);
      if (!data.current || !Array.isArray(data.hourly?.time) || !data.daily || !Array.isArray(data.daily.time)) {
        const error = new Error('Open-Meteo returned an incomplete weather response.');
        error.status = 502;
        throw error;
      }
      return {
        payload: data,
        retrievedAt: new Date().toISOString(),
        dataType: 'Open-Meteo forecast-model output; not a direct local station observation',
      };
    });
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return res.json({
      source: 'Open-Meteo',
      retrievalTime: snapshot.retrievedAt,
      dataType: snapshot.dataType,
      ...snapshot.payload,
    });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Weather provider timed out' : 'Weather data unavailable',
      message: timedOut ? 'Open-Meteo did not respond before the request timeout. Please retry.' : error.message,
      source: 'Open-Meteo',
    });
  }
});

export default router;
