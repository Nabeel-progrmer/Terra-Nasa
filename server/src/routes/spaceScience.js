import { Router } from 'express';
import * as Astronomy from 'astronomy-engine';
import { z } from 'zod';
import { cached } from '../services/providerCache.js';
import { fetchJson } from '../services/providerFetch.js';

const router = Router();
const EXOPLANET_TAP_URL = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const BODY_NAMES = [
  ['Sun', Astronomy.Body.Sun],
  ['Moon', Astronomy.Body.Moon],
  ['Mercury', Astronomy.Body.Mercury],
  ['Venus', Astronomy.Body.Venus],
  ['Mars', Astronomy.Body.Mars],
  ['Jupiter', Astronomy.Body.Jupiter],
  ['Saturn', Astronomy.Body.Saturn],
  ['Uranus', Astronomy.Body.Uranus],
  ['Neptune', Astronomy.Body.Neptune],
  ['Pluto', Astronomy.Body.Pluto],
];
const ephemerisQuery = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  time: z.string().datetime({ offset: true }).optional(),
}).strict();
const exoplanetQuery = z.object({
  search: z.string().trim().max(60).regex(/^[a-z0-9][a-z0-9 -]*$/i).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

function nextRiseSet(body, observer, direction, time) {
  const result = Astronomy.SearchRiseSet(body, observer, direction, time, 1);
  return result ? result.date.toISOString() : null;
}

router.get('/space/ephemeris', (req, res) => {
  const parsed = ephemerisQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid ephemeris request',
      message: 'Provide latitude from −90 to 90, longitude from −180 to 180, and an optional ISO-8601 time with a timezone.',
    });
  }

  const { latitude, longitude, time: requestedTime } = parsed.data;
  const date = requestedTime ? new Date(requestedTime) : new Date();
  const year = date.getUTCFullYear();
  if (!Number.isFinite(date.getTime()) || year < 1900 || year > 2100) {
    return res.status(400).json({
      error: 'Ephemeris time outside supported range',
      message: 'Choose a UTC date from 1900 through 2100.',
    });
  }

  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const sunEquator = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);
  const sunHorizon = Astronomy.Horizon(date, observer, sunEquator.ra, sunEquator.dec, null);
  const sunBelowAstronomicalTwilight = sunHorizon.altitude <= -18;
  const bodies = BODY_NAMES.map(([name, body]) => {
    const equator = Astronomy.Equator(body, date, observer, true, true);
    const horizon = Astronomy.Horizon(date, observer, equator.ra, equator.dec, null);
    const illumination = Astronomy.Illumination(body, date);
    return {
      name,
      rightAscensionHours: equator.ra,
      declinationDegrees: equator.dec,
      azimuthDegrees: horizon.azimuth,
      geometricAltitudeDegrees: horizon.altitude,
      distanceAu: equator.dist,
      visualMagnitude: illumination.mag,
      illuminatedFraction: illumination.phase_fraction,
      aboveGeometricHorizon: horizon.altitude > 0,
      sunBelowAstronomicalTwilight,
      riseWithin24HoursUtc: nextRiseSet(body, observer, 1, date),
      setWithin24HoursUtc: nextRiseSet(body, observer, -1, date),
    };
  });

  res.set('Cache-Control', 'private, max-age=60');
  return res.json({
    source: 'Astronomy Engine, calculated locally',
    sourceUrl: 'https://github.com/cosinekitty/astronomy',
    dataType: 'Calculated solar-system ephemeris; not an observation or a JPL Horizons result',
    computedAt: new Date().toISOString(),
    requestedTimeUtc: date.toISOString(),
    timeScale: 'Astronomy Engine approximates UT1 and UTC as equal.',
    observer: { latitude, longitude, elevationMeters: 0 },
    sky: {
      geometricSunAltitudeDegrees: sunHorizon.altitude,
      sunBelowAstronomicalTwilight,
      twilightThresholdDegrees: -18,
      definition: 'Geometric conditions only. Cloud, haze, light pollution, obstructions, object contrast, and actual atmospheric refraction are not modeled.',
    },
    bodies,
    limitations: 'Positions and rise/set times are calculated by Astronomy Engine and are not high-precision navigation data. No numeric accuracy guarantee is asserted. Rise/set uses the library’s typical 34 arcminute atmospheric-refraction correction; actual refraction varies with weather. The interface accepts dates from 1900 through 2100.',
  });
});

function buildExoplanetQuery(search, limit) {
  const columns = 'pl_name,hostname,discoverymethod,disc_year,sy_dist,pl_bmassj,pl_radj,pl_orbper,st_spectype';
  const filter = search
    ? ` and (lower(pl_name) like '%${search.toLowerCase()}%' or lower(hostname) like '%${search.toLowerCase()}%')`
    : '';
  return `select top ${limit} ${columns} from ps where default_flag=1${filter} order by disc_year desc`;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

router.get('/space/exoplanets', async (req, res) => {
  const parsed = exoplanetQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid exoplanet catalog request',
      message: 'Search using letters, numbers, spaces, and hyphens; choose a result limit from 1 to 50.',
    });
  }

  const { search = '', limit } = parsed.data;
  const adql = buildExoplanetQuery(search, limit);
  const url = new URL(EXOPLANET_TAP_URL);
  url.search = new URLSearchParams({ query: adql, format: 'json' });
  try {
    const data = await cached(`exoplanets:${search.toLowerCase()}:${limit}`, 900, async () => {
      const rows = await fetchJson(url);
      if (!Array.isArray(rows)) {
        const error = new Error('NASA Exoplanet Archive returned an invalid catalog response.');
        error.status = 502;
        throw error;
      }
      const items = rows.filter((row) => row && typeof row.pl_name === 'string' && typeof row.hostname === 'string')
        .map((row) => ({
          name: row.pl_name,
          host: row.hostname,
          discoveryMethod: typeof row.discoverymethod === 'string' ? row.discoverymethod : null,
          discoveryYear: nullableNumber(row.disc_year),
          distanceParsecs: nullableNumber(row.sy_dist),
          massJupiter: nullableNumber(row.pl_bmassj),
          radiusJupiter: nullableNumber(row.pl_radj),
          orbitalPeriodDays: nullableNumber(row.pl_orbper),
          hostSpectralType: typeof row.st_spectype === 'string' ? row.st_spectype : null,
        }));
      return {
        source: 'NASA Exoplanet Archive, Planetary Systems table (default solutions)',
        sourceUrl: 'https://exoplanetarchive.ipac.caltech.edu/',
        queryUrl: url.href,
        dataType: 'Catalog records for confirmed exoplanets; not a complete deep-space-object catalog',
        retrievedAt: new Date().toISOString(),
        search: search || null,
        limit,
        count: items.length,
        items,
        units: {
          distanceParsecs: 'pc',
          massJupiter: 'Jupiter masses',
          radiusJupiter: 'Jupiter radii',
          orbitalPeriodDays: 'days',
        },
        limitations: 'Only default parameter solutions from the NASA Exoplanet Archive ps table are queried. Missing archive values remain null; catalog values can change as the archive is updated.',
      };
    });
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json(data);
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    const rateLimited = error.status === 429;
    return res.status(timedOut ? 504 : rateLimited ? 503 : 502).json({
      error: 'Exoplanet catalog unavailable',
      message: rateLimited
        ? 'NASA Exoplanet Archive is rate limiting requests. Wait before trying again.'
        : timedOut
          ? 'NASA Exoplanet Archive did not respond before the request timeout.'
          : 'NASA Exoplanet Archive could not provide catalog records. Try again later.',
      source: 'NASA Exoplanet Archive',
    });
  }
});

export default router;
