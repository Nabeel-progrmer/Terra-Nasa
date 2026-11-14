import { Router } from 'express';
import { z } from 'zod';
import env from '../config/env.js';
import { cached } from '../services/providerCache.js';
import { fetchJson } from '../services/providerFetch.js';

const router = Router();

// NASA POWER's monthly point API currently supplies meteorological fields from MERRA-2.
// These are model/reanalysis estimates informed by observations, not direct pixel measurements.
const VARIABLES = {
  T2M: { label: 'Near-surface air temperature', unit: '°C', aggregation: 'day-weighted annual mean', percentageChangeMeaningful: false, community: 'RE', startYear: 1981 },
  T2M_MAX: { label: 'Mean monthly daily maximum temperature', unit: '°C', aggregation: 'day-weighted annual mean of monthly daily maxima', percentageChangeMeaningful: false, community: 'RE', startYear: 1981 },
  T2M_MIN: { label: 'Mean monthly daily minimum temperature', unit: '°C', aggregation: 'day-weighted annual mean of monthly daily minima', percentageChangeMeaningful: false, community: 'RE', startYear: 1981 },
  PRECTOTCORR: { label: 'Corrected precipitation rate', unit: 'mm/day', aggregation: 'day-weighted annual mean rate', percentageChangeMeaningful: true, community: 'RE', startYear: 1981 },
  RH2M: { label: 'Relative humidity at 2 m', unit: '%', aggregation: 'day-weighted annual mean', percentageChangeMeaningful: true, community: 'RE', startYear: 1981 },
  QV2M: { label: 'Specific humidity at 2 m', unit: 'g/kg', aggregation: 'day-weighted annual mean', percentageChangeMeaningful: true, community: 'RE', startYear: 1981 },
  WS10M: { label: 'Wind speed at 10 m', unit: 'm/s', aggregation: 'day-weighted annual mean', percentageChangeMeaningful: true, community: 'RE', startYear: 1981 },
  ALLSKY_SFC_SW_DWN: { label: 'All-sky surface shortwave radiation', unit: 'kWh/m²/day', aggregation: 'day-weighted annual mean daily energy', percentageChangeMeaningful: true, community: 'RE', startYear: 1984 },
  ALLSKY_SFC_LW_DWN: { label: 'All-sky surface longwave radiation', unit: 'kWh/m²/day', aggregation: 'day-weighted annual mean daily energy', percentageChangeMeaningful: true, community: 'RE', startYear: 1984 },
};

const REGIONS = {
  nyc: { id: 'nyc', name: 'New York', latitude: 40.71, longitude: -74.01 },
  amazon: { id: 'amazon', name: 'Central Amazon', latitude: -3.47, longitude: -62.22 },
  sahel: { id: 'sahel', name: 'Sahel · Niamey', latitude: 13.51, longitude: 2.11 },
  greenland: { id: 'greenland', name: 'Greenland · Summit', latitude: 72.58, longitude: -38.46 },
  tokyo: { id: 'tokyo', name: 'Tokyo', latitude: 35.68, longitude: 139.69 },
  sydney: { id: 'sydney', name: 'Sydney', latitude: -33.87, longitude: 151.21 },
};

const pointLocationSchema = z.object({
  type: z.literal('point'),
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: z.string().trim().min(1).max(60),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();

const areaLocationSchema = z.object({
  type: z.literal('area'),
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: z.string().trim().min(1).max(60),
  minLatitude: z.number().finite().min(-90).max(90),
  maxLatitude: z.number().finite().min(-90).max(90),
  minLongitude: z.number().finite().min(-180).max(180),
  maxLongitude: z.number().finite().min(-180).max(180),
}).strict().superRefine((area, context) => {
  if (area.maxLatitude <= area.minLatitude) context.addIssue({ code: 'custom', message: 'Area north edge must be north of its south edge.' });
  if (area.maxLongitude <= area.minLongitude) context.addIssue({ code: 'custom', message: 'Area must not cross the antimeridian; west edge must be west of east edge.' });
  if (area.maxLatitude - area.minLatitude > 5 || area.maxLongitude - area.minLongitude > 5) {
    context.addIssue({ code: 'custom', message: 'Area boxes cannot exceed 5 degrees on either side.' });
  }
});

const locationArraySchema = z.array(z.discriminatedUnion('type', [pointLocationSchema, areaLocationSchema]))
  .min(1).max(6).superRefine((locations, context) => {
    const ids = locations.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: 'Each location must have a unique identifier.' });
  });

