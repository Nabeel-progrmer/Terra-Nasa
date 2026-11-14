import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 320 },
  passwordHash: { type: String, required: true, select: false },
  emailVerifiedAt: { type: Date, default: null },
  learningState: {
    bookmarks: { type: [String], default: [] },
    completed: { type: [String], default: [] },
    recent: { type: [String], default: [] },
  },
}, { timestamps: true, versionKey: false, bufferCommands: false });

export default mongoose.model('User', userSchema);
