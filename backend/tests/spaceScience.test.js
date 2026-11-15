import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import env from '../src/config/env.js';
import { clearProviderCache } from '../src/services/providerCache.js';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const bytesResponse = (value) => {
  const buffer = Buffer.from(value);
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === 'content-length' ? String(buffer.length) : null },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
};

beforeEach(() => clearProviderCache());

afterEach(() => {
  vi.unstubAllGlobals();
  clearProviderCache();
});

describe('solar-system ephemerides', () => {
  it('calculates apparent positions, horizon geometry, and next rise/set times locally', async () => {
    const response = await request(app).get('/api/space/ephemeris?latitude=24.86&longitude=67.01&time=2026-03-20T00%3A00%3A00Z');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: 'Astronomy Engine, calculated locally',
      observer: { latitude: 24.86, longitude: 67.01, elevationMeters: 0 },
      sky: { twilightThresholdDegrees: -18 },
      dataType: 'Calculated solar-system ephemeris; not an observation or a JPL Horizons result',
    });
    expect(response.body.bodies).toHaveLength(10);
    expect(response.body.bodies.find((body) => body.name === 'Mars')).toMatchObject({
      aboveGeometricHorizon: expect.any(Boolean),
      sunBelowAstronomicalTwilight: expect.any(Boolean),
      riseWithin24HoursUtc: expect.any(String),
      setWithin24HoursUtc: expect.any(String),
    });
    expect(response.body.bodies.find((body) => body.name === 'Mars').rightAscensionHours).toBeGreaterThanOrEqual(0);
    expect(response.body.limitations).toMatch(/no numeric accuracy guarantee/i);
  });

  it('rejects invalid coordinates and timestamps without upstream calls', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const badCoordinates = await request(app).get('/api/space/ephemeris?latitude=91&longitude=0');
    const badTime = await request(app).get('/api/space/ephemeris?latitude=0&longitude=0&time=not-a-date');
    const outsideRange = await request(app).get('/api/space/ephemeris?latitude=0&longitude=0&time=2201-01-01T00%3A00%3A00Z');

    expect(badCoordinates.status).toBe(400);
    expect(badTime.status).toBe(400);
    expect(outsideRange.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('NASA Exoplanet Archive', () => {
  it('uses a bounded TAP query and preserves missing measurements as null', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{
      pl_name: 'TRAPPIST-1 b',
      hostname: 'TRAPPIST-1',
      discoverymethod: 'Transit',
      disc_year: 2016,
      sy_dist: 12.43,
      pl_bmassj: null,
      pl_radj: 0.92,
      pl_orbper: 1.51,
      st_spectype: null,
    }]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get('/api/space/exoplanets?search=TRAPPIST-1&limit=5');

    expect(response.status).toBe(200);
    expect(response.body.items[0]).toMatchObject({
      name: 'TRAPPIST-1 b',
      host: 'TRAPPIST-1',
      massJupiter: null,
      hostSpectralType: null,
      distanceParsecs: 12.43,
    });
    expect(response.body.dataType).toMatch(/not a complete deep-space-object catalog/i);
    const tapUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(tapUrl.origin).toBe('https://exoplanetarchive.ipac.caltech.edu');
    expect(tapUrl.searchParams.get('query')).toContain('select top 5');
    expect(tapUrl.searchParams.get('query')).toContain("lower(hostname) like '%trappist-1%'");
  });

  it('rejects query characters that could alter the fixed TAP query', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await request(app).get('/api/space/exoplanets?search=x%27%20or%201%3D1');

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('NASA PDS4 sample decoding', () => {
  const lid = 'urn:nasa:pds:test:rimfax_calibrated_00010';
  const labelUrl = 'https://pds-geosciences.wustl.edu/test/rimfax_calibrated_00010.xml';
  const product = {
    id: `${lid}::2.1`,
    type: 'Product_Observational',
    title: 'RIMFAX calibrated sounding data',
    metadata: { version: '2.1', label_url: labelUrl },
    properties: { lid: [lid], vid: ['2.1'] },
  };
  const label = `<?xml version="1.0" encoding="UTF-8"?>
    <Product_Observational>
      <Observation_Area><Time_Coordinates><start_date_time>2021-03-01T02:32:19.719</start_date_time></Time_Coordinates></Observation_Area>
      <File_Area_Observational>
        <File><file_name>rimfax_calibrated_00010.csv</file_name></File>
        <Table_Delimited>
          <offset>0</offset><records>2</records><record_delimiter>Carriage-Return Line-Feed</record_delimiter><field_delimiter>Comma</field_delimiter>
          <Record_Delimited><fields>3</fields><groups>1</groups>
            <Field_Delimited><name>record_number</name><data_type>ASCII_Integer</data_type></Field_Delimited>
            <Field_Delimited><name>record_type</name><data_type>ASCII_Integer</data_type><description>Type: 0 = Active Sounding, 5 = Calibration</description></Field_Delimited>
            <Field_Delimited><name>sample_time_increment</name><data_type>ASCII_Real</data_type><unit>ns</unit></Field_Delimited>
            <Group_Field_Delimited><repetitions>3</repetitions><fields>1</fields><groups>0</groups>
              <Field_Delimited><name>sounding_samples</name><data_type>ASCII_Real</data_type><unit>amplitude_ratio</unit><description>Sounding samples</description></Field_Delimited>
            </Group_Field_Delimited>
          </Record_Delimited>
        </Table_Delimited>
      </File_Area_Observational>
    </Product_Observational>`;
  const table = '1,0,0.5,1.5,2.5,3.5\r\n2,5,0.5,4,5,6\r\n';

  it('decodes the declared schema and selects the record type described as active sounding', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/search/1/products/')) return jsonResponse(product);
      if (String(url).endsWith('.xml')) return bytesResponse(label);
      if (String(url).endsWith('.csv')) return bytesResponse(table);
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get(`/api/space/planetary-archive/decode?lid=${encodeURIComponent(lid)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: 'NASA Planetary Data System',
      kind: 'sample-series',
      selectedRecordType: 0,
      recordCount: 1,
      returnedCount: 1,
      group: { field: 'sounding_samples', repetitions: 3, unit: 'amplitude_ratio' },
      rows: [{
        recordNumber: 1,
        recordType: 0,
        sampleCount: 3,
        sampleInterval: 0.5,
        samples: [
          { sampleIndex: 0, amplitude: 1.5 },
          { sampleIndex: 1, amplitude: 2.5 },
          { sampleIndex: 2, amplitude: 3.5 },
        ],
      }],
    });
    expect(response.body.observation.startTime).toBe('2021-03-01T02:32:19.719');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toBe('https://pds-geosciences.wustl.edu/test/rimfax_calibrated_00010.csv');
  });

  it('refuses labels outside the allowlisted PDS archive hosts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      ...product,
      metadata: { ...product.metadata, label_url: 'https://attacker.example/product.xml' },
    })));

    const response = await request(app).get(`/api/space/planetary-archive/decode?lid=${encodeURIComponent(lid)}`);

    expect(response.status).toBe(422);
    expect(response.body.message).toMatch(/outside the supported.*hosts/i);
  });

  it('rejects unsupported row limits before contacting NASA PDS', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await request(app).get(`/api/space/planetary-archive/decode?lid=${encodeURIComponent(lid)}&limit=11`);

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Groq Guide provider context', () => {
  it.skipIf(!env.GROQ_API_KEY)('includes selected Open-Meteo values, valid time, and source URL in the Groq request', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).startsWith('https://api.open-meteo.com/v1/forecast')) {
        return jsonResponse({
          latitude: 24.86,
          longitude: 67.01,
          current: { time: '2026-03-20T00:00', temperature_2m: 25, relative_humidity_2m: 60 },
          current_units: { temperature_2m: '°C', relative_humidity_2m: '%' },
        });
      }
      if (String(url) === 'https://api.groq.com/openai/v1/chat/completions') {
        return jsonResponse({ choices: [{ message: { content: 'The current model values are included.' } }] });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).post('/api/guide/ask').send({
      question: 'Explain these weather readings.',
      context: { type: 'weather', latitude: 24.86, longitude: 67.01 },
    });

    expect(response.status).toBe(200);
    expect(response.body.context.sources[0]).toMatchObject({
      name: 'Open-Meteo Forecast API',
      validTime: '2026-03-20T00:00',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const groqBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(groqBody.messages[1].content).toContain('"temperature_2m": 25');
    expect(groqBody.messages[1].content).toContain('https://api.open-meteo.com/v1/forecast');
    expect(groqBody.messages[1].content).toContain('valid time 2026-03-20T00:00');
  });
});
