import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { clearProviderCache } from '../src/services/providerCache.js';
import env from '../src/config/env.js';
import { loadGuideContext, requestGroqAnswer } from '../src/routes/guide.js';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => clearProviderCache());

afterEach(() => {
  vi.unstubAllGlobals();
  clearProviderCache();
});

describe('input validation and source status', () => {
  it('rejects invalid weather coordinates without contacting a provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get('/api/weather?latitude=91&longitude=0');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid weather location');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported earthquake feeds', async () => {
    const response = await request(app).get('/api/events?feed=everything');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid event query');
  });

  it('rejects malformed place searches without contacting the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await request(app).get('/api/geocode?q=x');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid place search');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns only valid coordinates from the Open-Meteo geocoder', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      results: [
        { id: 1, name: 'Karachi', admin1: 'Sindh', country: 'Pakistan', latitude: 24.86, longitude: 67.01 },
        { id: 2, name: 'Invalid place', latitude: 95, longitude: 0 },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await request(app).get('/api/geocode?q=Karachi');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: 'Open-Meteo Geocoding API',
      attribution: 'Geocoding data by GeoNames',
      query: 'Karachi',
      results: [{ id: '1', name: 'Karachi', region: 'Sindh, Pakistan', latitude: 24.86, longitude: 67.01 }],
    });
    expect(response.body.results).toHaveLength(1);
    expect(new URL(fetchMock.mock.calls[0][0]).origin).toBe('https://geocoding-api.open-meteo.com');
  });

  it('rejects a trend period shorter than ten years', async () => {
    const response = await request(app).get('/api/change-analysis?variable=T2M&startYear=2019&endYear=2025&regions=nyc,amazon');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid change-analysis request');
  });

  it('reports implemented sources without claiming live uptime', async () => {
    const response = await request(app).get('/api/data-sources');
    expect(response.status).toBe(200);
    expect(response.body.items.map((source) => source.id)).toEqual(expect.arrayContaining([
      'open-meteo', 'open-meteo-geocoding', 'usgs-earthquakes', 'nasa-power', 'us-standard-atmosphere-1976', 'noaa-swpc', 'nasa-neows', 'nasa-gibs-omi-ozone',
      'nasa-pds-registry',
      'astronomy-engine', 'nasa-exoplanet-archive',
    ]));
    expect(response.body.note).toMatch(/does not verify provider uptime/i);
  });

  it('does not expose secret values in configuration status', async () => {
    const response = await request(app).get('/api/config-status');
    expect(response.status).toBe(200);
    const serialized = JSON.stringify(response.body);
    for (const secret of [env.MONGODB_URI, env.GROQ_API_KEY, env.NASA_API_KEY, env.VAPID_PRIVATE_KEY]) {
      if (secret) expect(serialized).not.toContain(secret);
    }
    expect(response.body.config.assistant).not.toHaveProperty('apiKey');
    expect(response.body.config.assistant.provider).toBe('Groq');
    expect(response.body.config.pushAlerts).not.toHaveProperty('privateKey');
  });

  it('rejects investigation writes from requests without an allowed browser origin', async () => {
    const response = await request(app).post('/api/investigations').send({ title: 'x', question: 'too short' });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Untrusted request origin');
  });

  it('validates account registration passwords before using SMTP or MongoDB', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'person@example.test', password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid registration');
  });

  it('requires an allowed origin for account session mutations', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'person@example.test', password: 'some password' });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Untrusted request origin');
  });

  it('rejects invalid guide questions', async () => {
    const response = await request(app).post('/api/guide/ask').send({ question: '' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid guide request');
  });

  it('rejects atmospheric altitudes outside the standard-atmosphere model', async () => {
    const response = await request(app).get('/api/space/atmosphere?altitudeKm=100');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid atmospheric altitude');
  });

  it('returns labeled standard-atmosphere model values, not measured conditions', async () => {
    const response = await request(app).get('/api/space/atmosphere?altitudeKm=0');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: 'U.S. Standard Atmosphere, 1976',
      dataType: 'Model output, not a local measurement or weather forecast',
      selected: { layer: 'Troposphere', temperatureK: 288.15, pressurePa: 101325 },
    });
    expect(response.body.profile.length).toBeGreaterThan(30);

    const upperBoundary = await request(app).get('/api/space/atmosphere?altitudeKm=84.852');
    expect(upperBoundary.body.selected.layer).toBe('Mesosphere');
    expect(upperBoundary.body.selected.pressurePa).toBeCloseTo(0.3734, 3);
  });

  it.skipIf(Boolean(env.GROQ_API_KEY))('explains how to enable Groq when the server key is missing', async () => {
    const response = await request(app).post('/api/guide/ask').send({ question: 'Explain a climate trend.' });
    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/GROQ_API_KEY/);
  });

  it('uses the Groq chat-completions API and extracts its answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      choices: [{ message: { content: 'A grounded explanation.' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const answer = await requestGroqAnswer({
      apiKey: 'test-key',
      model: 'test-model',
      instructions: 'Be accurate.',
      input: 'Explain a trend.',
      timeoutMs: 12000,
    });

    expect(answer).toBe('A grounded explanation.');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'test-model',
      messages: [{ role: 'system', content: 'Be accurate.' }, { role: 'user', content: 'Explain a trend.' }],
    });
  });

  it('loads only verified Learning Center article context for assistant grounding', async () => {
    const context = await loadGuideContext({
      type: 'documentation',
      articleId: 'trend-analysis',
      sectionHeading: 'Read the results',
    });

    expect(context.payload).toMatchObject({
      type: 'verified TERRA Learning Center article',
      articleId: 'trend-analysis',
      currentSection: 'Read the results',
      canonicalPath: '/learn/trend-analysis',
    });
    expect(context.payload.sections.some((section) => section.heading === 'Read the results')).toBe(true);
    await expect(loadGuideContext({
      type: 'documentation',
      articleId: 'not-a-real-article',
      sectionHeading: 'Read the results',
    })).rejects.toMatchObject({ status: 404 });
    await expect(loadGuideContext({
      type: 'documentation',
      articleId: 'trend-analysis',
      sectionHeading: 'A made up section',
    })).rejects.toMatchObject({ status: 400 });
  });

  it('preserves bounded chat history when building Groq messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      choices: [{ message: { content: 'A grounded follow-up.' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await requestGroqAnswer({
      apiKey: 'test-key',
      model: 'test-model',
      instructions: 'Be accurate.',
      input: 'Explain the next step.',
      history: [{ role: 'user', content: 'How does the workflow begin?' }, { role: 'assistant', content: 'Choose a variable.' }],
      timeoutMs: 12000,
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual([
      { role: 'system', content: 'Be accurate.' },
      { role: 'user', content: 'How does the workflow begin?' },
      { role: 'assistant', content: 'Choose a variable.' },
      { role: 'user', content: 'Explain the next step.' },
    ]);
  });

  it.skipIf(!env.GROQ_API_KEY)('explains when the configured Groq model is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      error: { message: 'model not found', type: 'invalid_request_error', code: 'model_not_found' },
    }, 404)));

    const response = await request(app).post('/api/guide/ask').send({
      question: 'Explain a climate trend.',
    });

    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/GROQ_MODEL.*active model/i);
  });

  it.skipIf(!env.GROQ_API_KEY)('grounds statistical significance explanations in correct p-value interpretation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      choices: [{ message: { content: 'A p-value is interpreted under the null hypothesis.' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).post('/api/guide/ask').send({
      question: 'What does a five percent result mean?',
    });

    expect(response.status).toBe(200);
    const systemInstructions = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content;
    expect(systemInstructions).toContain('not the probability that the null is true');
    expect(systemInstructions).toContain('Do not infer a p-value, trend direction, or significance');
  });
});

