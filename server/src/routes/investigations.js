import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import Investigation from '../models/Investigation.js';
import { requireTrustedOrigin } from '../security/origin.js';
import { requireAuth } from '../security/session.js';

const router = Router();
const evidenceSchema = z.object({
  title: z.string().trim().min(1).max(160),
  source: z.string().trim().min(1).max(120),
  url: z.string().url().max(2048).refine((value) => ['https:', 'http:'].includes(new URL(value).protocol), 'Evidence links must use HTTP or HTTPS.').optional(),
  summary: z.string().max(2000).optional(),
}).strict();
const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  question: z.string().trim().min(10).max(500),
  region: z.string().trim().min(2).max(120).default('Global'),
  datasets: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  methods: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  evidence: z.array(evidenceSchema).max(50).default([]),
  conclusion: z.string().trim().max(1000).default(''),
}).strict();
const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Investigation write limit reached', message: 'Please wait before saving more investigations.' },
});

const unavailable = (res) => res.status(503).json({ error: 'Investigation storage unavailable', message: 'MongoDB is not connected. Saved investigations are temporarily unavailable.' });

router.get('/investigations', requireAuth, async (req, res, next) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid pagination', message: 'Page must be 1–10000 and limit must be 1–100.' });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const { page, limit } = parsed.data;
    const [items, total] = await Promise.all([
      Investigation.find({ ownerId: req.user._id }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Investigation.countDocuments({ ownerId: req.user._id }),
    ]);
    return res.json({ count: total, page, limit, pages: Math.ceil(total / limit), items: items.map((item) => ({ ...item, id: String(item._id) })), retrievalTime: new Date().toISOString() });
  } catch (error) { return next(error); }
});

router.post('/investigations', createLimiter, requireTrustedOrigin, requireAuth, async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid investigation payload', message: parsed.error.issues[0]?.message || 'Check the supplied investigation fields.' });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const item = await Investigation.create({ ...parsed.data, ownerId: req.user._id });
    return res.status(201).json({ ok: true, item: item.toJSON() });
  } catch (error) { return next(error); }
});

router.get('/investigations/:id', requireAuth, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid investigation id' });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const item = await Investigation.findOne({ _id: req.params.id, ownerId: req.user._id }).lean();
    if (!item) return res.status(404).json({ error: 'Investigation not found' });
    return res.json({ item: { ...item, id: String(item._id) } });
  } catch (error) { return next(error); }
});

export default router;
