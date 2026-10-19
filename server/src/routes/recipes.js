import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { authenticate, learnerAccess, requireAdmin, requireFreshPassword } from '../auth.js';
import { ADMIN_ROLES } from '../shift.js';
import { isValidKey } from '../storage.js';
import { badRequest, notFound } from '../errors.js';
import { insertSql, updateSql } from '../sql.js';

const ROLES = ['team_member', 'outlet_incharge', 'franchisee'];
const key = (prefix) => z.string().refine((k) => isValidKey(k) && k.startsWith(prefix), 'Invalid file').nullable().optional();
const text = z.string().max(5000).optional();

const fields = {
  name: z.string().trim().min(1).max(200),
  brandId: z.number().int().nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  roles: z.array(z.enum(ROLES)).min(1),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  videoKey: key('videos/'),
  imageKey: key('images/'),
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

adminRouter.post('/', async (req, res) => {
  const body = z.object(fields).parse(req.body);
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
  res.json(recipe);
});

adminRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const body = z.object(fields).partial().parse(req.body);
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

/** Brand + role restriction. Admin roles can open every published recipe. */
export function recipeVisibility(user, p) {
  if (ADMIN_ROLES.includes(user.role)) return `r.status = 'published'`;
  return `r.status = 'published' AND (r.brand_id IS NULL OR r.brand_id = ${p(user.brand_id)}) AND ${p(user.role)} = ANY(r.roles)`;
}

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
            (r.video_key IS NOT NULL) AS has_video, (r.image_key IS NOT NULL) AS has_image, r.updated_at
     FROM recipes r LEFT JOIN brands b ON b.id = r.brand_id WHERE r.id = $1 AND ${recipeVisibility(req.user, p)}`,
    params,
  );
  if (!recipe) throw notFound('Recipe not found');
  res.json(recipe);
});
