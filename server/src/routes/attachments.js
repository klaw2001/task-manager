import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { authenticate, requireAdmin, requireFreshPassword } from '../auth.js';
import { VIDEO_ID, getVideo, requireBunny } from '../bunny.js';
import { EXT_TYPES, isValidKey, storage } from '../storage.js';
import { badRequest, notFound } from '../errors.js';

export const router = Router();
router.use(authenticate, requireFreshPassword, requireAdmin);

const body = z
  .object({
    moduleId: z.number().int().optional(),
    recipeId: z.number().int().optional(),
    kind: z.enum(['pdf', 'image', 'video']),
    title: z.string().trim().min(1).max(200),
    fileKey: z.string().max(300).optional(),
    videoId: z.string().optional(),
    sizeBytes: z.number().int().min(0).optional(),
  })
  .superRefine((a, ctx) => {
    if (Boolean(a.moduleId) === Boolean(a.recipeId)) ctx.addIssue({ code: 'custom', message: 'Attach to exactly one module or recipe' });
    if (a.kind === 'video') {
      if (!a.videoId || !VIDEO_ID.test(a.videoId)) ctx.addIssue({ code: 'custom', message: 'A video attachment needs an uploaded video' });
    } else if (!a.fileKey || !isValidKey(a.fileKey) || !a.fileKey.startsWith(`${a.kind}s/`)) {
      ctx.addIssue({ code: 'custom', message: `A ${a.kind} attachment needs an uploaded ${a.kind} file` });
    }
  });

const PUBLIC = 'id, kind, title, content_type, size_bytes, video_id, position, created_at';

router.post('/', async (req, res) => {
  const a = body.parse(req.body);
  const owner = a.moduleId
    ? await db.one('SELECT id FROM modules WHERE id = $1', [a.moduleId])
    : await db.one('SELECT id FROM recipes WHERE id = $1', [a.recipeId]);
  if (!owner) throw notFound(a.moduleId ? 'Module not found' : 'Recipe not found');
  if (a.kind === 'video') {
    requireBunny();
    if (!(await getVideo(a.videoId))) throw badRequest('That video was not found in the video library');
  }
  let sizeBytes = a.sizeBytes ?? null;
  if (a.kind !== 'video') {
    const stored = await storage.head(a.fileKey);
    if (!stored) throw badRequest('That file has not been uploaded yet');
    sizeBytes = stored.size;
  }
  const ownerColumn = a.moduleId ? 'module_id' : 'recipe_id';
  const row = await db.one(
    `INSERT INTO attachments (${ownerColumn}, kind, title, file_key, video_id, content_type, size_bytes, position, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,
             (SELECT COALESCE(max(position) + 1, 0) FROM attachments WHERE ${ownerColumn} = $1), $8)
     RETURNING ${PUBLIC}`,
    [
      a.moduleId ?? a.recipeId, a.kind, a.title, a.fileKey ?? null, a.videoId ?? null,
      a.kind === 'pdf' ? 'application/pdf' : a.kind === 'image' ? EXT_TYPES[`.${a.fileKey.split('.').pop().toLowerCase()}`] ?? null : null,
      sizeBytes, req.user.id,
    ],
  );
  audit(req, 'attachment.add', a.moduleId ? 'module' : 'recipe', a.moduleId ?? a.recipeId, { kind: a.kind, title: a.title });
  res.status(201).json(row);
});

router.patch('/:id', async (req, res) => {
  const { title } = z.object({ title: z.string().trim().min(1).max(200) }).parse(req.body);
  const row = await db.one(`UPDATE attachments SET title = $1 WHERE id = $2 RETURNING ${PUBLIC}`, [title, Number(req.params.id)]);
  if (!row) throw notFound('Attachment not found');
  audit(req, 'attachment.rename', 'attachment', row.id, { title });
  res.json(row);
});

/** Removes the attachment from the content. The stored file / video is kept, so earlier module versions that used it still work. */
router.delete('/:id', async (req, res) => {
  const row = await db.one('DELETE FROM attachments WHERE id = $1 RETURNING id, kind, title, module_id, recipe_id', [Number(req.params.id)]);
  if (!row) throw notFound('Attachment not found');
  audit(req, 'attachment.remove', row.module_id ? 'module' : 'recipe', row.module_id ?? row.recipe_id, { kind: row.kind, title: row.title });
  res.json({ ok: true });
});
