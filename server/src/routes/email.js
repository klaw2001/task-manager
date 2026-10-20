import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { authenticate, requireFreshPassword, requireRoles } from '../auth.js';
import { config } from '../config.js';
import { testEmail } from '../emails.js';
import { emailEnabled } from '../mailer.js';
import { deliver } from '../notify.js';
import { runReminders } from '../reminders.js';
import { HttpError } from '../errors.js';

export const router = Router();
router.use(authenticate, requireFreshPassword, requireRoles('super_admin'));

router.get('/', async (_req, res) => {
  res.json({
    enabled: emailEnabled(),
    from: config.smtp.from || null,
    host: config.smtp.host,
    port: config.smtp.port,
    reminders: { enabled: config.reminders.enabled, hours: `${config.reminders.startHour}:00–${config.reminders.endHour}:00`, dueSoonDays: config.reminders.dueSoonDays },
    log: await db.all('SELECT id, created_at, to_address, kind, subject, status, error FROM email_log ORDER BY id DESC LIMIT 100'),
  });
});

router.post('/test', async (req, res) => {
  const { to } = z.object({ to: z.email().max(200) }).parse(req.body);
  if (!emailEnabled()) throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Email is not set up yet. Add the Brevo SMTP settings (see docs/EMAIL.md).');
  const result = await deliver({ to, kind: 'test', ...testEmail() });
  audit(req, 'email.test', 'email', null, { to, sent: result.sent });
  if (!result.sent) throw new HttpError(502, 'EMAIL_FAILED', `Brevo refused or could not deliver the message: ${result.error}`);
  res.json({ sent: true });
});

/** Runs the reminder job now (ignoring the quiet hours), e.g. to check the setup. */
router.post('/reminders/run', async (req, res) => {
  if (!emailEnabled()) throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Email is not set up yet.');
  const summary = await runReminders({ ignoreQuietHours: true });
  audit(req, 'email.reminders_run', 'email', null, summary);
  res.json(summary);
});
