import { randomUUID } from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

import env from './config/env.js';
import configRoutes from './routes/config.js';
import weatherRoutes from './routes/weather.js';
import eventsRoutes from './routes/events.js';
import healthRoutes from './routes/health.js';
import trendRoutes from './routes/trend.js';
import dataSourceRoutes from './routes/sources.js';
import investigationRoutes from './routes/investigations.js';
import guideRoutes from './routes/guide.js';
import alertRoutes from './routes/alerts.js';
import spaceRoutes from './routes/space.js';
import spaceScienceRoutes from './routes/spaceScience.js';
import gibsRoutes from './routes/gibs.js';
import pdsRoutes from './routes/pds.js';
import geocodingRoutes from './routes/geocoding.js';
import authRoutes from './routes/auth.js';
import { connectDatabase } from './services/database.js';

const app = express();
if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);
const developmentOrigins = env.NODE_ENV === 'development'
  ? ['localhost', '127.0.0.1'].flatMap((host) => Array.from({ length: 8 }, (_, index) => `http://${host}:${5173 + index}`))
  : [];
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
  .filter(Boolean)
  .map((domain) => `https://${domain}`);
const allowedOrigins = new Set([env.CLIENT_URL, ...vercelOrigins, ...developmentOrigins]);

app.disable('x-powered-by');
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed by the TERRA API.');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Request-Id'],
  maxAge: 600,
}));
app.use(async (req, _res, next) => {
  const needsDatabase = /^\/api\/(?:health|config-status|auth|account|investigations|alerts)(?:\/|$)/.test(req.path);
  if (!needsDatabase) return next();
  try {
    await connectDatabase();
  } catch (error) {
    const errorCode = error?.codeName || error?.code || error?.name || 'ConnectionError';
    console.error(`MongoDB connection unavailable (${errorCode}).`);
  }
  next();
});
morgan.token('safe-url', (req) => req.originalUrl.split('?')[0]);
app.use(morgan(':remote-addr :method :safe-url :status :response-time ms', {
  skip: (req) => req.path === '/api/health',
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Request limit reached. Please wait before retrying.' },
}));
app.use('/api/change-analysis', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Analysis rate limit reached', message: 'Please wait before starting more regional analyses.' },
}));
app.use(express.json({ limit: '256kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 50 }));

app.get('/', (_req, res) => res.json({ name: 'TERRA API', status: 'online', version: '1.0.0', docs: '/api' }));
app.get('/api', (_req, res) => res.json({
  name: 'TERRA API', version: '1.0.0',
  endpoints: [
    { method: 'GET', path: '/api/health', description: 'Service liveness and dependency readiness' },
    { method: 'GET', path: '/api/config-status', description: 'Non-secret configuration and provider status' },
    { method: 'POST', path: '/api/auth/register', description: 'Create an account and send an email-verification link (requires SMTP)' },
    { method: 'POST', path: '/api/auth/login', description: 'Create a server-side session for a verified account' },
    { method: 'GET', path: '/api/auth/me', description: 'Read the current account session' },
    { method: 'POST', path: '/api/auth/logout', description: 'End the current account session' },
    { method: 'GET', path: '/api/weather?latitude=…&longitude=…', description: 'Open-Meteo current conditions and forecast' },
    { method: 'GET', path: '/api/geocode?q=Karachi', description: 'Bounded place-name search through the Open-Meteo Geocoding API' },
    { method: 'GET', path: '/api/events?feed=all_day&limit=20', description: 'USGS earthquake GeoJSON feed' },
    { method: 'GET', path: '/api/variables', description: 'Variables and region choices for change analysis' },
    { method: 'GET', path: '/api/change-analysis?variable=T2M&startYear=2001&endYear=2025&regions=nyc,amazon', description: 'NASA POWER regional change analysis' },
    { method: 'GET', path: '/api/space/atmosphere?altitudeKm=10', description: 'U.S. Standard Atmosphere model profile and selected altitude' },
    { method: 'GET', path: '/api/space/space-weather', description: 'NOAA SWPC geomagnetic indices, GOES X-ray observations, and recent messages' },
    { method: 'GET', path: '/api/space/near-earth-objects', description: 'NASA/JPL seven-day near-Earth object close-approach feed' },
    { method: 'GET', path: '/api/space/ephemeris?latitude=…&longitude=…&time=…', description: 'Calculated solar-system positions, geometric sky conditions, and next 24-hour rise/set times' },
    { method: 'GET', path: '/api/space/exoplanets?search=TRAPPIST-1&limit=20', description: 'Bounded NASA Exoplanet Archive catalog search' },
    { method: 'GET', path: '/api/space/planetary-archive?lid=urn:nasa:pds:mars2020_rimfax', description: 'NASA PDS bundle and collection catalog metadata with cursor pagination' },
    { method: 'GET', path: '/api/space/planetary-archive/decode?lid=urn:nasa:pds:mars2020_rimfax:data_calibrated:rimfax_calibrated_00010', description: 'Decode supported NASA PDS4 delimited tables and calibrated RIMFAX sounding samples' },
    { method: 'GET', path: '/api/earth/ozone', description: 'Latest NASA GIBS OMI ozone imagery date and map tiles' },
    { method: 'GET', path: '/api/data-sources', description: 'Implemented data-provider adapters' },
    { method: 'GET', path: '/api/investigations?page=1&limit=20', description: 'Paginated saved investigations (MongoDB)' },
    { method: 'POST', path: '/api/investigations', description: 'Save a validated investigation (MongoDB)' },
    { method: 'POST', path: '/api/guide/ask', description: 'Grounded, audience-aware science explanation (requires server API key)' },
    { method: 'GET', path: '/api/alerts/config', description: 'Push support and server configuration status' },
    { method: 'POST', path: '/api/alerts/subscribe', description: 'Register opt-in location-based USGS and forecast push alerts' },
    { method: 'POST', path: '/api/alerts/unsubscribe', description: 'Remove this device’s push alert registration' },
  ],
}));

app.use('/api', configRoutes);
app.use('/api', authRoutes);
app.use('/api', weatherRoutes);
app.use('/api', geocodingRoutes);
app.use('/api', eventsRoutes);
app.use('/api', trendRoutes);
app.use('/api', dataSourceRoutes);
app.use('/api', investigationRoutes);
app.use('/api', guideRoutes);
app.use('/api', alertRoutes);
app.use('/api', spaceRoutes);
app.use('/api', spaceScienceRoutes);
app.use('/api', gibsRoutes);
app.use('/api', pdsRoutes);
app.use('/api', healthRoutes);

app.use('/api/*', (req, res) => res.status(404).json({ error: 'API route not found', requestId: req.id }));
app.use((req, res) => res.status(404).json({ error: 'Route not found', requestId: req.id }));

app.use((error, req, res, _next) => {
  const databaseUnavailable = mongoose.connection.readyState !== 1 && /Mongo|Mongoose/.test(error.name || '');
  const status = databaseUnavailable ? 503 : Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status >= 500) console.error(`[${req.id}] ${error.name || 'Error'}: ${databaseUnavailable ? 'database operation unavailable' : error.message}`);
  const message = databaseUnavailable ? 'MongoDB is currently unavailable.' : status === 500 && env.NODE_ENV === 'production' ? 'Unexpected server error.' : error.message || 'Request could not be processed.';
  res.status(status).json({ error: status === 500 ? 'Internal server error' : status === 503 ? 'Service unavailable' : 'Request rejected', message, requestId: req.id });
});

export default app;
