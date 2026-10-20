import { Router } from 'express';
import { pipeline } from 'node:stream';
import { z } from 'zod';
import { audit } from '../audit.js';
import { learnerAccess } from '../auth.js';
import { attachmentVisibleTo, moduleVisibleTo, recipeVisibleTo } from '../access.js';
import { requireBunny, signPlaybackUrl } from '../bunny.js';
import { storage } from '../storage.js';
import { notFound } from '../errors.js';

export const router = Router();
router.use(...learnerAccess); // signed in, password set, inside shift - re-checked on every request

const playbackBody = z.object({ type: z.enum(['module', 'recipe', 'attachment']), id: z.number().int(), renew: z.boolean().optional() });

async function videoIdFor(user, type, id) {
  if (type === 'module') return (await moduleVisibleTo(user, id))?.video_id;
  if (type === 'recipe') return (await recipeVisibleTo(user, id))?.video_id;
  const a = await attachmentVisibleTo(user, id);
  return a?.kind === 'video' ? a.video_id : null;
}

/**
 * Video plays from Bunny's CDN, not through this server. This endpoint is the gate: it runs every access check
 * (signed in, active, in shift, assigned, brand/role) and only then returns a short-lived signed HLS URL.
 * The player asks again before the URL expires, so removing a user or ending a shift stops playback within
 * one token lifetime (BUNNY_TOKEN_TTL_SECONDS).
 */
router.post('/playback', async (req, res) => {
  const { type, id, renew } = playbackBody.parse(req.body);
  requireBunny();
  const videoId = await videoIdFor(req.user, type, id);
  if (!videoId) throw notFound();
  if (!renew) audit(req, 'media.play', type, id);
  res.json(signPlaybackUrl(videoId));
});

/** Single byte range: "bytes=a-b", "bytes=a-", "bytes=-n". null if absent, 'invalid' if unsatisfiable. */
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

/** Streams a stored image / PDF. Never cached, never offered as a download. */
async function sendObject(req, res, key, contentType) {
  const head = await storage.head(key);
  if (!head) throw notFound();
  const range = parseRange(req.headers.range, head.size);
  if (range === 'invalid') return res.status(416).set('Content-Range', `bytes */${head.size}`).end();
  const start = range?.start ?? 0;
  const end = range?.end ?? head.size - 1;
  res.status(range ? 206 : 200).set({
    'Content-Type': contentType || head.contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': String(end - start + 1),
    ...(range ? { 'Content-Range': `bytes ${start}-${end}/${head.size}` } : {}),
  });
  pipeline(await storage.read(key, start, end), res, () => {}); // client disconnects are normal
}

router.get('/attachments/:id/file', async (req, res) => {
  const a = await attachmentVisibleTo(req.user, Number(req.params.id));
  if (!a || a.kind === 'video') throw notFound();
  await sendObject(req, res, a.file_key, a.content_type);
});

router.get('/recipes/:id/image', async (req, res) => {
  const recipe = await recipeVisibleTo(req.user, Number(req.params.id));
  if (!recipe?.image_key) throw notFound();
  await sendObject(req, res, recipe.image_key);
});
