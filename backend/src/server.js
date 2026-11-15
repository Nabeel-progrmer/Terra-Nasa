import mongoose from 'mongoose';
import Investigation from './models/Investigation.js';
import AlertSubscription from './models/AlertSubscription.js';
import AccountSession from './models/AccountSession.js';
import AccountToken from './models/AccountToken.js';
import User from './models/User.js';
import app from './app.js';
import env, { validateProductionConfig } from './config/env.js';
import { startAlertScheduler, stopAlertScheduler } from './services/alertScheduler.js';
import { configureWindowsDnsResolver } from './services/windowsDns.js';

let httpServer;
let shuttingDown = false;

async function startServer() {
  try {
    validateProductionConfig();
  } catch (error) {
    console.error(`TERRA configuration error: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  if (!env.MONGODB_URI) {
    console.warn('MongoDB is not configured. Read-only data APIs can run; investigation storage will return 503.');
  } else {
    try {
      if (env.MONGODB_URI.startsWith('mongodb+srv://')) {
        try {
          if (configureWindowsDnsResolver()) {
            console.info('Using Windows-configured DNS servers for MongoDB Atlas SRV resolution.');
          }
        } catch (error) {
          const errorCode = error?.code || error?.name || 'ResolverError';
          console.warn(`Windows DNS configuration could not be read (${errorCode}); trying Node's configured resolver.`);
        }
      }
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 7000, autoIndex: env.NODE_ENV !== 'production' });
      await Promise.all([
        Investigation.createIndexes(),
        AlertSubscription.createIndexes(),
        User.createIndexes(),
        AccountSession.createIndexes(),
        AccountToken.createIndexes(),
      ]);
      console.info('MongoDB connection established.');
    } catch (error) {
      const safeMessage = String(error?.message || 'Unknown connection error')
        .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[MongoDB URI redacted]')
        .slice(0, 240);
      const errorCode = error?.codeName || error?.code || error?.name || 'ConnectionError';
      console.error(`MongoDB connection failed (${errorCode}): ${safeMessage}. Investigation storage is unavailable; the service will report degraded readiness.`);
    }
  }

  httpServer = await new Promise((resolve, reject) => {
    const server = app.listen(env.PORT, '0.0.0.0', () => resolve(server));
    server.once('error', reject);
  }).catch((error) => {
    console.error(`TERRA could not listen on port ${env.PORT}: ${error.message}`);
    process.exitCode = 1;
    return null;
  });

  if (!httpServer) return null;
  console.info(`TERRA API listening on port ${env.PORT} (${env.NODE_ENV}).`);
  startAlertScheduler();
  return httpServer;
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`TERRA received ${signal}; shutting down.`);
  const timeout = setTimeout(() => { process.exit(1); }, 10000);
  timeout.unref();
  stopAlertScheduler();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  try { await mongoose.disconnect(); } catch { /* connection may never have been established */ }
  clearTimeout(timeout);
  process.exitCode = 0;
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

void startServer();
