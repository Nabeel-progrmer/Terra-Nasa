import mongoose from 'mongoose';
import app from '../server/src/app.js';
import env from '../server/src/config/env.js';
import Investigation from '../server/src/models/Investigation.js';
import AlertSubscription from '../server/src/models/AlertSubscription.js';
import AccountSession from '../server/src/models/AccountSession.js';
import AccountToken from '../server/src/models/AccountToken.js';
import User from '../server/src/models/User.js';

let mongoConnection;

async function connectMongo() {
  if (!env.MONGODB_URI || mongoose.connection.readyState === 1) return;
  if (mongoConnection) return mongoConnection;

  mongoConnection = mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 7000,
    autoIndex: false,
    maxPoolSize: 5,
  }).then(async () => {
    await Promise.all([
      Investigation.createIndexes(),
      AlertSubscription.createIndexes(),
      User.createIndexes(),
      AccountSession.createIndexes(),
      AccountToken.createIndexes(),
    ]);
  }).finally(() => {
    mongoConnection = undefined;
  });

  return mongoConnection;
}

export default async function handler(req, res) {
  try {
    await connectMongo();
  } catch (error) {
    const errorCode = error?.codeName || error?.code || error?.name || 'ConnectionError';
    console.error(`MongoDB connection unavailable (${errorCode}).`);
  }

  return app(req, res);
}

export const config = {
  api: { bodyParser: false },
};
