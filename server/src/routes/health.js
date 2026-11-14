import { Router } from 'express';
import mongoose from 'mongoose';
import env from '../config/env.js';

const router = Router();

router.get('/health', (_req, res) => {
  const database = {
    configured: Boolean(env.MONGODB_URI),
    connected: mongoose.connection.readyState === 1,
    state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
  };
  const ready = database.configured && database.connected;
  res.status(200).json({
    status: 'healthy',
    readiness: ready ? 'ready' : 'degraded',
    dependencies: { mongodb: database },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
