import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { audit } from '../audit.js';
import { authenticate, requireAdmin, requireFreshPassword } from '../auth.js';
import { UPLOAD_KINDS, isValidKey, newKey, storage } from '../storage.js';
import { badRequest, notFound } from '../errors.js';

export const router = Router();
router.use(authenticate, requireFreshPassword, requireAdmin);

/** Images and PDFs: ask for an upload slot, then the browser PUTs the file to the returned URL (S3 directly, or this server in local mode). Videos go to Bunny - see videos.js. */
router.post('/', async (req, res) => {
  const body = z.object({ kind: z.enum(UPLOAD_KINDS), filename: z.string().min(1).max(200), contentType: z.string().min(3).max(100) }).parse(req.body);
  const key = newKey(body.kind, body.filename, body.contentType);
  const upload = await storage.createUpload(key, body.contentType);
  audit(req, 'upload.create', 'media', key);
  res.json({ key, ...upload });
});

// Local-disk driver only (development / single server). With S3 the browser uploads straight to the bucket.
router.put('/local/*key', async (req, res) => {
  if (!storage.save) throw notFound();
  const key = [].concat(req.params.key).join('/');
  const type = req.headers['content-type'] || '';
  if (!isValidKey(key) || !type.startsWith(key.startsWith('pdfs/') ? 'application/pdf' : 'image/')) throw badRequest('Invalid upload');
  await storage.save(key, req, config.storage.maxUploadMb * 1024 * 1024);
  res.json({ ok: true, key });
});
