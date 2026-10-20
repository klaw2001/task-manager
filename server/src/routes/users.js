import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { authenticate, requireFreshPassword, requireRoles } from '../auth.js';
import { assignTrainingPath } from '../assign.js';
import { inviteEmail, passwordResetEmail } from '../emails.js';
import { deliver } from '../notify.js';
import { badRequest, notFound } from '../errors.js';
import { insertSql, updateSql } from '../sql.js';

export const router = Router();
router.use(authenticate, requireFreshPassword, requireRoles('super_admin'));

const ROLES = ['super_admin', 'training_admin', 'outlet_incharge', 'team_member', 'franchisee'];
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)').nullable().optional();
const id = z.number().int().nullable().optional();

const fields = {
  employeeId: z.string().trim().min(2).max(40),
  name: z.string().trim().min(1).max(120),
  mobile: z.string().trim().max(20).nullable().optional(),
  email: z.email().max(200).nullable().optional(),
  role: z.enum(ROLES),
  brandId: id,
  outletId: id,
  designation: z.string().trim().max(80).nullable().optional(),
  managerId: id,
  joiningDate: z.iso.date().nullable().optional(),
  language: z.string().trim().min(2).max(10).optional(),
  shiftStart: time,
  shiftEnd: time,
};
const createBody = z.object(fields).extend({ dueDays: z.number().int().min(1).max(365).optional(), sendInvite: z.boolean().optional() });
const patchBody = z.object(fields).partial();

const tempPassword = () => `${randomBytes(5).toString('base64url')}${Math.floor(10 + Math.random() * 90)}`;

const LIST_SQL = `
  SELECT u.id, u.employee_id, u.name, u.mobile, u.email, u.role, u.brand_id, b.name AS brand_name, u.outlet_id, o.name AS outlet_name,
         u.designation, u.manager_id, m.name AS manager_name, u.joining_date, u.language, u.shift_start, u.shift_end,
         u.is_active, u.deactivated_at, u.last_login_at, u.must_change_password
  FROM users u
  LEFT JOIN brands b ON b.id = u.brand_id
  LEFT JOIN outlets o ON o.id = u.outlet_id
  LEFT JOIN users m ON m.id = u.manager_id`;

/** An outlet fixes the brand; shifts need both ends. */
async function normalise(data, existing = {}) {
  const merged = { ...existing, ...data };
  if (data.outletId) {
    const outlet = await db.one('SELECT brand_id FROM outlets WHERE id = $1', [data.outletId]);
    if (!outlet) throw badRequest('Unknown outlet');
    data.brandId = outlet.brand_id;
  }
  if (Boolean(merged.shiftStart) !== Boolean(merged.shiftEnd)) throw badRequest('Set both shift start and shift end, or neither');
  if (['team_member', 'outlet_incharge'].includes(merged.role) && !(data.brandId ?? merged.brandId)) {
    throw badRequest('Team members and in-charges need an outlet (or brand)');
  }
  return data;
}

router.get('/', async (req, res) => {
  const q = z
    .object({
      search: z.string().optional(),
      role: z.enum(ROLES).optional(),
      outletId: z.coerce.number().int().optional(),
      active: z.enum(['true', 'false']).optional(),
    })
    .parse(req.query);
  const params = [];
  const where = [];
  if (q.search) { params.push(`%${q.search}%`); where.push(`(u.name ILIKE $${params.length} OR u.employee_id ILIKE $${params.length})`); }
  if (q.role) { params.push(q.role); where.push(`u.role = $${params.length}`); }
  if (q.outletId) { params.push(q.outletId); where.push(`u.outlet_id = $${params.length}`); }
  if (q.active) { params.push(q.active === 'true'); where.push(`u.is_active = $${params.length}`); }
  res.json(await db.all(`${LIST_SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY u.is_active DESC, u.name LIMIT 2000`, params));
});

