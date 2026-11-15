import mongoose from 'mongoose';

const evidenceSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 160 },
  source: { type: String, required: true, maxlength: 120 },
  url: { type: String, maxlength: 2048 },
  summary: { type: String, maxlength: 2000 },
}, { _id: false });

const investigationSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  question: { type: String, required: true, trim: true, minlength: 10, maxlength: 500 },
  region: { type: String, trim: true, default: 'Global', maxlength: 120 },
  datasets: [{ type: String, trim: true, maxlength: 120 }],
  methods: [{ type: String, trim: true, maxlength: 120 }],
  evidence: [evidenceSchema],
  conclusion: { type: String, trim: true, default: '', maxlength: 1000 },
}, { timestamps: true, versionKey: false, bufferCommands: false, toJSON: { virtuals: true }, toObject: { virtuals: true } });

investigationSchema.index({ ownerId: 1, createdAt: -1, _id: -1 });

export default mongoose.model('Investigation', investigationSchema);
