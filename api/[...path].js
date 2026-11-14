import app from '../server/src/app.js';
import { connectDatabase } from '../server/src/services/database.js';

export default async function handler(req, res) {
  try {
    await connectDatabase();
  } catch (error) {
    const errorCode = error?.codeName || error?.code || error?.name || 'ConnectionError';
    console.error(`MongoDB connection unavailable (${errorCode}).`);
  }

  return app(req, res);
}

export const config = {
  api: { bodyParser: false },
};
