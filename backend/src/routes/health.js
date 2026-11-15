import { Router } from 'express';
import mongoose from 'mongoose';
import env from '../config/env.js';

const router = Router();

export function healthHandler(_req, res) {
  const database = {
    configured: Boolean(env.MONGODB_URI),
    connected: mongoose.connection.readyState === 1,
    state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
  };
  const ready = database.configured && database.connected;
  const statusCode = env.NODE_ENV === 'production' && !ready ? 503 : 200;
  res.status(statusCode).json({
    status: 'healthy',
    readiness: ready ? 'ready' : 'degraded',
    dependencies: { mongodb: database },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

router.get('/health', healthHandler);

export default router;
