import { createRequire } from 'node:module';
import mongoose from 'mongoose';
import env from '../config/env.js';
import AlertSubscription from '../models/AlertSubscription.js';
import { cached } from './providerCache.js';
import { fetchJson } from './providerFetch.js';

const require = createRequire(import.meta.url);
const webpush = require('web-push');

let timer;
let checking = false;
let configured = false;

const radians = (degrees) => degrees * Math.PI / 180;
function distanceKm(aLat, aLon, bLat, bLon) {
  const earthKm = 6371;
  const dLat = radians(bLat - aLat);
  const dLon = radians(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function sendAlert(subscription, payload) {
  try {
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, JSON.stringify(payload), { TTL: 300, urgency: 'high' });
    return true;
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await AlertSubscription.deleteOne({ _id: subscription._id });
      subscription.enabled = false;
      return false;
    }
    console.error(`Push delivery failed (${error.statusCode || error.name || 'unknown'}).`);
    return false;
  }
}

async function fetchRain(latitude, longitude) {
  const key = `alert-weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;
  return cached(key, 240, async () => {
    const url = new URL('/v1/forecast', env.OPEN_METEO_BASE_URL);
    url.search = new URLSearchParams({
      latitude: String(latitude), longitude: String(longitude),
      hourly: 'precipitation,precipitation_probability',
      forecast_hours: '6', timezone: 'UTC',
    });
    return fetchJson(url);
  });
}

async function checkEarthquakes(subscription, now) {
  if (!subscription.hazards.earthquake) return;
  const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
  url.search = new URLSearchParams({
    format: 'geojson', starttime: start, latitude: String(subscription.latitude), longitude: String(subscription.longitude),
    maxradiuskm: String(subscription.radiusKm), minmagnitude: String(subscription.minimumMagnitude), orderby: 'time',
  });
  const feed = await fetchJson(url);
  const recent = (feed.features || []).slice(0, 5);
  for (const feature of recent) {
    const eventId = String(feature.id || '');
    if (!eventId || subscription.sentEarthquakeIds.includes(eventId)) continue;
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [];
    if (coordinates.length < 2 || !Number.isFinite(properties.mag)) continue;
    const awayKm = distanceKm(subscription.latitude, subscription.longitude, coordinates[1], coordinates[0]);
    const sent = await sendAlert(subscription, {
      kind: 'earthquake',
      title: `Earthquake reported nearby: magnitude ${properties.mag.toFixed(1)}`,
      body: `${properties.place || 'Location not reported'}; about ${Math.round(awayKm)} km from your selected point. This is a USGS catalog report, not a prediction. Check the event details and local official guidance.`,
      url: properties.url || 'https://earthquake.usgs.gov/earthquakes/map/',
      source: 'USGS ComCat',
      eventId,
      occurredAt: properties.time ? new Date(properties.time).toISOString() : null,
      vibrate: [250, 120, 250],
    });
    if (sent) {
      subscription.sentEarthquakeIds.push(eventId);
      subscription.sentEarthquakeIds = subscription.sentEarthquakeIds.slice(-80);
      await subscription.save();
    }
  }
}

async function checkRain(subscription, now) {
  if (!subscription.hazards.heavyRain) return;
  const forecast = await fetchRain(subscription.latitude, subscription.longitude);
  const times = forecast.hourly?.time || [];
  const rain = forecast.hourly?.precipitation || [];
  const probabilities = forecast.hourly?.precipitation_probability || [];
  const nowMs = now.getTime();
  const candidates = times.flatMap((time, index) => {
    const forecastMs = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(time) ? time : `${time}:00Z`);
    if (!Number.isFinite(forecastMs) || forecastMs <= nowMs || forecastMs > nowMs + 6 * 60 * 60 * 1000) return [];
    const amount = Number(rain[index]);
    const probability = Number(probabilities[index]);
    return Number.isFinite(amount) && Number.isFinite(probability) && amount >= subscription.heavyRainMmPerHour && probability >= subscription.minimumRainProbability
      ? [{ time, amount, probability }]
      : [];
  });
  const next = candidates[0];
  if (!next) return;
  const alertKey = `${next.time}:${subscription.heavyRainMmPerHour}:${subscription.minimumRainProbability}`;
  if (subscription.lastRainAlertKey === alertKey) return;
  const sent = await sendAlert(subscription, {
    kind: 'heavy-rain-forecast',
    title: 'Heavy rain in the forecast near your location',
    body: `Open-Meteo forecasts ${next.amount.toFixed(1)} mm in an hour around ${new Date(next.time).toLocaleString('en', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })} (${Math.round(next.probability)}% precipitation probability). This is a model forecast, not an official warning. Check local authorities for alerts.`,
    url: '/weather',
    source: 'Open-Meteo forecast',
    forecastTime: next.time,
    vibrate: [250, 120, 250],
  });
  if (sent) {
    subscription.lastRainAlertKey = alertKey;
    await subscription.save();
  }
}

async function checkSubscriptions() {
  if (checking || mongoose.connection.readyState !== 1 || !configured) return;
  checking = true;
  try {
    const subscriptions = await AlertSubscription.find({ enabled: true }).select('+endpoint +ownerTokenHash +keys.p256dh +keys.auth');
    const now = new Date();
    for (const subscription of subscriptions) {
      try {
        await checkEarthquakes(subscription, now);
        if (subscription.enabled) await checkRain(subscription, now);
      } catch (error) {
        console.error(`Hazard check failed for one saved subscription (${error.name || 'provider error'}).`);
      }
    }
  } catch (error) {
    console.error(`Hazard scheduler could not read saved subscriptions (${error.name || 'database error'}).`);
  } finally {
    checking = false;
  }
}

export function startAlertScheduler() {
  if (timer) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.info('Push alert scheduler disabled: VAPID keys are not configured.');
    return;
  }
  try {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  } catch (error) {
    console.error(`Push alert scheduler disabled: invalid VAPID configuration (${error.message}).`);
    return;
  }
  timer = setInterval(() => { void checkSubscriptions(); }, env.ALERT_CHECK_INTERVAL_MS);
  timer.unref();
  void checkSubscriptions();
  console.info(`Push alert scheduler started; checks every ${Math.round(env.ALERT_CHECK_INTERVAL_MS / 60000)} minute(s).`);
}

export function stopAlertScheduler() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
