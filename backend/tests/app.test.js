import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { validateProductionConfig } from '../src/config/env.js';

describe('TERRA API', () => {
  it('returns health data', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  it('exposes the Render health check at /health', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'healthy', dependencies: { mongodb: expect.any(Object) } });
  });

  it('reports missing production configuration clearly', () => {
    expect(() => validateProductionConfig({ NODE_ENV: 'production', MONGODB_URI: '', CLIENT_URL: 'https://terra.example' }))
      .toThrow('MONGODB_URI is required in production');
    expect(() => validateProductionConfig({ NODE_ENV: 'production', MONGODB_URI: 'mongodb://example', CLIENT_URL: 'http://localhost:5173' }))
      .toThrow('CLIENT_URL must use HTTPS');
  });

  it('returns configuration status', async () => {
    const response = await request(app).get('/api/config-status');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