const schema = z.object({
  variable: z.enum(Object.keys(VARIABLES)).default('T2M'),
  startYear: z.coerce.number().int().min(1981).max(new Date().getFullYear() - 2),
  endYear: z.coerce.number().int().min(1981).max(new Date().getFullYear() - 1),
  regions: z.string().optional(),
  locations: z.string().optional(),
}).transform((value, context) => {
  let locations = [];
  if (value.locations) {
    try {
      locations = locationArraySchema.parse(JSON.parse(value.locations));
    } catch (error) {
      context.addIssue({ code: 'custom', path: ['locations'], message: error.message || 'Locations must be a valid list of points or bounded areas.' });
      return z.NEVER;
    }
  } else if (value.regions) {
    const ids = value.regions.split(',').filter(Boolean);
    const validIds = Object.keys(REGIONS);
    if (!ids.length || ids.length > 6 || ids.some((id) => !validIds.includes(id))) {
      context.addIssue({ code: 'custom', path: ['regions'], message: 'Choose one to six supported locations.' });
      return z.NEVER;
    }
    locations = ids.map((id) => ({ type: 'point', ...REGIONS[id] }));
  } else {
    context.addIssue({ code: 'custom', path: ['locations'], message: 'Choose at least one location.' });
    return z.NEVER;
  }
  return { ...value, locations };
}).refine((value) => value.startYear >= VARIABLES[value.variable].startYear, { message: 'The selected variable is not available from that start year.', path: ['startYear'] })
  .refine((value) => value.endYear - value.startYear >= 9, { message: 'Choose at least a 10-year period to assess a long-term trend.' })
  .refine((value) => value.endYear >= value.startYear, { message: 'End year must be after start year.' })
  .refine((value) => new Set(value.locations.map(({ id }) => id)).size === value.locations.length, { message: 'Select each location only once.' });

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const value = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * value);
  const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign * (1 - polynomial * Math.exp(-value * value));
}

function mannKendall(years, values) {
  const n = values.length;
  let s = 0;
  for (let i = 0; i < n - 1; i += 1) for (let j = i + 1; j < n; j += 1) s += Math.sign(values[j] - values[i]);
  const ties = new Map();
  values.forEach((value) => ties.set(value, (ties.get(value) || 0) + 1));
  const tieCorrection = [...ties.values()].reduce((sum, count) => sum + count * (count - 1) * (2 * count + 5), 0);
  const variance = (n * (n - 1) * (2 * n + 5) - tieCorrection) / 18;
  if (!variance) return { statistic: 0, pValue: 1 };
  const z = s > 0 ? (s - 1) / Math.sqrt(variance) : s < 0 ? (s + 1) / Math.sqrt(variance) : 0;
  return { statistic: Number(z.toFixed(3)), pValue: Math.min(1, Math.max(0, 1 - erf(Math.abs(z) / Math.sqrt(2)))) };
}

function studentTCritical95(degreesOfFreedom) {
  const z = 1.959963984540054;
  const z2 = z ** 2;
  const z3 = z ** 3;
  const z5 = z ** 5;
  const z7 = z ** 7;
  const df = degreesOfFreedom;
  return z
    + (z3 + z) / (4 * df)
    + (5 * z5 + 16 * z3 + 3 * z) / (96 * df ** 2)
    + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df ** 3);
}

