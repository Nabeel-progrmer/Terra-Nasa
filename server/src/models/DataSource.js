import mongoose from 'mongoose';

const dataSourceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  provider: { type: String, required: true },
  endpoint: { type: String, required: true },
  auth: { type: String, default: 'public' },
  updateFrequency: { type: String, default: 'varies' },
  coverage: { type: String, default: 'global' },
  provenance: { type: String, default: 'Source metadata is displayed in the UI.' },
  isActive: { type: Boolean, default: true },
  tags: [{ type: String }],
}, { timestamps: true });

export default mongoose.model('DataSource', dataSourceSchema);
