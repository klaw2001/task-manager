/**
 * Assigns published modules to users, skipping users who are inactive or not eligible
 * (module role/brand restrictions). Returns the number of new assignments.
 */
export async function assignModules(q, { moduleIds, userIds, assignedBy, dueDays = null }) {
  const { rowCount } = await q(
    `INSERT INTO assignments (user_id, module_id, assigned_by, due_at)
     SELECT u.id, m.id, $3, now() + (COALESCE($4::int, m.default_due_days) * interval '1 day')
     FROM users u CROSS JOIN modules m
     WHERE u.id = ANY($1::int[]) AND m.id = ANY($2::int[])
       AND u.is_active AND m.status = 'published'
       AND (m.brand_id IS NULL OR m.brand_id = u.brand_id)
       AND u.role = ANY(m.roles)
     ON CONFLICT (user_id, module_id) DO NOTHING`,
    [userIds, moduleIds, assignedBy, dueDays],
  );
  return rowCount;
}

/** The user's "training path": every published module their role/brand is eligible for. */
export async function assignTrainingPath(q, userId, assignedBy, dueDays = null) {
  const { rows } = await q(`SELECT id FROM modules WHERE status = 'published'`);
  if (!rows.length) return 0;
  return assignModules(q, { moduleIds: rows.map((r) => r.id), userIds: [userId], assignedBy, dueDays });
}
