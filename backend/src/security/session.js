import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import AccountSession from '../models/AccountSession.js';
import User from '../models/User.js';
import env from '../config/env.js';

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'terra_session';
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

function readCookie(req, name) {
  const cookies = req.headers.cookie?.split(';') || [];
  const match = cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

function sessionCookie(token, maxAgeSeconds) {
  const sameSite = env.NODE_ENV === 'production' ? 'None' : 'Lax';
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/api; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAgeSeconds}${secure}`;
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_DURATION_MS / 1000));
}

export function clearSessionCookie(res) {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/api; HttpOnly; SameSite=${env.NODE_ENV === 'production' ? 'None' : 'Lax'}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`);
}

export function safeAccount(user) {
  return { id: String(user._id), email: user.email, emailVerified: Boolean(user.emailVerifiedAt), createdAt: user.createdAt };
}

export async function createSession(userId, res) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await AccountSession.create({ tokenHash: hashToken(token), userId, expiresAt });
  setSessionCookie(res, token);
  return expiresAt;
}

export async function findSessionUser(req) {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  const session = await AccountSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await User.findById(session.userId);
  return user?.emailVerifiedAt ? user : null;
}

export async function destroySession(req) {
  const token = readCookie(req, COOKIE_NAME);
  if (token) await AccountSession.deleteOne({ tokenHash: hashToken(token) });
}

export async function requireAuth(req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Account storage unavailable', message: 'MongoDB is not connected, so the account session cannot be checked.' });
  try {
    const user = await findSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required', message: 'Sign in with a verified account to access private data.' });
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
