import { db } from './db.js';

/** Fire-and-forget audit entry; never lets an audit failure break the request. */
export function audit(req, action, entity = null, entityId = null, detail = null) {
  db.query(
    'INSERT INTO audit_log (actor_id, action, entity, entity_id, detail, ip) VALUES ($1,$2,$3,$4,$5,$6)',
    [req.user?.id ?? null, action, entity, entityId == null ? null : String(entityId), detail ? JSON.stringify(detail) : null, req.ip],
  ).catch((err) => console.error('audit failed', err.message));
}
