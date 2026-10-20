import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit.js';
import { authenticate, requireAdmin, requireFreshPassword } from '../auth.js';
import { VIDEO_ID, bunnyEnabled, createVideo, getVideo, requireBunny, tusAuth } from '../bunny.js';
import { config } from '../config.js';
import { badRequest, notFound } from '../errors.js';

export const router = Router();
router.use(authenticate, requireFreshPassword, requireAdmin);

router.get('/config', (_req, res) => {
  res.json({ enabled: bunnyEnabled(), tokenTtlSeconds: config.bunny.tokenTtlSeconds });
});

/** Step 1 of a video upload: create the video on Bunny and hand the browser what it needs to upload straight to it (TUS). */
router.post('/', async (req, res) => {
  const { title } = z.object({ title: z.string().trim().min(1).max(200) }).parse(req.body);
  requireBunny();
  const videoId = await createVideo(title);
  audit(req, 'video.create', 'video', videoId, { title });
  res.status(201).json({ videoId, upload: tusAuth(videoId) });
});

/** Step 2: poll until Bunny has finished converting the upload to HLS. */
router.get('/:videoId', async (req, res) => {
  if (!VIDEO_ID.test(req.params.videoId)) throw badRequest('Invalid video');
  const video = await getVideo(req.params.videoId);
  if (!video) throw notFound('Video not found in the video library');
  res.json(video);
});
