import { Router } from 'express';

const router = Router();

// This registry describes implemented adapters. It is not a live uptime monitor.
const dataSources = [
  {
    id: 'open-meteo', name: 'Open-Meteo Forecast API', category: 'Atmosphere', provider: 'Open-Meteo',
    endpoint: 'https://open-meteo.com/en/docs', auth: 'Public API; no key used by TERRA', updateFrequency: 'Forecast/current fields update hourly',
    coverage: 'Global model coverage', dataType: 'Forecast/model output', adapter: 'Weather endpoint',
    provenance: 'Provider-reported units, timezone, coordinates, and retrieval timestamp are returned with the forecast.', isActive: true,
    tags: ['weather', 'forecast', 'atmosphere'],
  },
  {
    id: 'open-meteo-geocoding', name: 'Open-Meteo Geocoding API', category: 'Geography', provider: 'Open-Meteo / GeoNames',
    endpoint: 'https://open-meteo.com/en/docs/geocoding-api', auth: 'Public API; no key used by TERRA', updateFrequency: 'Search on demand',
    coverage: 'Global place-name search', dataType: 'Geocoded place names and coordinates', adapter: 'Earth Explorer location search',
    provenance: 'Results are returned by Open-Meteo from GeoNames data. Place-name matching may be ambiguous; the user selects a result before TERRA uses its coordinates.', isActive: true,
    tags: ['geocoding', 'location', 'GeoNames'],
  },
  {
    id: 'usgs-earthquakes', name: 'USGS Earthquake Hazards Program', category: 'Solid Earth', provider: 'United States Geological Survey',
    endpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php', auth: 'Public GeoJSON feeds; no key required', updateFrequency: 'Near real time',
    coverage: 'Global reported seismic events', dataType: 'Earthquake event observations', adapter: 'Earthquake event endpoint',
    provenance: 'Event time, magnitude, depth, coordinates, source ids, and detail link come from the USGS GeoJSON feed.', isActive: true,
    tags: ['earthquake', 'seismic', 'solid-earth'],
  },
  {
    id: 'nasa-power', name: 'NASA POWER Monthly', category: 'Atmosphere', provider: 'NASA Langley Research Center POWER Project',
    endpoint: 'https://power.larc.nasa.gov/docs/services/api/temporal/monthly/', auth: 'Public API; no key required', updateFrequency: 'Historical monthly data; latest complete period varies',
    coverage: 'Global gridded point queries; resolution varies by product', dataType: 'MERRA-2 meteorological reanalysis', adapter: 'Regional change analysis',
    provenance: 'Meteorological parameters are NASA GMAO MERRA-2 reanalysis estimates informed by observations, not direct satellite pixel measurements. TERRA samples the nearest grid point and aggregates monthly values into annual values.', isActive: true,
    tags: ['reanalysis', 'temperature', 'precipitation', 'humidity', 'wind', 'trends'],
  },
  {
    id: 'us-standard-atmosphere-1976', name: 'U.S. Standard Atmosphere, 1976', category: 'Atmosphere', provider: 'U.S. Government reference atmosphere',
    endpoint: 'https://ntrs.nasa.gov/citations/19770009539', auth: 'Reference model; no key required', updateFrequency: 'Static reference model',
    coverage: 'Geopotential altitude 0–84.852 km', dataType: 'Hydrostatic model output, not measured conditions', adapter: 'Interactive atmospheric profile',
    provenance: 'Temperature, pressure, and density are calculated from the U.S. Standard Atmosphere 1976 layer model. Thermosphere, exosphere, ionosphere, and magnetosphere are outside the implemented model range.', isActive: true,
    tags: ['atmosphere', 'standard-atmosphere', 'model'],
  },
  {
    id: 'noaa-swpc', name: 'NOAA Space Weather Prediction Center', category: 'Space weather', provider: 'NOAA SWPC',
    endpoint: 'https://services.swpc.noaa.gov/', auth: 'Public product feeds; no key required', updateFrequency: 'Product-dependent; near-real-time observations and recent messages',
    coverage: 'Planetary geomagnetic indices, GOES X-ray observations, and propagated solar-wind estimates', dataType: 'Satellite observations, indices, propagated estimates, and issued messages', adapter: 'Space-weather dashboard',
    provenance: 'TERRA fetches the planetary Kp index, Kyoto Dst index, GOES 0.1–0.8 nm X-ray flux, NOAA-propagated solar-wind estimates, and recent SWPC messages. The propagated solar-wind product is not a direct measurement at Earth. Product timestamps/update cadence differ; message presence is not asserted to mean an active warning.', isActive: true,
    tags: ['space-weather', 'solar', 'geomagnetic', 'NOAA'],
  },
  {
    id: 'nasa-neows', name: 'NASA/JPL Near-Earth Object Web Service', category: 'Small bodies', provider: 'NASA/JPL CNEOS',
    endpoint: 'https://api.nasa.gov/neo/rest/v1/feed', auth: 'NASA API key recommended; DEMO_KEY fallback has low shared quota', updateFrequency: 'Seven-day close-approach feed',
    coverage: 'Near-Earth objects with predicted close approaches in the requested date window', dataType: 'Calculated close-approach predictions and estimated diameters', adapter: 'Near-Earth object explorer',
    provenance: 'Close approaches and size estimates are from NASA/JPL NeoWs. A close approach is not an impact prediction; the potentially hazardous classification is not a forecast of impact.', isActive: true,
    tags: ['asteroid', 'near-earth-object', 'NASA', 'JPL'],
  },
  {
    id: 'nasa-pds-registry', name: 'NASA Planetary Data System Registry', category: 'Planetary science', provider: 'NASA Planetary Data System',
    endpoint: 'https://pds.mcp.nasa.gov/api/search/1/', auth: 'Public search API; no key required', updateFrequency: 'Archive metadata changes as PDS nodes publish updates',
    coverage: 'Browsable PDS product, bundle, and collection records by product LID; selected product decoding is supported',
    dataType: 'PDS4 delimited observations decoded from provider labels and data files',
    adapter: 'Planetary archive browser and bounded PDS4 table decoder',
    provenance: 'Product metadata and labels come from NASA PDS. TERRA decodes only one-table PDS4 delimited schemas within explicit byte and row limits; unsupported binary, nested, quoted, or ambiguous formats are reported instead of guessed.',
    isActive: true, tags: ['planetary', 'mission-archive', 'PDS', 'NASA'],
  },
  {
    id: 'astronomy-engine', name: 'Astronomy Engine', category: 'Solar system', provider: 'Astronomy Engine open-source library',
    endpoint: 'https://github.com/cosinekitty/astronomy', auth: 'Local calculation; no key or astronomy provider request',
    updateFrequency: 'Calculated for the user-selected time',
    coverage: 'Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, and Pluto; interface dates 1900–2100',
    dataType: 'Calculated ephemeris and geometric altitude/rise/set estimates',
    adapter: 'Location-specific sky geometry and solar-system ephemerides',
    provenance: 'Positions are calculated locally from Astronomy Engine. Rise/set uses the library’s standard refraction correction; weather, obstacles, light pollution, and actual visual conditions are not modeled. No numeric accuracy guarantee is claimed.',
    isActive: true, tags: ['ephemeris', 'sky', 'solar-system', 'local-calculation'],
  },
  {
    id: 'nasa-exoplanet-archive', name: 'NASA Exoplanet Archive', category: 'Exoplanets', provider: 'NASA/IPAC Infrared Science Archive',
    endpoint: 'https://exoplanetarchive.ipac.caltech.edu/', auth: 'Public TAP API; no key required',
    updateFrequency: 'Catalog changes as archive solutions are updated',
    coverage: 'Confirmed exoplanets in the Planetary Systems (ps) table, default solutions',
    dataType: 'Curated exoplanet catalog parameters; not a full deep-space catalog',
    adapter: 'Bounded exoplanet catalog search (maximum 50 results)',
    provenance: 'TERRA uses a fixed-column TAP query, safely constrained search text, and the archive’s default parameter solutions. Missing values remain unavailable; units and the exact query URL accompany each result.',
    isActive: true, tags: ['exoplanets', 'catalog', 'NASA', 'TAP'],
  },
  {
    id: 'nasa-gibs-omi-ozone', name: 'Aura OMI Total-Column Ozone', category: 'Atmosphere', provider: 'NASA GIBS / Aura OMI',
    endpoint: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml', auth: 'Public WMTS tiles; no key required', updateFrequency: 'Daily product; latest available observation date is advertised by NASA GIBS',
    coverage: 'Global satellite-derived gridded total-column ozone imagery', dataType: 'Aura OMI satellite retrieval imagery; not a local station reading',
    adapter: 'NASA GIBS ozone overlay on the Earth globe',
    provenance: 'TERRA fetches the latest date advertised in the GIBS WMTS Time dimension and uses the named date for the tiled image. Image colors are not point-level numeric retrievals.',
    isActive: true, tags: ['ozone', 'OMI', 'Aura', 'NASA', 'satellite-imagery'],
  },
];

router.get('/data-sources', (_req, res) => {
  res.json({ source: 'TERRA implemented-adapter registry', note: 'Integration status does not verify provider uptime.', count: dataSources.length, items: dataSources, retrievalTime: new Date().toISOString() });
});

export default router;
