import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import AccountSession from '../models/AccountSession.js';
import AccountToken from '../models/AccountToken.js';
import User from '../models/User.js';
import env from '../config/env.js';
import { isEmailDeliveryConfigured, sendAccountEmail } from '../services/accountEmail.js';
import { requireTrustedOrigin } from '../security/origin.js';
import { createSession, destroySession, findSessionUser, safeAccount, clearSessionCookie, requireAuth } from '../security/session.js';
import { hashPassword, verifyPassword } from '../security/passwords.js';

const router = Router();
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const genericRegistrationMessage = 'If this address can be registered, a verification email will arrive shortly.';
const genericResetMessage = 'If a verified account exists for this address, password-reset instructions will arrive shortly.';
const unavailable = (res) => res.status(503).json({ error: 'Account service unavailable', message: 'Account storage is not connected.' });
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Account request limit reached', message: 'Please wait before trying this account action again.' },
});
const registerLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Registration limit reached', message: 'Please wait before attempting another registration.' },
});

const emailSchema = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const newPasswordSchema = z.string().min(12).max(128).refine((value) => Buffer.byteLength(value, 'utf8') <= 128, 'Password must be at most 128 UTF-8 bytes.');
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128).refine((value) => Buffer.byteLength(value, 'utf8') <= 128),
}).strict();
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{40,64}$/);
const learningIdsSchema = z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(30)
  .refine((items) => new Set(items).size === items.length, 'Article ids must be unique.');
const learningStateSchema = z.object({
  bookmarks: learningIdsSchema,
  completed: learningIdsSchema,
  recent: learningIdsSchema,
}).strict();

router.use((req, res, next) => {
  const accountRoute = req.path.startsWith('/auth/') || req.path === '/account/learning-state';
  return !accountRoute || req.method === 'GET' ? next() : requireTrustedOrigin(req, res, next);
});

