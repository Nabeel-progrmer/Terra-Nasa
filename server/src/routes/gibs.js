import { Router } from 'express';
import { cached } from '../services/providerCache.js';
import env from '../config/env.js';

const router = Router();
const GIBS_CAPABILITIES_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml';
const GIBS_BASE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
const OZONE_LAYER = 'OMI_Ozone_DOAS_Total_Column';
const TILE_MATRIX_SET = 'GoogleMapsCompatible_Level6';

function extractOzoneLayer(xml) {
  const layer = [...xml.matchAll(/<Layer>([\s\S]*?)<\/Layer>/g)]
    .map((match) => match[1])
    .find((candidate) => candidate.includes(`<ows:Identifier>${OZONE_LAYER}</ows:Identifier>`));
  if (!layer) throw new Error('NASA GIBS capabilities do not list the configured OMI ozone product.');

  const dimension = [...layer.matchAll(/<Dimension\b[^>]*>([\s\S]*?)<\/Dimension>/g)]
    .map((match) => match[1])
    .find((candidate) => candidate.includes('<ows:Identifier>Time</ows:Identifier>'));
  const latestDate = dimension?.match(/<Default>(\d{4}-\d{2}-\d{2})<\/Default>/)?.[1];
  if (!latestDate || Number.isNaN(Date.parse(`${latestDate}T00:00:00Z`))) {
    throw new Error('NASA GIBS did not provide a valid latest date for the OMI ozone product.');
  }
  if (!layer.includes('<Format>image/png</Format>') || !layer.includes(`<TileMatrixSet>${TILE_MATRIX_SET}</TileMatrixSet>`)) {
    throw new Error('NASA GIBS OMI ozone product no longer supports the configured image tile format.');
  }
  return latestDate;
}

async function loadCapabilities() {
  const response = await fetch(GIBS_CAPABILITIES_URL, {
    headers: { accept: 'application/xml, text/xml' },
    signal: AbortSignal.timeout(env.PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) {
    const error = new Error(`NASA GIBS returned HTTP ${response.status} for its WMTS capabilities.`);
    error.status = response.status;
    throw error;
  }
  return response.text();
}

router.get('/earth/ozone', async (_req, res) => {
  try {
    const product = await cached('earth:ozone:nasa-gibs-omi', 21600, async () => {
      const xml = await loadCapabilities();
      const observationDate = extractOzoneLayer(xml);
      return {
        product: 'Aura OMI Ozone (DOAS, version 3, standard)',
        layer: OZONE_LAYER,
        observationDate,
        tileMatrixSet: TILE_MATRIX_SET,
        tileUrlTemplate: `${GIBS_BASE_URL}/${OZONE_LAYER}/default/${observationDate}/${TILE_MATRIX_SET}/{z}/{y}/{x}.png`,
        source: 'NASA Global Imagery Browse Services (GIBS), Aura Ozone Monitoring Instrument (OMI)',
        sourceUrl: 'https://earthdata.nasa.gov/data/instruments/omi',
        capabilitiesUrl: GIBS_CAPABILITIES_URL,
        dataType: 'Satellite-derived total-column ozone imagery; the displayed image is a gridded product, not a local ground-station reading.',
        limitation: 'The date is the latest date currently advertised by NASA GIBS, which can lag today. Image color is not a numeric point retrieval. Do not infer a local ozone concentration or health advisory from the map.',
      };
    });

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json({ ...product, retrievedAt: new Date().toISOString() });
  } catch (error) {
    const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      error: 'NASA ozone imagery metadata unavailable',
      message: timedOut ? 'NASA GIBS did not respond before the request timeout.' : 'NASA GIBS could not provide the latest OMI ozone layer metadata.',
      source: 'NASA GIBS',
    });
  }
});

export default router;
