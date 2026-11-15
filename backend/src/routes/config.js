import { Router } from 'express';
import mongoose from 'mongoose';
import env from '../config/env.js';
import { isEmailDeliveryConfigured } from '../services/accountEmail.js';

const router = Router();
const databaseStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/config-status', (_req, res) => {
  const configured = Boolean(env.MONGODB_URI);
  const state = databaseStates[mongoose.connection.readyState] || 'unknown';
  res.json({
    status: 'ok',
    config: {
      nodeEnv: env.NODE_ENV,
      database: { configured, connected: mongoose.connection.readyState === 1, state: configured ? state : 'not configured' },
      accountEmail: { configured: isEmailDeliveryConfigured() },
      providers: {
        openMeteo: { configured: true, endpoint: env.OPEN_METEO_BASE_URL },
        usgsEarthquakes: { configured: true },
        nasaPower: { configured: true },
      },
      assistant: { provider: 'Groq', configured: Boolean(env.GROQ_API_KEY), model: env.GROQ_MODEL },
      spaceData: {
        noaaSwpc: { configured: true },
        nasaNeoWs: { configured: true, personalKeyConfigured: Boolean(env.NASA_API_KEY), demoKeyFallback: !env.NASA_API_KEY },
      },
      pushAlerts: {
        configured: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
        databaseConnected: mongoose.connection.readyState === 1,
      },
      optionalIntegrations: {
        mongodb: configured,
        openWeather: false,
        nasaApiKey: false,
        noaaNcei: false,
        cesiumIon: false,
      },
    },
  });
});

export default router;
