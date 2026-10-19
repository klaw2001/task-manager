import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db.js';
import { authenticate, requireAdmin, requireFreshPassword, requireRoles } from '../auth.js';
import { progressRows, teamScope } from '../progress-query.js';
import { withStatus } from '../status.js';
import { notFound } from '../errors.js';

export const router = Router();
router.use(authenticate, requireFreshPassword, requireRoles('super_admin', 'training_admin', 'outlet_incharge', 'franchisee'));

const STATUSES = ['not_started', 'in_progress', 'ack_pending', 'completed', 'failed', 'retraining_required', 'overdue'];

const filters = z.object({
  brandId: z.coerce.number().int().optional(),
  outletId: z.coerce.number().int().optional(),
  role: z.enum(['team_member', 'outlet_incharge', 'franchisee']).optional(),
  moduleId: z.coerce.number().int().optional(),
  status: z.enum(STATUSES).optional(),
});

async function reportRows(req) {
  const f = filters.parse(req.query);
  const rows = (await progressRows({ ...f, scope: teamScope(req.user) })).map((r) => withStatus(r));
  const wanted = f.status;
  return wanted ? rows.filter((r) => (wanted === 'overdue' ? r.overdue : r.status === wanted)) : rows;
}

const OUT = [
  'user_id', 'user_name', 'employee_id', 'user_role', 'brand_id', 'brand_name', 'outlet_id', 'outlet_name', 'module_id', 'title', 'version', 'mandatory',
  'status', 'overdue', 'best_score', 'attempts_used', 'max_attempts', 'assigned_at', 'due_at', 'completed_at',
];

router.get('/progress', async (req, res) => {
  const rows = await reportRows(req);
  const count = (fn) => rows.filter(fn).length;
  res.json({
    summary: {
      total: rows.length,
      completed: count((r) => r.status === 'completed'),
      inProgress: count((r) => r.status === 'in_progress' || r.status === 'ack_pending'),
      notStarted: count((r) => r.status === 'not_started'),
      failed: count((r) => r.status === 'failed'),
      retrainingRequired: count((r) => r.status === 'retraining_required'),
      overdue: count((r) => r.overdue),
    },
    rows: rows.map((r) => Object.fromEntries(OUT.map((k) => [k, r[k]]))),
  });
});

const day = (d) => (d ? new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d)) : '');

// prefix cells that a spreadsheet would run as formulas
const cell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/progress.csv', async (req, res) => {
  const rows = await reportRows(req);
  const header = ['Employee ID', 'Name', 'Role', 'Brand', 'Outlet', 'Module', 'Version', 'Mandatory', 'Status', 'Overdue', 'Best score %', 'Attempts used', 'Max attempts', 'Assigned', 'Due', 'Completed'];
  const lines = rows.map((r) =>
    [r.employee_id, r.user_name, r.user_role, r.brand_name, r.outlet_name, r.title, r.version, r.mandatory ? 'Yes' : 'No', r.status, r.overdue ? 'Yes' : 'No',
      r.best_score, r.attempts_used, r.max_attempts === 0 ? 'Unlimited' : r.max_attempts, day(r.assigned_at), day(r.due_at), day(r.completed_at)].map(cell).join(','),
  );
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="training-report-${day(new Date())}.csv"`,
    'Cache-Control': 'no-store',
  });
  res.send(`﻿${[header.map(cell).join(','), ...lines].join('\r\n')}\r\n`); // BOM so Excel reads UTF-8 names correctly
});

/** Full training history of one employee, across every module version. */
router.get('/history/:userId', async (req, res) => {
  const params = [Number(req.params.userId)];
  const scope = teamScope(req.user);
  const extra = scope ? ` AND ${scope((v) => (params.push(v), `$${params.length}`))}` : '';
  const person = await db.one(
    `SELECT u.id, u.name, u.employee_id FROM users u LEFT JOIN outlets o ON o.id = u.outlet_id WHERE u.id = $1${extra}`,
    params,
  );
  if (!person) throw notFound('Employee not found'); // same answer whether or not they exist outside your scope
  const history = await db.all(
    `SELECT m.title, p.version, m.version AS current_version, p.lesson_completed_at, p.assessment_passed_at, p.acknowledged_at, p.completed_at, p.created_at,
            (SELECT count(*)::int FROM attempts t WHERE t.user_id = p.user_id AND t.module_id = p.module_id AND t.version = p.version) AS attempts,
            (SELECT max(score) FROM attempts t WHERE t.user_id = p.user_id AND t.module_id = p.module_id AND t.version = p.version) AS best_score
     FROM progress p JOIN modules m ON m.id = p.module_id
     WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
    [person.id],
  );
  res.json({ person, history });
});

export const auditRouter = Router();
auditRouter.use(authenticate, requireFreshPassword, requireAdmin);
auditRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  res.json(
    await db.all(
      `SELECT a.id, a.created_at, u.name AS actor, u.employee_id AS actor_employee_id, a.action, a.entity, a.entity_id, a.detail, a.ip
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT $1`,
      [limit],
    ),
  );
});
