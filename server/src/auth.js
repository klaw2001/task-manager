import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';
import { ADMIN_ROLES, shiftInfo } from './shift.js';
import { HttpError, forbidden } from './errors.js';

export const COOKIE = 'lms_session';

export function startSession(res, userId) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: `${config.sessionHours}h` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    maxAge: config.sessionHours * 3600 * 1000,
    path: '/',
  });
}

export const endSession = (res) => res.clearCookie(COOKIE, { path: '/' });

export function publicUser(u) {
  const { password_hash, ...rest } = u;
  return { ...rest, isAdmin: ADMIN_ROLES.includes(u.role), shift: shiftInfo(u) };
}

const USER_SQL = `
  SELECT u.*, b.name AS brand_name, o.name AS outlet_name
  FROM users u
  LEFT JOIN brands b ON b.id = u.brand_id
  LEFT JOIN outlets o ON o.id = u.outlet_id
  WHERE u.id = $1`;

/**
 * Loads the user on EVERY request, so deactivating an account (or ending a shift)
 * takes effect immediately, including for a video that is already playing.
 */
export async function authenticate(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'SESSION_EXPIRED', 'Your session has expired. Please sign in again');
  }
  const user = await db.one(USER_SQL, [payload.sub]);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in');
  if (!user.is_active) throw new HttpError(401, 'ACCOUNT_DEACTIVATED', 'Your access has been removed. Contact your administrator');
  req.user = user;
  next();
}

export function requireFreshPassword(req, _res, next) {
  if (req.user.must_change_password) {
    throw forbidden('Please set a new password to continue', 'PASSWORD_CHANGE_REQUIRED');
  }
  next();
}

export const requireRoles = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw forbidden();
  next();
};

export const requireAdmin = requireRoles(...ADMIN_ROLES);

/** Blocks learner content outside the user's shift window. */
export function requireShift(req, _res, next) {
  const shift = shiftInfo(req.user);
  if (!shift.open) {
    throw forbidden(`Training content is available during your shift (${shift.start}–${shift.end})`, 'OUTSIDE_SHIFT', { shift });
  }
  next();
}

export const learnerAccess = [authenticate, requireFreshPassword, requireShift];
