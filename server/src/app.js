import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { config } from './config.js';
import { bunnyEnabled } from './bunny.js';
import { db } from './db.js';
import { endSession } from './auth.js';
import { HttpError } from './errors.js';
import { router as authRouter } from './routes/auth.js';
import { router as orgRouter } from './routes/org.js';
import { router as usersRouter } from './routes/users.js';
import { router as modulesRouter } from './routes/modules.js';
import { adminRouter as recipesAdminRouter, router as recipesRouter } from './routes/recipes.js';
import { router as learnRouter } from './routes/learn.js';
import { router as mediaRouter } from './routes/media.js';
import { router as uploadsRouter } from './routes/uploads.js';
import { router as videosRouter } from './routes/videos.js';
import { router as attachmentsRouter } from './routes/attachments.js';
import { router as emailRouter } from './routes/email.js';
import { router as reportsRouter, auditRouter } from './routes/reports.js';

const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind the AWS load balancer
  app.disable('x-powered-by');
  const origin = (url) => new URL(url).origin;
  const bunnyOrigins = bunnyEnabled() ? [origin(config.bunny.cdnUrl), origin(config.bunny.tusEndpoint)] : [];
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // video: HLS segments come from Bunny's CDN and are fed to the player as blob: (hls.js) or played natively (iOS)
          'media-src': ["'self'", 'blob:', ...(bunnyEnabled() ? [origin(config.bunny.cdnUrl)] : [])],
          // browser -> Bunny (resumable uploads, HLS requests); with S3 storage also browser -> bucket (presigned uploads)
          'connect-src': ["'self'", ...(config.storage.driver === 's3' ? [`https://${config.storage.bucket}.s3.${config.storage.region}.amazonaws.com`] : []), ...bunnyOrigins],
          // hls.js and pdf.js run in web workers
          'worker-src': ["'self'", 'blob:'],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });

  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/auth', authRouter);
  app.use('/api/org', orgRouter);
  app.use('/api/admin/users', usersRouter);
  app.use('/api/admin/modules', modulesRouter);
  app.use('/api/admin/recipes', recipesAdminRouter);
  app.use('/api/admin/uploads', uploadsRouter);
  app.use('/api/admin/videos', videosRouter);
  app.use('/api/admin/attachments', attachmentsRouter);
  app.use('/api/admin/audit', auditRouter);
  app.use('/api/admin/email', emailRouter);
  app.use('/api/learn', learnRouter);
  app.use('/api/recipes', recipesRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }));

  // the built React app (production / Docker)
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (_req, res, next) => res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next()));

  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const message = err.issues.map((i) => `${i.path.join('.') || 'request'}: ${i.message}`).join('; ');
      return res.status(400).json({ error: { code: 'VALIDATION', message } });
    }
    if (err instanceof HttpError) {
      if (err.code === 'ACCOUNT_DEACTIVATED' || err.code === 'SESSION_EXPIRED') endSession(res);
      return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Invalid JSON' } });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request too large' } });
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });

  return app;
}