router.post('/', async (req, res) => {
  const { dueDays, sendInvite, ...body } = createBody.parse(req.body);
  await normalise(body);
  const password = tempPassword();
  const { text, params } = insertSql('users', { ...body, passwordHash: await bcrypt.hash(password, 10) });
  const user = await db.one(text, params).catch((err) => {
    if (err.code === '23505') throw badRequest('That employee ID is already in use');
    if (err.code === '23503') throw badRequest('Unknown brand, outlet or manager');
    throw err;
  });
  const assigned = await assignTrainingPath(db.query, user.id, req.user.id, dueDays ?? null);
  audit(req, 'user.create', 'user', user.id, { employeeId: user.employee_id, role: user.role, assigned });
  const mail = sendInvite && user.email
    ? await deliver({ userId: user.id, to: user.email, kind: 'invite', ...inviteEmail({ name: user.name, employeeId: user.employee_id, password }) })
    : null;
  res.status(201).json({ user: await db.one(`${LIST_SQL} WHERE u.id = $1`, [user.id]), temporaryPassword: password, assigned, emailed: mail?.sent ?? null, emailError: mail?.error ?? null });
});

router.patch('/:id', async (req, res) => {
  const userId = Number(req.params.id);
  const existing = await db.one('SELECT * FROM users WHERE id = $1', [userId]);
  if (!existing) throw notFound('User not found');
  const body = patchBody.parse(req.body);
  await normalise(body, { role: existing.role, brandId: existing.brand_id, shiftStart: existing.shift_start, shiftEnd: existing.shift_end });
  const stmt = updateSql('users', userId, body, { touch: false });
  if (!stmt) throw badRequest('Nothing to update');
  await db.query(stmt.text, stmt.params).catch((err) => {
    if (err.code === '23505') throw badRequest('That employee ID is already in use');
    if (err.code === '23503') throw badRequest('Unknown brand, outlet or manager');
    throw err;
  });
  const transferred = body.outletId !== undefined && body.outletId !== existing.outlet_id;
  if (transferred || (body.role && body.role !== existing.role)) await assignTrainingPath(db.query, userId, req.user.id);
  audit(req, transferred ? 'user.transfer' : 'user.update', 'user', userId, { changes: body, from: { outletId: existing.outlet_id, role: existing.role } });
  res.json(await db.one(`${LIST_SQL} WHERE u.id = $1`, [userId]));
});

router.post('/:id/deactivate', async (req, res) => {
  const userId = Number(req.params.id);
  if (userId === req.user.id) throw badRequest('You cannot deactivate your own account');
  const target = await db.one('SELECT role FROM users WHERE id = $1', [userId]);
  if (!target) throw notFound('User not found');
  await db.query('UPDATE users SET is_active = false, deactivated_at = now() WHERE id = $1', [userId]);
  audit(req, 'user.deactivate', 'user', userId);
  res.json({ ok: true });
});

router.post('/:id/reactivate', async (req, res) => {
  const userId = Number(req.params.id);
  const done = await db.one('UPDATE users SET is_active = true, deactivated_at = NULL WHERE id = $1 RETURNING id', [userId]);
  if (!done) throw notFound('User not found');
  audit(req, 'user.reactivate', 'user', userId);
  res.json({ ok: true });
});

router.post('/:id/reset-password', async (req, res) => {
  const userId = Number(req.params.id);
  const { sendEmail } = z.object({ sendEmail: z.boolean().optional() }).parse(req.body ?? {});
  const password = tempPassword();
  const user = await db.one('UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2 RETURNING id, name, email, employee_id', [await bcrypt.hash(password, 10), userId]);
  if (!user) throw notFound('User not found');
  audit(req, 'user.reset_password', 'user', userId);
  const mail = sendEmail && user.email
    ? await deliver({ userId, to: user.email, kind: 'password_reset', ...passwordResetEmail({ name: user.name, employeeId: user.employee_id, password }) })
    : null;
  res.json({ temporaryPassword: password, emailed: mail?.sent ?? null, emailError: mail?.error ?? null });
});
