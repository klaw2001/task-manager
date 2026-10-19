import { Router } from 'express';
import { pipeline } from 'node:stream';
import { config } from '../config.js';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { learnerAccess } from '../auth.js';
import { ADMIN_ROLES } from '../shift.js';
import { storage } from '../storage.js';
import { notFound } from '../errors.js';
import { recipeVisibility } from './recipes.js';

export const router = Router();
router.use(...learnerAccess); // sign-in, password set, inside shift - re-checked on every request

async function mediaKey(user, type, id, field) {
  const isAdmin = ADMIN_ROLES.includes(user.role);
  if (type === 'modules' && field === 'video') {
    if (isAdmin) return (await db.one('SELECT video_key AS key FROM modules WHERE id = $1', [id]))?.key;
    return (
      await db.one(
        `SELECT m.video_key AS key
         FROM assignments a
         JOIN modules m ON m.id = a.module_id
         LEFT JOIN modules pm ON pm.id = m.prerequisite_id
         WHERE a.user_id = $1 AND m.id = $2 AND m.status = 'published'
           AND (m.brand_id IS NULL OR m.brand_id = $3) AND $4 = ANY(m.roles)
           AND (m.prerequisite_id IS NULL OR EXISTS (
                 SELECT 1 FROM progress pp WHERE pp.user_id = $1 AND pp.module_id = pm.id AND pp.version = pm.version AND pp.completed_at IS NOT NULL))`,
        [user.id, id, user.brand_id, user.role],
      )
    )?.key;
  }
  if (type === 'recipes' && (field === 'video' || field === 'image')) {
    const params = [id];
    const p = (v) => (params.push(v), `$${params.length}`);
    const column = field === 'video' ? 'video_key' : 'image_key';
    return (await db.one(`SELECT r.${column} AS key FROM recipes r WHERE r.id = $1 AND ${recipeVisibility(user, p)}`, params))?.key;
  }
  return null;
}

/** Single byte range: "bytes=a-b", "bytes=a-", "bytes=-n". Returns null if absent, 'invalid' if unsatisfiable. */
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start;
  let end;
  if (m[1] === '') {
    start = Math.max(size - Number(m[2]), 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start >= size || start > end ? 'invalid' : { start, end };
}

router.get('/:type/:id/:field', async (req, res) => {
  const { type, field } = req.params;
  const key = await mediaKey(req.user, type, Number(req.params.id), field);
  if (!key) throw notFound();
  const head = await storage.head(key);
  if (!head) throw notFound();

  const isVideo = field === 'video';
  let range = parseRange(req.headers.range, head.size);
  if (range === 'invalid') {
    return res.status(416).set('Content-Range', `bytes */${head.size}`).end();
  }
  // Videos are always served in short ranges, so removing access (or the shift ending) stops playback within seconds.
  if (isVideo) {
    range = range ?? { start: 0, end: head.size - 1 };
    range.end = Math.min(range.end, range.start + config.mediaChunkBytes - 1);
  }

  res.set({
    'Content-Type': head.contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  });
  const start = range?.start ?? 0;
  const end = range?.end ?? head.size - 1;
  res.status(range ? 206 : 200);
  if (range) res.set('Content-Range', `bytes ${start}-${end}/${head.size}`);
  res.set('Content-Length', String(end - start + 1));

  if (isVideo && start === 0) audit(req, 'media.play', type, req.params.id);
  const stream = await storage.read(key, start, end);
  pipeline(stream, res, () => {}); // client disconnects are normal while seeking
});