function analyze(yearValues, variable) {
  const { unit, percentageChangeMeaningful } = VARIABLES[variable];
  const observations = yearValues.filter((item) => Number.isFinite(item.value));
  if (observations.length < 10) throw new Error('At least 10 complete annual values are required for this region.');
  const years = observations.map((item) => item.year);
  const values = observations.map((item) => item.value);
  const xMean = mean(years);
  const yMean = mean(values);
  const denominator = years.reduce((sum, year) => sum + (year - xMean) ** 2, 0);
  const slope = years.reduce((sum, year, index) => sum + (year - xMean) * (values[index] - yMean), 0) / denominator;
  const intercept = yMean - slope * xMean;
  const residuals = values.map((value, index) => value - (intercept + slope * years[index]));
  const standardError = Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / (values.length - 2) / denominator);
  const ciMultiplier = studentTCritical95(values.length - 2);
  const senSlope = median(values.flatMap((value, index) => values.slice(index + 1).map((next, offset) => (next - value) / (years[index + offset + 1] - years[index]))));
  const mk = mannKendall(years, values);
  const requestedMonths = yearValues.reduce((sum, item) => sum + item.validMonths, 0);
  const coverage = requestedMonths / (yearValues.length * 12);
  const first = observations[0];
  const last = observations.at(-1);
  const span = last.year - first.year;
  const totalChange = senSlope * span;
  return {
    observations,
    nYears: observations.length,
    coverage: Number((coverage * 100).toFixed(1)),
    areaCoverage: observations.some((item) => Number.isFinite(item.areaCoverage))
      ? Number((mean(observations.map((item) => item.areaCoverage).filter(Number.isFinite)) * 100).toFixed(1))
      : null,
    startYear: first.year,
    endYear: last.year,
    mean: Number(yMean.toFixed(3)),
    trendPerYear: Number(senSlope.toFixed(5)),
    olsSlopePerYear: Number(slope.toFixed(5)),
    senSlopePerYear: Number(senSlope.toFixed(5)),
    totalChange: Number(totalChange.toFixed(3)),
    percentChange: percentageChangeMeaningful && Math.abs(first.value) > 1e-9 ? Number(((totalChange / Math.abs(first.value)) * 100).toFixed(2)) : null,
    confidence95: [Number((slope - ciMultiplier * standardError).toFixed(5)), Number((slope + ciMultiplier * standardError).toFixed(5))],
    mannKendallZ: mk.statistic,
    pValue: Number(mk.pValue.toFixed(5)),
    unit,
    direction: Math.abs(senSlope) < 1e-10 ? 'stable' : senSlope > 0 ? 'increasing' : 'decreasing',
  };
}

function adjustBenjaminiHochberg(results) {
  const sorted = [...results].sort((a, b) => a.analysis.pValue - b.analysis.pValue);
  let adjusted = 1;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    adjusted = Math.min(adjusted, sorted[index].analysis.pValue * sorted.length / (index + 1));
    sorted[index].analysis.qValue = Number(adjusted.toFixed(5));
    sorted[index].analysis.statisticallySignificant = adjusted < 0.05;
  }
}

async function fetchRegion(variable, region, startYear, endYear) {
  const cacheKey = `nasa-power:${variable}:${region.id}:${startYear}:${endYear}`;
  const snapshot = await cached(cacheKey, env.CACHE_TTL_SECONDS || 300, async () => {
    const variableDetails = VARIABLES[variable];
    const url = new URL('https://power.larc.nasa.gov/api/temporal/monthly/point');
    url.search = new URLSearchParams({ parameters: variable, community: variableDetails.community, longitude: String(region.longitude), latitude: String(region.latitude), start: String(startYear), end: String(endYear), format: 'JSON' });
    const payload = await fetchJson(url);
    const series = payload.properties?.parameter?.[variable];
    if (!series || typeof series !== 'object') {
      const error = new Error(`NASA POWER did not return ${variable} for ${region.name}.`);
      error.status = 502;
      throw error;
    }
    const annual = [];
    for (let year = startYear; year <= endYear; year += 1) {
      const months = [];
      for (let month = 1; month <= 12; month += 1) {
        const key = `${year}${String(month).padStart(2, '0')}`;
        const raw = series[key];
        if (raw === null || raw === undefined || raw === '') continue;
        const value = Number(raw);
        if (Number.isFinite(value) && value > -900) months.push({ value, days: new Date(Date.UTC(year, month, 0)).getUTCDate() });
      }
      const days = months.reduce((sum, item) => sum + item.days, 0);
      annual.push({ year, value: months.length >= 10 ? months.reduce((sum, item) => sum + item.value * item.days, 0) / days : null, validMonths: months.length });
    }
    const fallbackSource = variable.startsWith('ALLSKY_') ? 'NASA POWER satellite-derived solar archive' : 'MERRA-2';
    return { annual, sources: payload.header?.sources?.length ? payload.header.sources : [fallbackSource], retrievedAt: new Date().toISOString() };
  });
  return {
    region: { ...region, spatialSupport: 'Nearest NASA POWER model grid cell to this coordinate.' },
    analysis: analyze(snapshot.annual, variable),
    dataRetrievedAt: snapshot.retrievedAt,
    datasetSources: snapshot.sources,
  };
}

