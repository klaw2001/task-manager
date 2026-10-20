import { config } from './config.js';
import { db } from './db.js';
import { trainingEmail } from './emails.js';
import { emailEnabled } from './mailer.js';
import { deliver } from './notify.js';
import { progressRows } from './progress-query.js';
import { withStatus } from './status.js';

const DAY = 24 * 3600 * 1000;
const MAX_OVERDUE_REMINDERS = 5; // one every 3 days, then stop nagging

function hourInZone(now) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now));
}

/**
 * What each person should hear about right now. One kind per assignment, most urgent wins:
 * overdue > due soon > retraining required > newly assigned.
 */
export function reminderItems(rows, now = new Date(), { dueSoonDays = config.reminders.dueSoonDays } = {}) {
  const items = [];
  for (const r of rows) {
    if (r.status === 'completed') continue;
    const due = r.due_at ? new Date(r.due_at) : null;
    const base = `${r.user_id}:${r.module_id}:${r.version}`;
    let kind;
    let key;
    if (due && due < now) {
      const bucket = Math.floor((now - due) / (3 * DAY));
      if (bucket >= MAX_OVERDUE_REMINDERS) continue;
      kind = 'overdue';
      key = `overdue:${base}:${due.getTime()}:${bucket}`;
    } else if (due && due - now <= dueSoonDays * DAY) {
      kind = 'due_soon';
      key = `due:${base}:${due.getTime()}`;
    } else if (r.status === 'retraining_required') {
      kind = 'retraining';
      key = `retrain:${base}`;
    } else if (r.status === 'not_started' && r.assigned_at && now - new Date(r.assigned_at) < 7 * DAY) {
      kind = 'new_training';
      key = `new:${base}:${new Date(r.assigned_at).getTime()}`;
    } else continue;
    items.push({ userId: r.user_id, kind, key, title: r.title, dueAt: r.due_at });
  }
  return items;
}

/** Finds due reminders and emails them, one digest per person per kind. Safe to run often and from several instances. */
export async function runReminders({ now = new Date(), ignoreQuietHours = false } = {}) {
  if (!emailEnabled()) return { skipped: 'Email is not configured' };
  const { startHour, endHour } = config.reminders;
  const hour = hourInZone(now);
  if (!ignoreQuietHours && (hour < startHour || hour >= endHour)) return { skipped: `Outside sending hours (${startHour}:00–${endHour}:00)` };

  const people = new Map((await db.all(`SELECT id, name, email FROM users WHERE is_active AND email IS NOT NULL AND email <> ''`)).map((u) => [u.id, u]));
  const rows = (await progressRows({})).filter((r) => people.has(r.user_id)).map((r) => withStatus(r, now));
  let items = reminderItems(rows, now);
  const seen = new Set((await db.all('SELECT dedupe_key FROM reminder_items WHERE dedupe_key = ANY($1)', [items.map((i) => i.key)])).map((r) => r.dedupe_key));
  items = items.filter((i) => !seen.has(i.key));

  const groups = new Map();
  for (const item of items) {
    const id = `${item.userId}:${item.kind}`;
    groups.set(id, [...(groups.get(id) ?? []), item]);
  }

  const summary = { candidates: items.length, sent: 0, failed: 0, skipped: 0 };
  for (const group of groups.values()) {
    const person = people.get(group[0].userId);
    const mail = trainingEmail({ name: person.name, kind: group[0].kind, items: group.map((i) => ({ title: i.title, dueAt: i.dueAt })) });
    const result = await deliver({ userId: person.id, to: person.email, kind: group[0].kind, ...mail, dedupeKeys: group.map((i) => i.key) });
    if (result.sent) summary.sent++;
    else if (result.skipped) summary.skipped++;
    else summary.failed++;
  }
  return summary;
}

let timer;
export function startReminderScheduler(log = console.log) {
  if (timer || !config.reminders.enabled || !emailEnabled()) return false;
  const tick = () => runReminders().then((s) => s.sent && log(`reminders: ${JSON.stringify(s)}`)).catch((err) => console.error('reminders failed', err));
  setTimeout(tick, 60_000).unref();
  timer = setInterval(tick, config.reminders.intervalMinutes * 60_000);
  timer.unref();
  return true;
}
