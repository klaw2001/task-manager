import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { authenticate, requireAdmin, requireFreshPassword, requireRoles } from '../auth.js';
import { badRequest, notFound } from '../errors.js';

export const router = Router();
router.use(authenticate, requireFreshPassword, requireAdmin);

router.get('/brands', async (_req, res) => {
  res.json(await db.all('SELECT id, name FROM brands ORDER BY name'));
});

router.post('/brands', requireRoles('super_admin'), async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
  const brand = await db.one('INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id, name', [name]);
  if (!brand) throw badRequest('A brand with this name already exists');
  audit(req, 'brand.create', 'brand', brand.id, { name });
  res.status(201).json(brand);
});

router.get('/outlets', async (_req, res) => {
  res.json(
    await db.all(
      `SELECT o.id, o.name, o.brand_id, b.name AS brand_name, o.franchisee_id, f.name AS franchisee_name
       FROM outlets o JOIN brands b ON b.id = o.brand_id LEFT JOIN users f ON f.id = o.franchisee_id
       ORDER BY b.name, o.name`,
    ),
  );
});

const outletBody = z.object({
  name: z.string().trim().min(1).max(120),
  brandId: z.number().int(),
  franchiseeId: z.number().int().nullable().optional(),
});

router.post('/outlets', requireRoles('super_admin'), async (req, res) => {
  const body = outletBody.parse(req.body);
  const outlet = await db
    .one('INSERT INTO outlets (name, brand_id, franchisee_id) VALUES ($1,$2,$3) RETURNING id', [body.name, body.brandId, body.franchiseeId ?? null])
    .catch((err) => {
      if (err.code === '23505') throw badRequest('This brand already has an outlet with that name');
      if (err.code === '23503') throw badRequest('Unknown brand or franchisee');
      throw err;
    });
  audit(req, 'outlet.create', 'outlet', outlet.id, body);
  res.status(201).json(outlet);
});

router.patch('/outlets/:id', requireRoles('super_admin'), async (req, res) => {
  const body = outletBody.pick({ name: true, franchiseeId: true }).partial().parse(req.body);
  const outlet = await db.one(
    `UPDATE outlets SET name = COALESCE($1, name),
       franchisee_id = CASE WHEN $2::boolean THEN $3::int ELSE franchisee_id END
     WHERE id = $4 RETURNING id`,
    [body.name ?? null, 'franchiseeId' in body, body.franchiseeId ?? null, Number(req.params.id)],
  ).catch((err) => {
    if (err.code === '23503') throw badRequest('Unknown franchisee');
    throw err;
  });
  if (!outlet) throw notFound('Outlet not found');
  audit(req, 'outlet.update', 'outlet', outlet.id, body);
  res.json(outlet);
});