function cellAreaWeight(west, east, south, north) {
  if (east <= west || north <= south) return 0;
  const latitudeBand = Math.sin((north * Math.PI) / 180) - Math.sin((south * Math.PI) / 180);
  return latitudeBand * ((east - west) * Math.PI / 180);
}

function getAreaCellWeights(features, area) {
  const cells = features.flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite)) return [];
    const [longitude, latitude] = coordinates;
    if (latitude < area.minLatitude || latitude > area.maxLatitude || longitude < area.minLongitude || longitude > area.maxLongitude) return [];
    return [{ feature, latitude, longitude }];
  });
  if (!cells.length) throw new Error('NASA POWER returned no grid cells inside this area. Widen the area and retry.');

  const latitudes = [...new Set(cells.map(({ latitude }) => latitude))].sort((a, b) => a - b);
  const longitudes = [...new Set(cells.map(({ longitude }) => longitude))].sort((a, b) => a - b);
  const cellEdges = (coordinates, index, lowerLimit, upperLimit) => {
    const position = coordinates.indexOf(index);
    const previous = coordinates[position - 1];
    const next = coordinates[position + 1];
    const halfBefore = previous === undefined ? index - lowerLimit : (index - previous) / 2;
    const halfAfter = next === undefined ? upperLimit - index : (next - index) / 2;
    return [Math.max(lowerLimit, index - halfBefore), Math.min(upperLimit, index + halfAfter)];
  };

  const weightedCells = cells.map((cell) => {
    const [west, east] = cellEdges(longitudes, cell.longitude, area.minLongitude, area.maxLongitude);
    const [south, north] = cellEdges(latitudes, cell.latitude, area.minLatitude, area.maxLatitude);
    return { ...cell, weight: cellAreaWeight(west, east, south, north) };
  }).filter(({ weight }) => weight > 0);
  const representedArea = weightedCells.reduce((sum, cell) => sum + cell.weight, 0);
  const totalArea = cellAreaWeight(area.minLongitude, area.maxLongitude, area.minLatitude, area.maxLatitude);
  if (!totalArea || representedArea / totalArea < 0.95) {
    throw new Error('NASA POWER grid cells do not cover enough of this area. Adjust the rectangle and retry.');
  }
  return { cells: weightedCells, totalArea };
}

async function fetchAreaRegion(variable, area, startYear, endYear) {
  const cacheKey = `nasa-power-area:${variable}:${area.minLatitude}:${area.maxLatitude}:${area.minLongitude}:${area.maxLongitude}:${startYear}:${endYear}`;
  const snapshot = await cached(cacheKey, env.CACHE_TTL_SECONDS || 300, async () => {
    const variableDetails = VARIABLES[variable];
    const url = new URL('https://power.larc.nasa.gov/api/temporal/monthly/regional');
    url.search = new URLSearchParams({
      'latitude-min': String(area.minLatitude),
      'latitude-max': String(area.maxLatitude),
      'longitude-min': String(area.minLongitude),
      'longitude-max': String(area.maxLongitude),
      parameters: variable,
      community: variableDetails.community,
      start: String(startYear),
      end: String(endYear),
      format: 'JSON',
    });
    const payload = await fetchJson(url);
    if (!Array.isArray(payload.features) || payload.features.length === 0) {
      throw new Error(`NASA POWER returned no grid cells for ${area.name}.`);
    }
    const { cells, totalArea } = getAreaCellWeights(payload.features, area);
    const annual = [];
    for (let year = startYear; year <= endYear; year += 1) {
      const months = [];
      for (let month = 1; month <= 12; month += 1) {
        const key = `${year}${String(month).padStart(2, '0')}`;
        const available = cells.flatMap((cell) => {
          const raw = cell.feature.properties?.parameter?.[variable]?.[key];
          const value = raw === null || raw === undefined || raw === '' ? Number.NaN : Number(raw);
          return Number.isFinite(value) && value > -900 ? [{ value, weight: cell.weight }] : [];
        });
        const validArea = available.reduce((sum, item) => sum + item.weight, 0);
        const areaCoverage = validArea / totalArea;
        if (areaCoverage >= 0.8) {
          const value = available.reduce((sum, item) => sum + item.value * item.weight, 0) / validArea;
          months.push({ value, areaCoverage, days: new Date(Date.UTC(year, month, 0)).getUTCDate() });
        }
      }
      const validDays = months.reduce((sum, item) => sum + item.days, 0);
      const annualAreaCoverage = months.length
        ? months.reduce((sum, item) => sum + item.areaCoverage * item.days, 0) / validDays
        : null;
      annual.push({
        year,
        value: months.length >= 10 ? months.reduce((sum, item) => sum + item.value * item.days, 0) / validDays : null,
        validMonths: months.length,
        areaCoverage: annualAreaCoverage,
      });
    }
    const fallbackSource = variable.startsWith('ALLSKY_') ? 'NASA POWER satellite-derived solar archive' : 'MERRA-2';
    return { annual, sources: payload.header?.sources?.length ? payload.header.sources : [fallbackSource], retrievedAt: new Date().toISOString() };
  });
  return {
    region: { ...area, spatialSupport: 'Approximate area-weighted average of NASA POWER grid cells clipped to this latitude/longitude rectangle; monthly coverage below 80% of cell area is omitted.' },
    analysis: analyze(snapshot.annual, variable),
    dataRetrievedAt: snapshot.retrievedAt,
    datasetSources: snapshot.sources,
  };
}