describe('provider adapters', () => {
  it('uses the latest advertised NASA GIBS OMI ozone date and tile product', async () => {
    const capabilities = `<Capabilities><Layer><ows:Title>Ozone (DOAS, v3, Standard, OMI, Aura)</ows:Title><ows:Identifier>OMI_Ozone_DOAS_Total_Column</ows:Identifier><Dimension><ows:Identifier>Time</ows:Identifier><Default>2026-11-09</Default><Value>2004-10-01/2026-11-09/P1D</Value></Dimension><TileMatrixSetLink><TileMatrixSet>GoogleMapsCompatible_Level6</TileMatrixSet></TileMatrixSetLink><Format>image/png</Format></Layer></Capabilities>`;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => capabilities,
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get('/api/earth/ozone');

    expect(response.status).toBe(200);
    expect(response.body.layer).toBe('OMI_Ozone_DOAS_Total_Column');
    expect(response.body.observationDate).toBe('2026-11-09');
    expect(response.body.tileUrlTemplate).toContain('/2026-11-09/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png');
    expect(response.body.limitation).toMatch(/latest date currently advertised/i);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('normalizes NOAA space-weather products and keeps source timestamps', async () => {
    const now = new Date().toISOString();
    const fetchMock = vi.fn(async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('noaa-planetary-k-index.json')) return jsonResponse([{ time_tag: now, Kp: 4.67 }]);
      if (path.endsWith('kyoto-dst.json')) return jsonResponse([{ time_tag: now, dst: -35 }]);
      if (path.endsWith('xrays-7-day.json')) return jsonResponse([{ time_tag: now, flux: 0.000001, energy: '0.1-0.8nm', satellite: 18 }]);
      if (path.endsWith('alerts.json')) return jsonResponse([{ issue_datetime: now, product_id: 'TEST', message: 'Test notice' }]);
      if (path.endsWith('propagated-solar-wind-1-hour.json')) {
        return jsonResponse([
          ['time_tag', 'speed', 'density', 'temperature', 'bz', 'propagated_time_tag'],
          [now, 412, 5.1, 100000, -3.2, now],
        ]);
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get('/api/space/space-weather');

    expect(response.status).toBe(200);
    expect(response.body.source).toContain('NOAA');
    expect(response.body.products.planetaryKIndex).toEqual([{ time: now, value: 4.67 }]);
    expect(response.body.products.dstIndex).toEqual([{ time: now, value: -35 }]);
    expect(response.body.products.xrayFlux[0]).toMatchObject({ time: now, fluxWm2: 0.000001 });
    expect(response.body.products.propagatedSolarWind[0]).toMatchObject({
      time: now,
      propagatedTime: now,
      speedKmS: 412,
      densityParticlesCm3: 5.1,
      temperatureK: 100000,
      bzNt: -3.2,
    });
    expect(response.body.products.recentMessages[0].productId).toBe('TEST');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('keeps NOAA space-weather panels available when one product fails', async () => {
    const fetchMock = vi.fn(async (url) => {
      const path = new URL(url).pathname;
      if (path.endsWith('kyoto-dst.json')) return jsonResponse({}, 503);
      if (path.endsWith('noaa-planetary-k-index.json')) return jsonResponse([{ time_tag: new Date().toISOString(), Kp: 3 }]);
      if (path.endsWith('xrays-7-day.json')) return jsonResponse([{ time_tag: new Date().toISOString(), flux: 1e-7, energy: '0.1-0.8nm' }]);
      if (path.endsWith('alerts.json')) return jsonResponse([{ issue_datetime: new Date().toISOString(), product_id: 'TEST', message: 'Test notice' }]);
      if (path.endsWith('propagated-solar-wind-1-hour.json')) {
        const now = new Date().toISOString();
        return jsonResponse([['time_tag', 'speed', 'density', 'temperature', 'bz', 'propagated_time_tag'], [now, 400, 4, 80000, -2, now]]);
      }
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get('/api/space/space-weather');

    expect(response.status).toBe(200);
    expect(response.body.unavailableProducts).toEqual(['dst']);
    expect(response.body.products.planetaryKIndex).toHaveLength(1);
    expect(response.body.products.dstIndex).toEqual([]);
  });

  it('returns NASA/JPL close approaches with the hazard caveat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      near_earth_objects: {
        '2026-11-14': [{
          id: '12345',
          name: 'Test object',
          close_approach_data: [{
            close_approach_date_full: '2026-Nov-14 03:38',
            relative_velocity: { kilometers_per_second: '7.2' },
            miss_distance: { kilometers: '15974991', lunar: '41.5' },
          }],
          estimated_diameter: { meters: { estimated_diameter_min: 10, estimated_diameter_max: 20 } },
          is_potentially_hazardous_asteroid: false,
        }],
      },
    })));

    const response = await request(app).get('/api/space/near-earth-objects');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.objects[0]).toMatchObject({
      id: '12345',
      relativeVelocityKmS: 7.2,
      missDistanceKm: 15974991,
      nasaPotentiallyHazardous: false,
    });
    expect(response.body.note).toMatch(/not an impact prediction/i);
  });

  it('returns an explicit temporary-unavailable status when NASA NeoWs is rate limited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));

    const response = await request(app).get('/api/space/near-earth-objects');

    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/rate limited/i);
  });

  it('browses verified NASA PDS product and member metadata without inventing observations', async () => {
    const lid = 'urn:nasa:pds:mars2020_rimfax';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: `${lid}::1.0`,
        type: 'Product_Bundle',
        title: 'Mars 2020 RIMFAX Bundle',
        start_date_time: '2021-02-18T00:00:00Z',
        stop_date_time: '3000-01-01T00:00:00.000Z',
        metadata: {
          version: '1.0',
          update_date_time: '2026-08-11T00:00:00Z',
          label_url: 'https://pds.example.nasa.gov/rimfax.xml',
        },
        properties: { lid: [lid], vid: ['1.0'] },
      }))
      .mockResolvedValueOnce(jsonResponse({
        summary: { hits: 1 },
        data: [{
          id: `${lid}:data_raw::16.0`,
          type: 'Product_Collection',
          title: 'Mars 2020 RIMFAX Raw Data Collection',
          start_date_time: '2021-02-22T20:31:49Z',
          metadata: { version: '16.0', label_url: 'https://pds.example.nasa.gov/data_raw.xml' },
          properties: { lid: [`${lid}:data_raw`], vid: ['16.0'] },
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get(`/api/space/planetary-archive?lid=${encodeURIComponent(lid)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      source: 'NASA Planetary Data System Registry',
      dataType: 'Archive catalog metadata, not decoded science measurements',
      product: { lid, title: 'Mars 2020 RIMFAX Bundle', productType: 'Product_Bundle', version: '1.0', stopDate: null },
      members: {
        total: 1,
        items: [{ lid: `${lid}:data_raw`, title: 'Mars 2020 RIMFAX Raw Data Collection', productType: 'Product_Collection' }],
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('limit')).toBe('26');
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('sort')).toBe('lid');
    expect(response.body.product.labelUrl).toBe('https://pds.example.nasa.gov/rimfax.xml');
  });

  it('uses NASA PDS search-after cursors for stable archive pagination', async () => {
    const lid = 'urn:nasa:pds:mars2020_rimfax';
    const product = {
      id: `${lid}::1.0`,
      type: 'Product_Bundle',
      title: 'Mars 2020 RIMFAX Bundle',
      metadata: { version: '1.0' },
      properties: { lid: [lid], vid: ['1.0'] },
    };
    const makeMember = (index) => {
      const memberLid = `${lid}:collection_${String(index).padStart(2, '0')}`;
      return {
        id: `${memberLid}::1.0`,
        type: 'Product_Collection',
        title: `RIMFAX collection ${index}`,
        metadata: { version: '1.0' },
        properties: { lid: [memberLid], vid: ['1.0'] },
      };
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(product))
      .mockResolvedValueOnce(jsonResponse({ summary: { hits: 26 }, data: Array.from({ length: 26 }, (_, index) => makeMember(index)) }))
      .mockResolvedValueOnce(jsonResponse(product))
      .mockResolvedValueOnce(jsonResponse({ summary: { hits: 26 }, data: [makeMember(25)] }));
    vi.stubGlobal('fetch', fetchMock);

    const firstPage = await request(app).get(`/api/space/planetary-archive?lid=${encodeURIComponent(lid)}`);
    const cursor = firstPage.body.members.nextCursor;
    const secondPage = await request(app).get(`/api/space/planetary-archive?lid=${encodeURIComponent(lid)}&cursor=${encodeURIComponent(cursor)}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.members.items).toHaveLength(25);
    expect(cursor).toBe(`${lid}:collection_24`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.members.items).toHaveLength(1);
    expect(secondPage.body.members.nextCursor).toBeNull();
    expect(new URL(fetchMock.mock.calls[3][0]).searchParams.get('search-after')).toBe(cursor);
  });

  it('rejects invalid NASA PDS identifiers without contacting the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get('/api/space/planetary-archive?lid=https%3A%2F%2Fexample.com');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid NASA PDS archive request');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a missing NASA PDS product as not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)));

    const response = await request(app).get('/api/space/planetary-archive?lid=urn%3Anasa%3Apds%3Ano-such-product');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NASA PDS product not found');
  });

  it('returns live weather data with source and retrieval timestamp', async () => {
    const forecast = {
      current: { temperature_2m: 18.5, relative_humidity_2m: 65, wind_speed_10m: 9 },
      hourly: { time: ['2025-01-01T00:00'] },
      daily: { time: ['2025-01-01'] },
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(forecast));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app).get('/api/weather?latitude=24.8615&longitude=67.0099');

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('Open-Meteo');
    expect(response.body.current.temperature_2m).toBe(18.5);
    expect(response.body.dataType).toMatch(/forecast-model output/i);
    expect(Number.isNaN(Date.parse(response.body.retrievalTime))).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestUrl.origin).toBe('https://api.open-meteo.com');
    expect(requestUrl.searchParams.get('current')).toContain('dew_point_2m');
    expect(requestUrl.searchParams.get('current')).toContain('surface_pressure');
    expect(requestUrl.searchParams.get('hourly')).toContain('precipitation_probability');
    expect(requestUrl.searchParams.get('hourly')).toContain('wind_speed_10m');
  });

  it('rejects incomplete weather payloads instead of returning a success-shaped response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      current: { temperature_2m: 18.5 },
      daily: { time: ['2025-01-01'] },
    })));

    const response = await request(app).get('/api/weather?latitude=24.8617&longitude=67.0099');

    expect(response.status).toBe(502);
    expect(response.body.message).toMatch(/incomplete weather response/i);
    expect(response.body.current).toBeUndefined();
  });

  it('reports provider failures instead of returning success-shaped weather', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)));

    const response = await request(app).get('/api/weather?latitude=24.8616&longitude=67.0099');

    expect(response.status).toBe(502);
    expect(response.body.error).toBe('Weather data unavailable');
    expect(response.body.current).toBeUndefined();
  });

  it('normalizes and returns USGS earthquake observations', async () => {
    const occurred = '2025-02-01T10:00:00.000Z';
    const payload = {
      metadata: { count: 1 },
      features: [{
        id: 'test-earthquake',
        properties: { place: 'Test location', mag: 4.2, time: Date.parse(occurred), sources: ',us,', url: 'https://earthquake.usgs.gov/test' },
        geometry: { coordinates: [67.01, 24.86, 12.5] },
      }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(payload)));

    const response = await request(app).get('/api/events?feed=all_week&limit=1');

    expect(response.status).toBe(200);
    expect(response.body.source).toContain('USGS');
    expect(response.body.events).toHaveLength(1);
    expect(response.body.events[0]).toMatchObject({
      id: 'test-earthquake',
      place: 'Test location',
      magnitude: 4.2,
      depthKm: 12.5,
      time: occurred,
      coordinates: [67.01, 24.86, 12.5],
    });
  });

  it('calculates the same direction and Sen slope for regional NASA POWER series', async () => {
    const monthly = {};
    for (let year = 2001; year <= 2010; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        monthly[`${year}${String(month).padStart(2, '0')}`] = 10 + year - 2001;
      }
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      properties: { parameter: { T2M: monthly } },
    })));

    const response = await request(app).get('/api/change-analysis?variable=T2M&startYear=2001&endYear=2010&regions=nyc,amazon');

    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(2);
    for (const result of response.body.results) {
      expect(result.analysis.direction).toBe('increasing');
      expect(result.analysis.senSlopePerYear).toBe(1);
      expect(result.analysis.totalChange).toBe(9);
      expect(result.analysis.coverage).toBe(100);
      expect(result.analysis.statisticallySignificant).toBe(true);
    }
    expect(response.body.source.product).toContain('MERRA-2');
    expect(response.body.failures).toEqual([]);
  });

  it('publishes the expanded monthly parameter catalog with correct units and record starts', async () => {
    const response = await request(app).get('/api/variables');
    expect(response.status).toBe(200);
    const variables = Object.fromEntries(response.body.variables.map((item) => [item.id, item]));
    expect(variables.T2M_MAX).toMatchObject({ unit: '°C', startYear: 1981 });
    expect(variables.T2M_MIN).toMatchObject({ unit: '°C', startYear: 1981 });
    expect(variables.QV2M).toMatchObject({ unit: 'g/kg', startYear: 1981 });
    expect(variables.ALLSKY_SFC_SW_DWN).toMatchObject({ unit: 'kWh/m²/day', startYear: 1984 });
    expect(variables.ALLSKY_SFC_LW_DWN).toMatchObject({ unit: 'kWh/m²/day', startYear: 1984 });
  });

  it('fetches NASA POWER monthly values for a user-defined point', async () => {
    const monthly = {};
    for (let year = 2010; year <= 2019; year += 1) {
      for (let month = 1; month <= 12; month += 1) monthly[`${year}${String(month).padStart(2, '0')}`] = 20 + year - 2010;
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      header: { sources: ['MERRA2'] },
      properties: { parameter: { T2M_MAX: monthly } },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const locations = [{ type: 'point', id: 'custom-karachi', name: 'Karachi', latitude: 24.86, longitude: 67.01 }];
    const query = new URLSearchParams({ variable: 'T2M_MAX', startYear: '2010', endYear: '2019', locations: JSON.stringify(locations) });

    const response = await request(app).get(`/api/change-analysis?${query}`);

    expect(response.status).toBe(200);
    expect(response.body.results[0]).toMatchObject({ region: { name: 'Karachi', latitude: 24.86, longitude: 67.01 } });
    expect(response.body.results[0].analysis.senSlopePerYear).toBe(1);
    const providerUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(providerUrl.searchParams.get('latitude')).toBe('24.86');
    expect(providerUrl.searchParams.get('longitude')).toBe('67.01');
    expect(providerUrl.searchParams.get('community')).toBe('RE');
  });

  it('computes an area-weighted trend from NASA POWER regional grid cells', async () => {
    const features = [];
    for (const latitude of [60.25, 60.75]) {
      for (const longitude of [10.25, 10.75]) {
        const monthly = {};
        const latitudeOffset = latitude < 60.5 ? 10 : 20;
        for (let year = 2010; year <= 2019; year += 1) {
          for (let month = 1; month <= 12; month += 1) {
            monthly[`${year}${String(month).padStart(2, '0')}`] = latitudeOffset + year - 2010;
          }
        }
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [longitude, latitude, 0] },
          properties: { parameter: { T2M: monthly } },
        });
      }
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ features, header: { sources: ['MERRA2'] } }));
    vi.stubGlobal('fetch', fetchMock);
    const locations = [{
      type: 'area', id: 'custom-nordic-box', name: 'Nordic test area',
      minLatitude: 60, maxLatitude: 61, minLongitude: 10, maxLongitude: 11,
    }];
    const query = new URLSearchParams({ variable: 'T2M', startYear: '2010', endYear: '2019', locations: JSON.stringify(locations) });

    const response = await request(app).get(`/api/change-analysis?${query}`);

    expect(response.status).toBe(200);
    expect(response.body.results[0].analysis.senSlopePerYear).toBe(1);
    expect(response.body.results[0].analysis.areaCoverage).toBe(100);
    expect(response.body.results[0].analysis.mean).toBeLessThan(19.5);
    expect(response.body.results[0].region.spatialSupport).toContain('area-weighted');
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toContain('/monthly/regional');
  });

  it('rejects invalid area bounds and periods before contacting NASA POWER', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const tooWide = [{ type: 'area', id: 'large', name: 'Too large', minLatitude: 0, maxLatitude: 6, minLongitude: 0, maxLongitude: 1 }];
    const tooEarly = [{ type: 'point', id: 'solar-point', name: 'Solar point', latitude: 0, longitude: 0 }];
    const wideQuery = new URLSearchParams({ variable: 'T2M', startYear: '2010', endYear: '2019', locations: JSON.stringify(tooWide) });
    const earlyQuery = new URLSearchParams({ variable: 'ALLSKY_SFC_SW_DWN', startYear: '1981', endYear: '1990', locations: JSON.stringify(tooEarly) });

    expect((await request(app).get(`/api/change-analysis?${wideQuery}`)).status).toBe(400);
    expect((await request(app).get(`/api/change-analysis?${earlyQuery}`)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a Student-t critical value for the reported OLS slope interval', async () => {
    const annualValues = [11, 13, 12, 16, 15, 17, 16, 20, 19, 22];
    const monthly = {};
    annualValues.forEach((value, index) => {
      for (let month = 1; month <= 12; month += 1) {
        monthly[`${2001 + index}${String(month).padStart(2, '0')}`] = value;
      }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      properties: { parameter: { T2M: monthly } },
    })));

    const response = await request(app).get('/api/change-analysis?variable=T2M&startYear=2001&endYear=2010&regions=nyc');
    expect(response.status).toBe(200);

    const years = annualValues.map((_, index) => 2001 + index);
    const xMean = years.reduce((sum, year) => sum + year, 0) / years.length;
    const yMean = annualValues.reduce((sum, value) => sum + value, 0) / annualValues.length;
    const sumSquares = years.reduce((sum, year) => sum + (year - xMean) ** 2, 0);
    const slope = years.reduce((sum, year, index) => sum + (year - xMean) * (annualValues[index] - yMean), 0) / sumSquares;
    const residualSumSquares = years.reduce((sum, year, index) => sum + (annualValues[index] - (yMean + slope * (year - xMean))) ** 2, 0);
    const standardError = Math.sqrt(residualSumSquares / (annualValues.length - 2) / sumSquares);
    const expectedHalfWidth = 2.306 * standardError;
    const interval = response.body.results[0].analysis.confidence95;

    expect(interval[0]).toBeCloseTo(slope - expectedHalfWidth, 3);
    expect(interval[1]).toBeCloseTo(slope + expectedHalfWidth, 3);
  });

  it('counts missing annual observations in the requested-period coverage', async () => {
    const monthly = {};
    for (let year = 2001; year <= 2011; year += 1) {
      const lastMonth = year === 2005 ? 9 : 12;
      for (let month = 1; month <= lastMonth; month += 1) {
        monthly[`${year}${String(month).padStart(2, '0')}`] = 10 + year - 2001;
      }
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      properties: { parameter: { T2M: monthly } },
    })));

    const response = await request(app).get('/api/change-analysis?variable=T2M&startYear=2001&endYear=2011&regions=nyc');

    expect(response.status).toBe(200);
    const analysis = response.body.results[0].analysis;
    expect(analysis.nYears).toBe(10);
    expect(analysis.coverage).toBe(97.7);
    expect(analysis.observations.some((item) => item.year === 2005)).toBe(false);
  });
});
