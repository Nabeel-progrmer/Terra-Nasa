import mongoose from 'mongoose';

const alertSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true, select: false },
  ownerTokenHash: { type: String, required: true, select: false },
  keys: {
    p256dh: { type: String, required: true, select: false },
    auth: { type: String, required: true, select: false },
  },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  radiusKm: { type: Number, required: true, min: 1, max: 500, default: 50 },
  hazards: {
    earthquake: { type: Boolean, default: true },
    heavyRain: { type: Boolean, default: true },
  },
  minimumMagnitude: { type: Number, min: 2.5, max: 8, default: 4 },
  heavyRainMmPerHour: { type: Number, min: 1, max: 150, default: 20 },
  minimumRainProbability: { type: Number, min: 1, max: 100, default: 60 },
  lastRainAlertKey: { type: String, default: '' },
  sentEarthquakeIds: { type: [String], default: [] },
  enabled: { type: Boolean, default: true, index: true },
}, { timestamps: true, minimize: false });

alertSubscriptionSchema.index({ enabled: 1, updatedAt: -1 });

export default mongoose.models.AlertSubscription || mongoose.model('AlertSubscription', alertSubscriptionSchema);
