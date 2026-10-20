import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { authenticate, learnerAccess, requireAdmin, requireFreshPassword } from '../auth.js';
import { listAttachments, recipeVisibility } from '../access.js';
import { VIDEO_ID, getVideo, requireBunny } from '../bunny.js';
import { isValidKey } from '../storage.js';
import { badRequest, notFound } from '../errors.js';
import { insertSql, updateSql } from '../sql.js';

const ROLES = ['team_member', 'outlet_incharge', 'franchisee'];
const imageKey = (prefix) => z.string().refine((k) => isValidKey(k) && k.startsWith(prefix), 'Invalid file').nullable().optional();
const text = z.string().max(5000).optional();

const fields = {
  name: z.string().trim().min(1).max(200),
  brandId: z.number().int().nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  roles: z.array(z.enum(ROLES)).min(1),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  videoId: z.string().regex(VIDEO_ID, 'Invalid video').nullable().optional(),
  imageKey: imageKey('images/'),
  portionSize: z.string().max(200).optional(),
  yield: z.string().max(200).optional(),
  equipment: text,
  ingredients: z.array(z.object({ name: z.string().trim().min(1).max(120), quantity: z.string().trim().max(40), unit: z.string().trim().max(40).default('') })).max(80).optional(),
  steps: z.array(z.string().trim().min(1).max(1000)).max(60).optional(),
  cookingInstructions: text,
  storage: text,
  shelfLife: z.string().max(200).optional(),
  foodSafety: text,
  commonMistakes: text,
  qualityCheckpoints: text,
};
const JSON_FIELDS = ['ingredients', 'steps'];

/* ---------- admin ---------- */
export const adminRouter = Router();
adminRouter.use(authenticate, requireFreshPassword, requireAdmin);

adminRouter.get('/', async (_req, res) => {
  res.json(
    await db.all(
      `SELECT r.id, r.name, r.category, r.status, r.roles, r.brand_id, b.name AS brand_name, r.updated_at
       FROM recipes r LEFT JOIN brands b ON b.id = r.brand_id ORDER BY (r.status = 'archived'), r.name`,
    ),
  );
});

/** A video must exist on Bunny, and be fully converted before a recipe is published with it. */
async function checkVideo(videoId, { mustBeReady }) {
  if (!videoId) return;
  requireBunny();
  const v = await getVideo(videoId);
  if (!v) throw badRequest('That video was not found in the video library');
  if (mustBeReady && !v.ready) throw badRequest(`The video is still being processed (${v.state}${v.progress ? ` ${v.progress}%` : ''}). Try again in a few minutes.`, 'VIDEO_NOT_READY');
}

async function checkAttachmentVideos(recipeId) {
  for (const a of await db.all(`SELECT title, video_id FROM attachments WHERE recipe_id = $1 AND kind = 'video'`, [recipeId])) {
    const v = await getVideo(a.video_id);
    if (!v?.ready) throw badRequest(`The attached video “${a.title}” is not ready yet`, 'VIDEO_NOT_READY');
  }
}

adminRouter.post('/', async (req, res) => {
  const body = z.object(fields).parse(req.body);
  await checkVideo(body.videoId, { mustBeReady: body.status === 'published' });
  const { text: sql, params } = insertSql('recipes', { ...body, updatedBy: req.user.id }, JSON_FIELDS);
  const recipe = await db.one(sql, params).catch((err) => {
    if (err.code === '23503') throw badRequest('Unknown brand');
    throw err;
  });
  audit(req, 'recipe.create', 'recipe', recipe.id, { name: recipe.name });
  res.status(201).json(recipe);
});

adminRouter.get('/:id', async (req, res) => {
  const recipe = await db.one('SELECT * FROM recipes WHERE id = $1', [Number(req.params.id)]);
  if (!recipe) throw notFound('Recipe not found');
  const attachments = await db.all('SELECT id, kind, title, content_type, size_bytes, video_id FROM attachments WHERE recipe_id = $1 ORDER BY position, id', [recipe.id]);
  res.json({ ...recipe, attachments });
});

adminRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const body = z.object(fields).partial().parse(req.body);
  const existing = await db.one('SELECT video_id, status FROM recipes WHERE id = $1', [id]);
  if (!existing) throw notFound('Recipe not found');
  const videoId = body.videoId === undefined ? existing.video_id : body.videoId;
  const publishing = (body.status ?? existing.status) === 'published';
  await checkVideo(videoId, { mustBeReady: publishing });
  if (publishing) await checkAttachmentVideos(id);
  const stmt = updateSql('recipes', id, { ...body, updatedBy: req.user.id }, { json: JSON_FIELDS });
  const recipe = await db.one(stmt.text, stmt.params).catch((err) => {
    if (err.code === '23503') throw badRequest('Unknown brand');
    throw err;
  });
  if (!recipe) throw notFound('Recipe not found');
  audit(req, body.status ? `recipe.${body.status}` : 'recipe.update', 'recipe', id, { fields: Object.keys(body) });
  res.json(recipe);
});

/* ---------- learners ---------- */
export const router = Router();
router.use(...learnerAccess);

router.get('/', async (req, res) => {
  const q = z.object({ q: z.string().trim().max(100).optional(), category: z.string().trim().max(60).optional() }).parse(req.query);
  const params = [];
  const p = (v) => (params.push(v), `$${params.length}`);
  const where = [recipeVisibility(req.user, p)];
  if (q.category) where.push(`r.category = ${p(q.category)}`);
  if (q.q) {
    const like = p(`%${q.q}%`);
    where.push(`(r.name ILIKE ${like} OR r.category ILIKE ${like} OR r.ingredients::text ILIKE ${like})`);
  }
  res.json(
    await db.all(
      `SELECT r.id, r.name, r.category, r.yield, r.portion_size, b.name AS brand_name, (r.image_key IS NOT NULL) AS has_image
       FROM recipes r LEFT JOIN brands b ON b.id = r.brand_id WHERE ${where.join(' AND ')} ORDER BY r.name LIMIT 500`,
      params,
    ),
  );
});

router.get('/:id', async (req, res) => {
  const params = [Number(req.params.id)];
  const p = (v) => (params.push(v), `$${params.length}`);
  const recipe = await db.one(
    `SELECT r.id, r.name, r.category, r.portion_size, r.yield, r.equipment, r.ingredients, r.steps, r.cooking_instructions,
            r.storage, r.shelf_life, r.food_safety, r.common_mistakes, r.quality_checkpoints, b.name AS brand_name,
            (r.video_id IS NOT NULL) AS has_video, (r.image_key IS NOT NULL) AS has_image, r.updated_at
     FROM recipes r LEFT JOIN brands b ON b.id = r.brand_id WHERE r.id = $1 AND ${recipeVisibility(req.user, p)}`,
    params,
  );
  if (!recipe) throw notFound('Recipe not found');
  res.json({ ...recipe, attachments: await listAttachments('recipe', recipe.id) });
});
