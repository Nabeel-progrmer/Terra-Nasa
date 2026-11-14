import { Router } from 'express';
import { z } from 'zod';
import env from '../config/env.js';
import { cached } from '../services/providerCache.js';
import { fetchJson } from '../services/providerFetch.js';
import {
  calculateStandardAtmosphere,
  getStandardAtmosphereProfile,
  STANDARD_ATMOSPHERE_LIMIT_KM,
} from '../services/atmosphereModel.js';

const router = Router();
const NOAA_BASE = 'https://services.swpc.noaa.gov';
const NASA_NEO_BASE = 'https://api.nasa.gov/neo/rest/v1/feed';
const atmosphereQuery = z.object({
  altitudeKm: z.coerce.number().finite().min(0).max(STANDARD_ATMOSPHERE_LIMIT_KM).default(0),
}).strict();

function validRows(value, dateField) {
  return Array.isArray(value)
    ? value.filter((row) => row && typeof row === 'object'
      && typeof row[dateField] === 'string'
      && !Number.isNaN(Date.parse(row[dateField])))
    : [];
}

async function loadNoaaProduct(path, dateField, key) {
  const rows = await fetchJson(new URL(path, NOAA_BASE));
  const valid = validRows(rows, dateField);
  if (valid.length === 0) throw new Error('NOAA SWPC returned no usable records.');
  return valid.slice(-key);
}

async function loadPropagatedSolarWind() {
  const rows = await fetchJson(new URL('/products/geospace/propagated-solar-wind-1-hour.json', NOAA_BASE));
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
    throw new Error('NOAA SWPC returned an invalid propagated solar-wind table.');
  }
  const columns = rows[0];
  const required = ['time_tag', 'speed', 'density', 'temperature', 'bz', 'propagated_time_tag'];
  const indices = Object.fromEntries(required.map((column) => [column, columns.indexOf(column)]));
  if (Object.values(indices).some((index) => index < 0)) {
    throw new Error('NOAA SWPC propagated solar-wind table is missing required columns.');
  }

  const measurement = (value) => value === null || value === '' || value === undefined ? Number.NaN : Number(value);
  const parsedRows = rows.slice(1).map((row) => ({
    time: row[indices.time_tag],
    propagatedTime: row[indices.propagated_time_tag],
    speedKmS: measurement(row[indices.speed]),
    densityParticlesCm3: measurement(row[indices.density]),
    temperatureK: measurement(row[indices.temperature]),
    bzNt: measurement(row[indices.bz]),
  })).filter((row) => typeof row.time === 'string'
    && Number.isFinite(Date.parse(row.time))
    && typeof row.propagatedTime === 'string'
    && Number.isFinite(Date.parse(row.propagatedTime))
    && Number.isFinite(row.speedKmS)
    && Number.isFinite(row.densityParticlesCm3)
    && Number.isFinite(row.temperatureK)
    && Number.isFinite(row.bzNt));
  if (parsedRows.length === 0) throw new Error('NOAA SWPC returned no usable propagated solar-wind records.');
  return parsedRows.slice(-60);
}

router.get('/space/atmosphere', (req, res) => {
  const parsed = atmosphereQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid atmospheric altitude',
      message: `Choose a geopotential altitude from 0 to ${STANDARD_ATMOSPHERE_LIMIT_KM} km.`,
    });
  }

  const { altitudeKm } = parsed.data;
  res.set('Cache-Control', 'public, max-age=86400');
  return res.json({
    source: 'U.S. Standard Atmosphere, 1976',
    sourceUrl: 'https://ntrs.nasa.gov/citations/19770009539',
    model: 'Hydrostatic, piecewise-lapse-rate standard atmosphere',
    dataType: 'Model output, not a local measurement or weather forecast',
    altitudeCoordinate: 'Geopotential altitude above mean sea level',
    validRangeKm: [0, STANDARD_ATMOSPHERE_LIMIT_KM],
    retrievalTime: new Date().toISOString(),
    selected: calculateStandardAtmosphere(altitudeKm),
    profile: getStandardAtmosphereProfile(),
    limitations: 'The 1976 standard atmosphere is a reference model for the lower atmosphere through 84.852 geopotential km. Local weather and solar/geomagnetic conditions vary; thermosphere, exosphere, ionosphere, and magnetosphere properties are not calculated here.',
  });
});

