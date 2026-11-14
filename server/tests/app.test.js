import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('TERRA API', () => {
  it('returns health data', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  it('returns configuration status', async () => {
    const response = await request(app).get('/api/config-status');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
