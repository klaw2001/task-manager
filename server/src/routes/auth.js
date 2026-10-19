import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { authenticate, endSession, publicUser, startSession } from '../auth.js';
import { HttpError, badRequest } from '../errors.js';

export const router = Router();

const limiter = (limit, keyGenerator) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    keyGenerator,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    handler: (_req, _res, next) => next(new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed sign-ins. Try again in a few minutes')),
  });
const failuresByIp = limiter(config.loginFailuresPerIp, (req) => `ip:${req.ip}`);
const failuresByAccount = limiter(config.loginFailuresPerAccount, (req) => `acct:${String(req.body?.employeeId ?? '').toLowerCase()}`);

// compared against when the employee ID is unknown, so response time does not reveal which IDs exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain a letter and a number');

router.post('/login', failuresByIp, failuresByAccount, async (req, res) => {
  const { employeeId, password } = z.object({ employeeId: z.string().trim().min(1), password: z.string().min(1) }).parse(req.body);
  const user = await db.one('SELECT * FROM users WHERE lower(employee_id) = lower($1)', [employeeId]);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    audit(req, 'auth.login_failed', 'user', user?.id ?? null, { employeeId });
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Employee ID or password is incorrect');
  }
  if (!user.is_active) {
    audit({ ...req, user }, 'auth.login_blocked', 'user', user.id);
    throw new HttpError(401, 'ACCOUNT_DEACTIVATED', 'Your access has been removed. Contact your administrator');
  }
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  startSession(res, user.id);
  req.user = user;
  audit(req, 'auth.login', 'user', user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  endSession(res);
  res.json({ ok: true });
});

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/change-password', authenticate, async (req, res) => {
  const body = z.object({ currentPassword: z.string().min(1), newPassword: passwordRule }).parse(req.body);
  if (!(await bcrypt.compare(body.currentPassword, req.user.password_hash))) {
    throw new HttpError(400, 'WRONG_PASSWORD', 'Current password is incorrect');
  }
  if (body.currentPassword === body.newPassword) throw badRequest('Choose a different password');
  await db.query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [await bcrypt.hash(body.newPassword, 10), req.user.id]);
  audit(req, 'auth.password_changed', 'user', req.user.id);
  res.json({ ok: true });
});