router.get('/space/space-weather', async (_req, res) => {
  try {
    const cachedResult = await cached('space-weather:noaa-swpc', 300, async () => {
    const products = [
      { key: 'kp', path: '/products/noaa-planetary-k-index.json', dateField: 'time_tag', limit: 56 },
      { key: 'dst', path: '/products/kyoto-dst.json', dateField: 'time_tag', limit: 168 },
      { key: 'xray', path: '/json/goes/primary/xrays-7-day.json', dateField: 'time_tag', limit: 2000 },
      { key: 'messages', path: '/products/alerts.json', dateField: 'issue_datetime', limit: 100 },
      { key: 'solarWind', load: loadPropagatedSolarWind },
    ];
    const settled = await Promise.all(products.map(async ({ key, path, dateField, limit, load }) => {
      try {
        const rows = load ? await load() : await loadNoaaProduct(path, dateField, limit);
        return { key, rows };
      } catch {
        return { key, rows: [], unavailable: true };
      }
    }));
    const data = Object.fromEntries(settled.map(({ key, rows }) => [key, rows]));
    const unavailableProducts = settled.filter((item) => item.unavailable).map(({ key }) => key);
    if (unavailableProducts.length === products.length) {
      const error = new Error('NOAA SWPC space-weather products are temporarily unavailable.');
      error.status = 502;
      throw error;
    }

    const xray = data.xray
      .filter((row) => row.energy === '0.1-0.8nm' && Number.isFinite(Number(row.flux)))
      .slice(-500);
    const recentMessageLimit = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const messages = data.messages
      .filter((row) => Date.parse(row.issue_datetime) >= recentMessageLimit)
      .sort((a, b) => Date.parse(b.issue_datetime) - Date.parse(a.issue_datetime))
      .slice(0, 10)
      .map(({ product_id, issue_datetime, message }) => ({
        productId: product_id,
        issuedAt: issue_datetime,
        message: String(message || '').slice(0, 1400),
      }));

    return {
      source: 'NOAA Space Weather Prediction Center',
      retrievedAt: new Date().toISOString(),
      coverage: 'Latest available values and recent history returned by each SWPC product; feed update times may differ.',
      products: {
        planetaryKIndex: data.kp.map((row) => ({ time: row.time_tag, value: Number(row.Kp) })).filter((row) => Number.isFinite(row.value)),
        dstIndex: data.dst.map((row) => ({ time: row.time_tag, value: Number(row.dst) })).filter((row) => Number.isFinite(row.value)),
        xrayFlux: xray.map((row) => ({ time: row.time_tag, fluxWm2: Number(row.flux), satellite: row.satellite })),
        propagatedSolarWind: data.solarWind,
        recentMessages: messages,
      },
      unavailableProducts,
      notes: {
        planetaryKIndex: 'Kp is a 3-hour planetary geomagnetic activity index; this feed contains observed values.',
        dstIndex: 'Dst is the hourly disturbance storm-time index in nT; the Kyoto World Data Center product is distributed by SWPC.',
        xrayFlux: 'GOES 0.1–0.8 nm soft X-ray flux is in W/m². These are satellite observations.',
        propagatedSolarWind: 'Solar-wind plasma and magnetic field values are NOAA SWPC propagated near-Earth estimates, not direct measurements at Earth. Each row includes its original and propagated timestamps.',
        recentMessages: 'Recent NOAA messages issued in the last seven days; presence does not establish that a warning is currently active.',
      },
    };
    });

    if (cachedResult.unavailableProducts.length > 0) {
      res.set('Warning', '199 - "Some NOAA SWPC products are unavailable"');
    }
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    return res.json(cachedResult);
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      error: 'Space-weather data unavailable',
      message: timedOut ? 'NOAA SWPC did not respond before the request timeout.' : 'NOAA SWPC space-weather products are temporarily unavailable.',
      source: 'NOAA Space Weather Prediction Center',
    });
  }
});

router.get('/space/near-earth-objects', async (_req, res) => {
  try {
    const snapshot = await cached('space:near-earth-objects:7-days', 900, async () => {
      const startDate = new Date().toISOString().slice(0, 10);
      const endDate = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const url = new URL(NASA_NEO_BASE);
      url.search = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        api_key: env.NASA_API_KEY || 'DEMO_KEY',
      });
      const payload = await fetchJson(url);
      if (!payload.near_earth_objects || typeof payload.near_earth_objects !== 'object') {
        const error = new Error('NASA returned an incomplete near-Earth object response.');
        error.status = 502;
        throw error;
      }
      const objects = Object.values(payload.near_earth_objects).flatMap((dailyObjects) => dailyObjects.map((object) => {
        const approach = object.close_approach_data?.[0];
        return {
          id: object.id,
          name: object.name,
          approachDate: approach?.close_approach_date_full || approach?.close_approach_date || null,
          relativeVelocityKmS: Number(approach?.relative_velocity?.kilometers_per_second),
          missDistanceKm: Number(approach?.miss_distance?.kilometers),
          missDistanceLunar: Number(approach?.miss_distance?.lunar),
          estimatedDiameterMinM: Number(object.estimated_diameter?.meters?.estimated_diameter_min),
          estimatedDiameterMaxM: Number(object.estimated_diameter?.meters?.estimated_diameter_max),
          nasaPotentiallyHazardous: object.is_potentially_hazardous_asteroid,
          nasaJplUrl: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(object.id)}`,
        };
      })).filter((object) => object.id && object.name && object.approachDate
        && Number.isFinite(object.missDistanceKm) && Number.isFinite(object.relativeVelocityKmS))
        .sort((a, b) => Date.parse(a.approachDate) - Date.parse(b.approachDate));
      return {
        source: 'NASA/JPL Near-Earth Object Web Service (NeoWs)',
        sourceUrl: 'https://api.nasa.gov/',
        dataType: 'Calculated close-approach predictions from NASA/JPL orbital data',
        retrievedAt: new Date().toISOString(),
        window: { startDate, endDate, timeStandard: 'UTC' },
        count: objects.length,
        objects,
        note: 'A close approach is not an impact prediction. The potentially hazardous classification is NASA/JPL screening terminology, not a statement that an impact is expected. Diameter values are estimates.',
      };
    });
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json(snapshot);
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    const rateLimited = error.status === 429;
    return res.status(timedOut ? 504 : rateLimited ? 503 : 502).json({
      error: 'Near-Earth object data unavailable',
      message: rateLimited
        ? 'NASA NeoWs is rate limited. Add a personal NASA_API_KEY on the server or try again later.'
        : timedOut
          ? 'NASA NeoWs did not respond before the request timeout.'
          : 'NASA NeoWs could not provide close-approach data. Try again later.',
      source: 'NASA/JPL NeoWs',
    });
  }
});

export default router;
