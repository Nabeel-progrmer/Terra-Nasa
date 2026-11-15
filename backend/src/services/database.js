import mongoose from 'mongoose';
import env from '../config/env.js';
import Investigation from '../models/Investigation.js';
import AlertSubscription from '../models/AlertSubscription.js';
import AccountSession from '../models/AccountSession.js';
import AccountToken from '../models/AccountToken.js';
import User from '../models/User.js';

let connectionPromise;

export async function connectDatabase() {
  if (!env.MONGODB_URI || mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    connectionPromise = (async () => {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 7000,
        autoIndex: false,
        maxPoolSize: 5,
      });
      await Promise.all([
        Investigation.createIndexes(),
        AlertSubscription.createIndexes(),
        User.createIndexes(),
        AccountSession.createIndexes(),
        AccountToken.createIndexes(),
      ]);
    })();
  }

  const pending = connectionPromise;
  try {
    await pending;
  } finally {
    if (connectionPromise === pending) connectionPromise = undefined;
  }
}
