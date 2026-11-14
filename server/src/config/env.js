import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDirectory, '../../../.env') });
dotenv.config();

function integer(value, fallback, min, max) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

const smtpPort = integer(process.env.SMTP_PORT, 587, 1, 65535);

const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: integer(process.env.PORT, 5000, 1, 65535),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || '',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: smtpPort,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true' || (!process.env.SMTP_SECURE && smtpPort === 465),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_FROM: process.env.SMTP_FROM || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  NASA_API_KEY: process.env.NASA_API_KEY || '',
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:admin@terra.local',
  ALERT_CHECK_INTERVAL_MS: integer(process.env.ALERT_CHECK_INTERVAL_MS, 300000, 60000, 3600000),
  OPEN_METEO_BASE_URL: (process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com').replace(/\/$/, ''),
  CACHE_TTL_SECONDS: integer(process.env.CACHE_TTL_SECONDS, 300, 0, 86400),
  RATE_LIMIT_MAX: integer(process.env.RATE_LIMIT_MAX, 250, 10, 10000),
  PROVIDER_TIMEOUT_MS: integer(process.env.PROVIDER_TIMEOUT_MS, 12000, 1000, 60000),
  TRUST_PROXY_HOPS: integer(process.env.TRUST_PROXY_HOPS, 0, 0, 10),
});

export function validateProductionConfig(configuration = env) {
  if (configuration.NODE_ENV !== 'production') return;
  if (!configuration.MONGODB_URI) throw new Error('MONGODB_URI is required in production because investigations are persisted in MongoDB.');
  let clientOrigin;
  try { clientOrigin = new URL(configuration.CLIENT_URL); } catch { throw new Error('CLIENT_URL must be a valid absolute URL.'); }
  if (clientOrigin.protocol !== 'https:') throw new Error('CLIENT_URL must use HTTPS in production.');
}

export default env;