router.get('/auth/me', async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const user = await findSessionUser(req);
    return res.json({ user: user ? safeAccount(user) : null });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/register', registerLimit, async (req, res, next) => {
  const parsed = z.object({ email: emailSchema, password: newPasswordSchema }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid registration', message: parsed.error.issues[0]?.message || 'Check the email and password.' });
  if (!isEmailDeliveryConfigured()) return res.status(503).json({ error: 'Email delivery unavailable', message: 'Account registration requires configured SMTP email delivery.' });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    let user;
    try {
      user = await User.create({ email: parsed.data.email, passwordHash });
    } catch (error) {
      if (error.code === 11000) return res.status(202).json({ message: genericRegistrationMessage });
      throw error;
    }
    const token = randomBytes(32).toString('base64url');
    await AccountToken.deleteMany({ userId: user._id, purpose: 'verify-email' });
    await AccountToken.create({
      tokenHash: hashToken(token),
      userId: user._id,
      purpose: 'verify-email',
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    });
    const verificationUrl = new URL('/account', env.CLIENT_URL);
    verificationUrl.searchParams.set('verify', token);
    try {
      await sendAccountEmail({
        to: user.email,
        subject: 'Verify your TERRA account',
        text: `Verify your TERRA account within 24 hours: ${verificationUrl.href}\n\nIf you did not request this account, ignore this message.`,
      });
    } catch {
      await AccountToken.deleteMany({ userId: user._id, purpose: 'verify-email' });
      await User.deleteOne({ _id: user._id });
      return res.status(503).json({ error: 'Email delivery failed', message: 'TERRA could not send the verification email. Please try again later.' });
    }
    return res.status(202).json({ message: genericRegistrationMessage });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/verification/resend', authLimit, async (req, res, next) => {
  const parsed = z.object({ email: emailSchema }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email address', message: 'Enter a valid email address.' });
  if (!isEmailDeliveryConfigured()) return res.status(503).json({ error: 'Email delivery unavailable', message: 'Account verification requires configured SMTP email delivery.' });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const user = await User.findOne({ email: parsed.data.email });
    if (!user || user.emailVerifiedAt) return res.status(202).json({ message: genericRegistrationMessage });
    const token = randomBytes(32).toString('base64url');
    await AccountToken.deleteMany({ userId: user._id, purpose: 'verify-email' });
    await AccountToken.create({
      tokenHash: hashToken(token),
      userId: user._id,
      purpose: 'verify-email',
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    });
    const verificationUrl = new URL('/account', env.CLIENT_URL);
    verificationUrl.searchParams.set('verify', token);
    try {
      await sendAccountEmail({
        to: user.email,
        subject: 'Verify your TERRA account',
        text: `Verify your TERRA account within 24 hours: ${verificationUrl.href}\n\nIf you did not request this, ignore this message.`,
      });
    } catch {
      await AccountToken.deleteMany({ userId: user._id, purpose: 'verify-email' });
      return res.status(503).json({ error: 'Email delivery failed', message: 'TERRA could not send the verification email. Please try again later.' });
    }
    return res.status(202).json({ message: genericRegistrationMessage });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/verify', authLimit, async (req, res, next) => {
  const parsed = z.object({ token: tokenSchema }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid verification link', message: 'This verification link is invalid or has expired.' });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const action = await AccountToken.findOneAndDelete({
      tokenHash: hashToken(parsed.data.token),
      purpose: 'verify-email',
      expiresAt: { $gt: new Date() },
    });
    if (!action) return res.status(400).json({ error: 'Invalid verification link', message: 'This verification link is invalid or has expired.' });
    const user = await User.findByIdAndUpdate(action.userId, { $set: { emailVerifiedAt: new Date() } }, { new: true });
    if (!user) return res.status(400).json({ error: 'Invalid verification link', message: 'This verification link is invalid or has expired.' });
    await createSession(user._id, res);
    return res.json({ user: safeAccount(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/login', authLimit, async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid sign-in', message: 'Enter a valid email and password.' });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
    const passwordMatches = await verifyPassword(parsed.data.password, user?.passwordHash || `${'0'.repeat(32)}:${'0'.repeat(128)}`);
    if (!user || !passwordMatches || !user.emailVerifiedAt) {
      return res.status(401).json({ error: 'Sign-in failed', message: 'Email/password is incorrect, or the email address is not verified.' });
    }
    const expiresAt = await createSession(user._id, res);
    return res.json({ user: safeAccount(user), expiresAt });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/logout', authLimit, async (req, res, next) => {
  clearSessionCookie(res);
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    await destroySession(req);
    return res.json({ loggedOut: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/password-reset/request', authLimit, async (req, res, next) => {
  const parsed = z.object({ email: emailSchema }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email address', message: 'Enter a valid email address.' });
  if (!isEmailDeliveryConfigured()) return res.status(503).json({ error: 'Email delivery unavailable', message: 'Password reset requires configured SMTP email delivery.' });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const user = await User.findOne({ email: parsed.data.email, emailVerifiedAt: { $ne: null } });
    if (!user) return res.status(202).json({ message: genericResetMessage });
    const token = randomBytes(32).toString('base64url');
    await AccountToken.deleteMany({ userId: user._id, purpose: 'reset-password' });
    await AccountToken.create({
      tokenHash: hashToken(token),
      userId: user._id,
      purpose: 'reset-password',
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    const resetUrl = new URL('/account', env.CLIENT_URL);
    resetUrl.searchParams.set('reset', token);
    try {
      await sendAccountEmail({
        to: user.email,
        subject: 'Reset your TERRA password',
        text: `Reset your TERRA password within one hour: ${resetUrl.href}\n\nIf you did not request this reset, ignore this message.`,
      });
    } catch {
      await AccountToken.deleteMany({ userId: user._id, purpose: 'reset-password' });
      return res.status(503).json({ error: 'Email delivery failed', message: 'TERRA could not send the password-reset email. Please try again later.' });
    }
    return res.status(202).json({ message: genericResetMessage });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/password-reset/confirm', authLimit, async (req, res, next) => {
  const parsed = z.object({ token: tokenSchema, password: newPasswordSchema }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid password reset', message: parsed.error.issues[0]?.message || 'This reset link or new password is invalid.' });
  if (mongoose.connection.readyState !== 1) return unavailable(res);
  try {
    const action = await AccountToken.findOneAndDelete({
      tokenHash: hashToken(parsed.data.token),
      purpose: 'reset-password',
      expiresAt: { $gt: new Date() },
    });
    if (!action) return res.status(400).json({ error: 'Invalid password reset', message: 'This reset link is invalid or has expired.' });
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await User.findByIdAndUpdate(action.userId, { $set: { passwordHash } }, { new: true });
    if (!user) return res.status(400).json({ error: 'Invalid password reset', message: 'This reset link is invalid or has expired.' });
    await AccountSession.deleteMany({ userId: user._id });
    await AccountToken.deleteMany({ userId: user._id, purpose: 'reset-password' });
    return res.json({ reset: true, message: 'Password updated. Sign in with your new password.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/account/learning-state', requireAuth, (req, res) => res.json({ state: req.user.learningState }));

router.put('/account/learning-state', requireAuth, async (req, res, next) => {
  const parsed = learningStateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid learning state', message: parsed.error.issues[0]?.message || 'Check the supplied article ids.' });
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { learningState: parsed.data } }, { new: true, runValidators: true });
    if (!user) return res.status(401).json({ error: 'Authentication required', message: 'Sign in again to sync your learning progress.' });
    return res.json({ state: user.learningState });
  } catch (error) {
    return next(error);
  }
});

export default router;
