import { db } from './db.js';
import { forbidden } from './errors.js';

/**
 * Scope for team views: admins see everyone, in-charges see their outlet,
 * franchisees see outlets they own. Returns null (no restriction) or a function(p) -> SQL fragment.
 */
export function teamScope(user) {
  switch (user.role) {
    case 'super_admin':
    case 'training_admin':
      return null;
    case 'outlet_incharge':
      return (p) => (user.outlet_id ? `u.outlet_id = ${p(user.outlet_id)}` : 'FALSE');
    case 'franchisee':
      return (p) => `o.franchisee_id = ${p(user.id)}`;
    default:
      throw forbidden();
  }
}

/**
 * One row per (assigned user, module) for the module's CURRENT version, with progress
 * and attempt counts. Only active users and modules they are still eligible for are included.
 */
export async function progressRows(f = {}) {
  const params = [];
  const p = (v) => (params.push(v), `$${params.length}`);
  const where = [
    `m.status = 'published'`,
    'u.is_active',
    '(m.brand_id IS NULL OR m.brand_id = u.brand_id)',
    'u.role = ANY(m.roles)',
  ];
  if (f.userId) where.push(`u.id = ${p(f.userId)}`);
  if (f.moduleId) where.push(`m.id = ${p(f.moduleId)}`);
  if (f.brandId) where.push(`u.brand_id = ${p(f.brandId)}`);
  if (f.outletId) where.push(`u.outlet_id = ${p(f.outletId)}`);
  if (f.role) where.push(`u.role = ${p(f.role)}`);
  if (f.scope) where.push(f.scope(p));

  return db.all(
    `SELECT u.id AS user_id, u.name AS user_name, u.employee_id, u.role AS user_role,
            u.brand_id, b.name AS brand_name, u.outlet_id, o.name AS outlet_name,
            m.id AS module_id, m.title, m.description, m.category, m.language, m.mandatory, m.sequence, m.version,
            m.requires_ack, m.ack_text, m.pass_mark, m.max_attempts, m.min_watch_percent, m.duration_seconds,
            m.instructions, m.randomize, (m.video_key IS NOT NULL) AS has_video,
            m.prerequisite_id, pm.title AS prerequisite_title,
            (m.prerequisite_id IS NULL OR EXISTS (
               SELECT 1 FROM progress pp
               WHERE pp.user_id = u.id AND pp.module_id = m.prerequisite_id AND pp.version = pm.version AND pp.completed_at IS NOT NULL
            )) AS prereq_done,
            a.assigned_at, a.due_at,
            p.id AS progress_id, p.last_position, p.watched_seconds, p.lesson_completed_at,
            p.assessment_passed_at, p.acknowledged_at, p.completed_at,
            COALESCE((SELECT count(*)::int FROM attempts t
               WHERE t.user_id = u.id AND t.module_id = m.id AND t.version = m.version
                 AND (p.attempts_reset_at IS NULL OR t.created_at > p.attempts_reset_at)), 0) AS attempts_used,
            (SELECT count(*)::int FROM attempts t WHERE t.user_id = u.id AND t.module_id = m.id AND t.version = m.version) AS attempts_total,
            (SELECT max(score) FROM attempts t WHERE t.user_id = u.id AND t.module_id = m.id AND t.version = m.version) AS best_score,
            EXISTS (SELECT 1 FROM progress h
               WHERE h.user_id = u.id AND h.module_id = m.id AND h.version < m.version AND h.completed_at IS NOT NULL) AS had_previous_completion
     FROM assignments a
     JOIN users u ON u.id = a.user_id
     JOIN modules m ON m.id = a.module_id
     LEFT JOIN modules pm ON pm.id = m.prerequisite_id
     LEFT JOIN brands b ON b.id = u.brand_id
     LEFT JOIN outlets o ON o.id = u.outlet_id
     LEFT JOIN progress p ON p.user_id = u.id AND p.module_id = m.id AND p.version = m.version
     WHERE ${where.join(' AND ')}
     ORDER BY u.name, m.sequence, m.id
     LIMIT 10000`,
    params,
  );
}