async function fetchLocation(variable, location, startYear, endYear) {
  return location.type === 'area'
    ? fetchAreaRegion(variable, location, startYear, endYear)
    : fetchRegion(variable, location, startYear, endYear);
}

router.get('/variables', (_req, res) => {
  res.json({
    source: 'NASA POWER Monthly API',
    variables: Object.entries(VARIABLES).map(([id, details]) => ({ id, ...details })),
    regions: Object.values(REGIONS),
    period: { startYear: 1981, endYear: new Date().getFullYear() - 1 },
  });
});

router.get('/change-analysis', async (req, res) => {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid change-analysis request', message: parsed.error.issues[0]?.message || 'Check the selected dates and regions.' });
  const params = parsed.data;
  const selectedLocations = params.locations;
  try {
    const settled = await Promise.allSettled(selectedLocations.map((location) => fetchLocation(params.variable, location, params.startYear, params.endYear)));
    const results = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    const failures = settled.flatMap((result, index) => result.status === 'rejected' ? [{ region: selectedLocations[index].name, message: result.reason.message }] : []);
    if (!results.length) return res.status(502).json({ error: 'Change analysis unavailable', message: failures[0]?.message || 'No regional observations could be analyzed.', source: 'NASA POWER' });
    adjustBenjaminiHochberg(results);
    res.json({
      variable: { id: params.variable, ...VARIABLES[params.variable] },
      period: { requestedStart: params.startYear, requestedEnd: params.endYear },
      source: {
        name: 'NASA POWER',
        product: [...new Set(results.flatMap((item) => item.datasetSources || []))].join(', ') || 'NASA POWER archive',
        url: 'https://power.larc.nasa.gov/',
        analysisGeneratedAt: new Date().toISOString(),
        spatialSupport: 'Point selections use the nearest model grid cell. Area selections use an approximate grid-cell area-weighted mean clipped to the requested rectangle.',
      },
      method: {
        trend: 'Theil–Sen median slope; ordinary least-squares 95% interval',
        test: 'Two-sided Mann–Kendall monotonic trend test with tie correction; Benjamini–Hochberg false-discovery-rate correction across successfully analyzed selected locations.',
        annualAggregation: VARIABLES[params.variable].aggregation,
        caveat: 'P-values use a normal approximation. The test and OLS interval assume independent annual residuals. Serial correlation is not corrected; area averages approximate grid-cell coverage and omit months with less than 80% valid area. Significance is statistical evidence, not proof of practical or causal importance.',
      },
      results,
      failures,
    });
  } catch (error) {
    res.status(502).json({ error: 'Change analysis unavailable', message: error.message, source: 'NASA POWER' });
  }
});

export default router;
