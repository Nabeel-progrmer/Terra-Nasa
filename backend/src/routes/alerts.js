import { createHash } from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import env from '../config/env.js';
import AlertSubscription from '../models/AlertSubscription.js';
import { isSupportedPushEndpoint } from '../utils/pushEndpoint.js';

const router = Router();
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const databaseConnected = () => mongoose.connection.readyState === 1;
const pushConfigured = () => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().refine(isSupportedPushEndpoint, 'Push endpoint must use a supported browser push service.'),
    keys: z.object({ p256dh: z.string().min(32).max(256), auth: z.string().min(16).max(128) }).strict(),
  }).strict(),
  ownerToken: z.string().min(32).max(128),
  location: z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }).strict(),
  radiusKm: z.number().int().min(1).max(500).default(50),
  hazards: z.object({ earthquake: z.boolean().default(true), heavyRain: z.boolean().default(true) }).strict(),
  minimumMagnitude: z.number().min(2.5).max(8).default(4),
  heavyRainMmPerHour: z.number().min(1).max(150).default(20),
  minimumRainProbability: z.number().int().min(1).max(100).default(60),
}).strict().refine((value) => value.hazards.earthquake || value.hazards.heavyRain, { message: 'Choose at least one hazard type.' });

router.get('/alerts/config', (_req, res) => res.json({
  serverSupportsWebPush: true,
  pushConfigured: pushConfigured(),
  databaseConnected: databaseConnected(),
  canSubscribe: pushConfigured() && databaseConnected(),
  vapidPublicKey: pushConfigured() ? env.VAPID_PUBLIC_KEY : null,
  checkIntervalMinutes: Math.round(env.ALERT_CHECK_INTERVAL_MS / 60000),
  sources: { earthquake: 'USGS ComCat earthquake catalog', heavyRain: 'Open-Meteo forecast model output' },
}));

router.post('/alerts/subscribe', writeLimiter, async (req, res, next) => {
  if (!pushConfigured()) return res.status(503).json({ error: 'Push alerts not configured', message: 'The server needs a VAPID key pair before it can send push notifications.' });
  if (!databaseConnected()) return res.status(503).json({ error: 'Alert storage unavailable', message: 'MongoDB is not connected, so this device alert cannot be safely saved.' });
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid alert settings', message: parsed.error.issues[0]?.message || 'Review the selected alert settings.' });
  try {
    const { subscription, ownerToken, location, ...settings } = parsed.data;
    await AlertSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          ownerTokenHash: hashToken(ownerToken),
          keys: subscription.keys,
          latitude: location.latitude,
          longitude: location.longitude,
          ...settings,
          enabled: true,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.status(201).json({ saved: true, message: 'This device is enrolled. The server checks selected signals on its schedule.' });
  } catch (error) { return next(error); }
});

router.post('/alerts/unsubscribe', writeLimiter, async (req, res, next) => {
  if (!databaseConnected()) return res.status(503).json({ error: 'Alert storage unavailable', message: 'MongoDB is not connected.' });
  const parsed = z.object({ endpoint: z.string().url(), ownerToken: z.string().min(32).max(128) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid unsubscribe request', message: 'This device’s alert registration could not be identified.' });
  try {
    await AlertSubscription.findOneAndDelete({ endpoint: parsed.data.endpoint, ownerTokenHash: hashToken(parsed.data.ownerToken) });
    return res.json({ removed: true });
  } catch (error) { return next(error); }
});

export default router;
