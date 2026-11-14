import mongoose from 'mongoose';

const accountTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, required: true, enum: ['verify-email', 'reset-password'] },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false, bufferCommands: false });

accountTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
accountTokenSchema.index({ userId: 1, purpose: 1 });

export default mongoose.model('AccountToken', accountTokenSchema);
