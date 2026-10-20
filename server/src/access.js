import { db } from './db.js';
import { ADMIN_ROLES } from './shift.js';

/**
 * Who may see what. Admin roles see everything; everyone else only content that is published and
 * matches their brand and role (and, for training modules, is assigned to them and unlocked).
 */
export const isAdmin = (user) => ADMIN_ROLES.includes(user.role);

/** Training module the user may open right now, or null. */
export async function moduleVisibleTo(user, moduleId) {
  if (isAdmin(user)) return db.one('SELECT id, video_id FROM modules WHERE id = $1', [moduleId]);
  return db.one(
    `SELECT m.id, m.video_id
     FROM assignments a
     JOIN modules m ON m.id = a.module_id
     LEFT JOIN modules pm ON pm.id = m.prerequisite_id
     WHERE a.user_id = $1 AND m.id = $2 AND m.status = 'published'
       AND (m.brand_id IS NULL OR m.brand_id = $3) AND $4 = ANY(m.roles)
       AND (m.prerequisite_id IS NULL OR EXISTS (
             SELECT 1 FROM progress pp WHERE pp.user_id = $1 AND pp.module_id = pm.id AND pp.version = pm.version AND pp.completed_at IS NOT NULL))`,
    [user.id, moduleId, user.brand_id, user.role],
  );
}

/** SQL fragment (alias r) limiting recipes to what the user may see. `p` binds a parameter and returns its $n. */
export function recipeVisibility(user, p) {
  if (isAdmin(user)) return `r.status = 'published'`;
  return `r.status = 'published' AND (r.brand_id IS NULL OR r.brand_id = ${p(user.brand_id)}) AND ${p(user.role)} = ANY(r.roles)`;
}

export async function recipeVisibleTo(user, recipeId) {
  const params = [recipeId];
  const p = (v) => (params.push(v), `$${params.length}`);
  return db.one(`SELECT r.id, r.video_id, r.image_key FROM recipes r WHERE r.id = $1 AND ${recipeVisibility(user, p)}`, params);
}

/** An attachment, if the user may see the module/recipe it belongs to. */
export async function attachmentVisibleTo(user, attachmentId) {
  const a = await db.one('SELECT * FROM attachments WHERE id = $1', [attachmentId]);
  if (!a) return null;
  const owner = a.module_id ? await moduleVisibleTo(user, a.module_id) : await recipeVisibleTo(user, a.recipe_id);
  return owner ? a : null;
}

/** Attachment list for learner views: never includes storage keys or Bunny IDs. */
export function listAttachments(ownerColumn, ownerId) {
  return db.all(
    `SELECT id, kind, title, content_type, size_bytes FROM attachments WHERE ${ownerColumn === 'module' ? 'module_id' : 'recipe_id'} = $1 ORDER BY position, id`,
    [ownerId],
  );
}
