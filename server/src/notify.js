import { db } from './db.js';
import { emailEnabled, sendMail } from './mailer.js';

class AlreadyClaimed extends Error {}

/**
 * Sends one email and records it in email_log. `dedupeKeys` identify the reminders it contains: a key can only
 * ever be claimed once, so restarts and several app instances never send the same reminder twice.
 * Never throws for delivery problems - returns { sent, error, skipped }.
 */
export async function deliver({ userId = null, to, kind, subject, text, html, dedupeKeys = [] }) {
  if (!emailEnabled()) return { sent: false, disabled: true, error: 'Email is not configured' };

  let logId;
  try {
    logId = await db.tx(async (c) => {
      const { rows: [row] } = await c.query(
        `INSERT INTO email_log (user_id, to_address, kind, subject, status) VALUES ($1,$2,$3,$4,'pending') RETURNING id`,
        [userId, to, kind, subject],
      );
      for (const key of dedupeKeys) {
        const r = await c.query('INSERT INTO reminder_items (dedupe_key, email_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [key, row.id]);
        if (r.rowCount === 0) throw new AlreadyClaimed();
      }
      return row.id;
    });
  } catch (err) {
    if (err instanceof AlreadyClaimed) return { sent: false, skipped: true };
    throw err;
  }

  try {
    await sendMail({ to, subject, text, html });
    await db.query(`UPDATE email_log SET status = 'sent', sent_at = now() WHERE id = $1`, [logId]);
    return { sent: true };
  } catch (err) {
    const error = String(err.message || err).slice(0, 300);
    await db.query(`UPDATE email_log SET status = 'failed', error = $2 WHERE id = $1`, [logId, error]);
    return { sent: false, error };
  }
}
