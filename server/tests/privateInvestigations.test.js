import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  countDocuments: vi.fn(),
  create: vi.fn(),
  userId: 'owner-a',
}));

vi.mock('../src/models/Investigation.js', () => ({ default: mocks }));
vi.mock('../src/security/session.js', () => ({
  requireAuth(req, _res, next) {
    req.user = { _id: mocks.userId };
    return next();
  },
}));

import investigationRoutes from '../src/routes/investigations.js';

function queryReturning(value) {
  const query = {
    sort: vi.fn(() => query),
    skip: vi.fn(() => query),
    limit: vi.fn(() => query),
    lean: vi.fn().mockResolvedValue(value),
  };
  return query;
}

describe('private investigations', () => {
  let app;
  let readyState;

  beforeEach(() => {
    readyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;
    app = express();
    app.use(express.json());
    app.use(investigationRoutes);
    mocks.find.mockReset();
    mocks.findOne.mockReset();
    mocks.countDocuments.mockReset();
    mocks.create.mockReset();
  });

  afterEach(() => {
    mongoose.connection.readyState = readyState;
  });

  it('filters both note listing and count by the signed-in owner', async () => {
    mocks.find.mockReturnValue(queryReturning([{ _id: 'note-a', title: 'Private' }]));
    mocks.countDocuments.mockResolvedValue(1);
    const response = await request(app).get('/investigations');
    expect(response.status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith({ ownerId: 'owner-a' });
    expect(mocks.countDocuments).toHaveBeenCalledWith({ ownerId: 'owner-a' });
  });

  it('does not return another owner’s note by identifier', async () => {
    mocks.findOne.mockReturnValue(queryReturning(null));
    const response = await request(app).get('/investigations/507f1f77bcf86cd799439011');
    expect(response.status).toBe(404);
    expect(mocks.findOne).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439011', ownerId: 'owner-a' });
  });

  it('assigns the authenticated owner when creating a note', async () => {
    mocks.create.mockResolvedValue({ toJSON: () => ({ id: 'note-a' }) });
    const response = await request(app)
      .post('/investigations')
      .set('Origin', 'http://localhost:5173')
      .send({ title: 'Private note', question: 'How does the climate vary?', region: 'Global' });
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'owner-a' }));
  });
});
