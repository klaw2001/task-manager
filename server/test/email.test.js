import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { client, setup } from './helpers.js';

let ctx;
let config;
let resetTransport;
let runReminders;
before(async () => {
  ctx = await setup();
  ({ config } = await import('../src/config.js'));
  ({ resetTransport } = await import('../src/mailer.js'));
  ({ runReminders } = await import('../src/reminders.js'));
});
after(async () => { await ctx.close(); });

const as = async (employeeId) => { const c = client(ctx.baseUrl); await c.login(employeeId); return c; };
const idOf = async (employeeId) => (await ctx.db.one('SELECT id FROM users WHERE employee_id = $1', [employeeId])).id;
const mail = () => ctx.smtp.messages;
const DAY = 24 * 3600 * 1000;
let admin;

test('settings page data and the test email: delivered through the SMTP login, logged, super-admin only', async () => {
  admin = await as('ADMIN001');
  const info = (await admin.get('/api/admin/email')).data;
  assert.equal(info.enabled, true);
  assert.equal(info.from, 'Staff Training <training@example.test>');
  assert.equal(info.host, '127.0.0.1');
  assert.ok(!JSON.stringify(info).includes(ctx.smtp.pass), 'the SMTP password is never exposed');

  const sent = await admin.post('/api/admin/email/test', { to: 'owner@example.test' });
  assert.equal(sent.status, 200);
  assert.equal(mail().length, 1);
  assert.equal(mail()[0].to, 'owner@example.test');
  assert.equal(mail()[0].subject, 'Staff Training test email');
  assert.match(mail()[0].from, /training@example\.test/);
  assert.match(mail()[0].text, /Email is working/);

  const log = (await admin.get('/api/admin/email')).data.log;
  assert.deepEqual([log[0].kind, log[0].status], ['test', 'sent']);

  assert.equal((await admin.post('/api/admin/email/test', { to: 'not-an-email' })).status, 400);
  assert.equal((await (await as('TRAIN001')).get('/api/admin/email')).status, 403);
  assert.equal((await (await as('TM002')).post('/api/admin/email/test', { to: 'a@b.co' })).status, 403);
});

test('wrong Brevo credentials give a clear error and a failed log entry; no credentials means email is simply off', async () => {
  const saved = { ...config.smtp };
  try {
    config.smtp.pass = 'wrong-key';
    resetTransport();
    const bad = await admin.post('/api/admin/email/test', { to: 'owner@example.test' });
    assert.equal(bad.status, 502);
    assert.equal(bad.error.code, 'EMAIL_FAILED');
    assert.match(bad.error.message, /Invalid login|Authentication|credentials/i);
    const log = (await admin.get('/api/admin/email')).data.log;
    assert.equal(log[0].status, 'failed');
    assert.match(log[0].error, /Invalid login|Authentication|credentials/i);
    assert.ok(!JSON.stringify(log).includes('wrong-key'));

    config.smtp.user = '';
    resetTransport();
    const off = await admin.post('/api/admin/email/test', { to: 'owner@example.test' });
    assert.equal(off.status, 503);
    assert.equal(off.error.code, 'EMAIL_NOT_CONFIGURED');
    assert.equal((await admin.get('/api/admin/email')).data.enabled, false);
    assert.deepEqual(await runReminders({ ignoreQuietHours: true }), { skipped: 'Email is not configured' });

    // everything else keeps working without email
    const outlet = await ctx.db.one(`SELECT id FROM outlets WHERE name='Andheri'`);
    const created = await admin.post('/api/admin/users', { employeeId: 'NOMAIL1', name: 'No Mail', role: 'team_member', outletId: outlet.id, email: 'nomail@example.test', sendInvite: true });
    assert.equal(created.status, 201);
    assert.equal(created.data.emailed, false);
    assert.match(created.data.emailError, /not configured/i);
    assert.ok(created.data.temporaryPassword, 'the admin can still hand over the password');
  } finally {
    Object.assign(config.smtp, saved);
    resetTransport();
  }
});

test('invite and password-reset emails carry working login details', async () => {
  const before = mail().length;
  const outlet = await ctx.db.one(`SELECT id FROM outlets WHERE name='Andheri'`);
  const created = await admin.post('/api/admin/users', { employeeId: 'NEW100', name: 'Priya <b>Sharma</b>', role: 'team_member', outletId: outlet.id, email: 'priya@example.test', sendInvite: true });
  assert.equal(created.status, 201);
  assert.equal(created.data.emailed, true);
  assert.equal(created.data.user.email, 'priya@example.test');
  assert.equal(mail().length, before + 1);
  const invite = mail().at(-1);
  assert.equal(invite.to, 'priya@example.test');
  assert.equal(invite.subject, 'Your Staff Training login');
  assert.ok(invite.text.includes('NEW100') && invite.text.includes(created.data.temporaryPassword));
  assert.ok(invite.text.includes('https://training.example.test'), 'links to the app');
  assert.ok(invite.html.includes('&lt;b&gt;Sharma&lt;/b&gt;') && !invite.html.includes('<b>Sharma</b>'), 'names are HTML-escaped');
  const c = client(ctx.baseUrl);
  assert.equal((await c.post('/api/auth/login', { employeeId: 'NEW100', password: created.data.temporaryPassword })).status, 200, 'the emailed password works');

  // no email address or invite not requested: nothing sent
  const noEmail = await admin.post('/api/admin/users', { employeeId: 'NEW101', name: 'No Address', role: 'team_member', outletId: outlet.id, sendInvite: true });
  assert.equal(noEmail.data.emailed, null);
  const notAsked = await admin.post('/api/admin/users', { employeeId: 'NEW102', name: 'Quiet', role: 'team_member', outletId: outlet.id, email: 'quiet@example.test' });
  assert.equal(notAsked.data.emailed, null);
  assert.equal(mail().length, before + 1);
  assert.equal((await admin.post('/api/admin/users', { employeeId: 'NEW103', name: 'Bad', role: 'team_member', outletId: outlet.id, email: 'nope' })).status, 400);

  const reset = await admin.post(`/api/admin/users/${created.data.user.id}/reset-password`, { sendEmail: true });
  assert.equal(reset.data.emailed, true);
  const resetMail = mail().at(-1);
  assert.equal(resetMail.subject, 'Your Staff Training password was reset');
  assert.ok(resetMail.text.includes(reset.data.temporaryPassword));
  assert.equal((await client(ctx.baseUrl).post('/api/auth/login', { employeeId: 'NEW100', password: reset.data.temporaryPassword })).status, 200);
  assert.equal((await admin.post(`/api/admin/users/${created.data.user.id}/reset-password`, {})).data.emailed, null, 'email only when asked');

  // the address can be edited later
  assert.equal((await admin.patch(`/api/admin/users/${created.data.user.id}`, { email: 'priya.new@example.test' })).data.email, 'priya.new@example.test');
});

test('reminders: due-soon, overdue and new-training digests, one email per person per kind, never repeated', async () => {
  // fresh state: only these people have an address
  await ctx.db.query(`UPDATE users SET email = NULL`);
  await ctx.db.query(`UPDATE users SET email = lower(employee_id) || '@example.test' WHERE employee_id IN ('TM002','TM003','INC001')`);
  const now = new Date();
  const set = async (employeeId, title, { due, assigned = new Date(now - 30 * DAY) }) =>
    ctx.db.query(
      `UPDATE assignments SET due_at = $3, assigned_at = $4
       WHERE user_id = (SELECT id FROM users WHERE employee_id = $1) AND module_id = (SELECT id FROM modules WHERE title = $2)`,
      [employeeId, title, due, assigned],
    );
  await set('TM002', 'Food Safety Basics', { due: new Date(+now + 2 * DAY) });                       // due soon
  await set('TM002', 'Burger Assembly SOP', { due: new Date(+now + 10 * DAY), assigned: new Date(+now - 3600_000) }); // newly assigned
  await set('TM003', 'Food Safety Basics', { due: new Date(+now - 1 * DAY) });                        // overdue
  await set('TM003', 'Burger Assembly SOP', { due: new Date(+now - 7 * DAY) });                       // overdue
  await set('INC001', 'Food Safety Basics', { due: new Date(+now + 20 * DAY), assigned: new Date(+now - 3600_000) }); // new
  await set('INC001', 'Shift Handover for In-charges', { due: new Date(+now + 20 * DAY) });           // old and not due: nothing
  await set('TM004', 'Food Safety Basics', { due: new Date(+now - 5 * DAY) });                        // overdue but no email address

  const first = await runReminders({ now, ignoreQuietHours: true });
  assert.deepEqual(first, { candidates: 5, sent: 4, failed: 0, skipped: 0 });
  const mails = mail().filter((m) => /example\.test$/.test(m.to) && /tm00|inc001/.test(m.to));
  const to = (addr) => mails.filter((m) => m.to === addr).map((m) => m.subject).sort();
  assert.deepEqual(to('tm002@example.test'), ['New training assigned (1)', 'Training due soon (1)']);
  assert.deepEqual(to('tm003@example.test'), ['Overdue training (2)'], 'both overdue modules in a single email');
  assert.deepEqual(to('inc001@example.test'), ['New training assigned (1)']);
  assert.equal(mails.filter((m) => m.to === 'tm004@example.test').length, 0);
  const overdue = mails.find((m) => m.to === 'tm003@example.test');
  assert.ok(overdue.text.includes('Food Safety Basics — due') && overdue.text.includes('Burger Assembly SOP — due'));
  assert.ok(overdue.text.includes('https://training.example.test'));

  // running again changes nothing, even from another "instance"
  const count = mail().length;
  assert.deepEqual(await runReminders({ now, ignoreQuietHours: true }), { candidates: 0, sent: 0, failed: 0, skipped: 0 });
  const [a, b] = await Promise.all([runReminders({ now, ignoreQuietHours: true }), runReminders({ now, ignoreQuietHours: true })]);
  assert.equal(a.sent + b.sent, 0);
  assert.equal(mail().length, count);

  // three days later the overdue reminder repeats; the new-training and due-soon ones have been replaced by overdue for TM002
  const later = await runReminders({ now: new Date(+now + 4 * DAY), ignoreQuietHours: true });
  assert.ok(later.sent >= 2, JSON.stringify(later));
  assert.ok(mail().slice(count).some((m) => m.to === 'tm003@example.test' && m.subject === 'Overdue training (2)'));
  assert.ok(mail().slice(count).some((m) => m.to === 'tm002@example.test' && m.subject === 'Overdue training (1)'));

  // completed training is never chased
  await ctx.db.query(`INSERT INTO progress (user_id, module_id, version, lesson_completed_at, assessment_passed_at, acknowledged_at, completed_at)
    SELECT u.id, m.id, m.version, now(), now(), now(), now() FROM users u, modules m WHERE u.employee_id = 'TM003' AND m.title = 'Food Safety Basics'`);
  const done = mail().length;
  await runReminders({ now: new Date(+now + 8 * DAY), ignoreQuietHours: true });
  assert.ok(!mail().slice(done).some((m) => m.to === 'tm003@example.test' && m.text.includes('Food Safety Basics')));
});

test('reminders respect sending hours, and a failed send is recorded and not hammered', async () => {
  const night = new Date('2026-01-15T03:00:00+05:30'); // 03:00 in Asia/Kolkata
  const quiet = await runReminders({ now: night });
  assert.match(quiet.skipped, /Outside sending hours/);

  const people = await ctx.db.all(`SELECT employee_id FROM users WHERE email IS NOT NULL ORDER BY id`);
  assert.ok(people.length >= 3);
  await ctx.db.query(`DELETE FROM reminder_items`);
  const saved = { ...config.smtp };
  try {
    config.smtp.pass = 'wrong-key';
    resetTransport();
    const failed = await runReminders({ ignoreQuietHours: true });
    assert.ok(failed.failed > 0 && failed.sent === 0, JSON.stringify(failed));
    assert.ok((await ctx.db.one(`SELECT count(*)::int AS n FROM email_log WHERE status = 'failed' AND kind <> 'test'`)).n > 0);
  } finally {
    Object.assign(config.smtp, saved);
    resetTransport();
  }
  const again = await runReminders({ ignoreQuietHours: true });
  assert.equal(again.sent, 0, 'a reminder whose email failed is not retried in the same window (the next window will try again)');
});

test('super admins can run the reminder job on demand', async () => {
  await ctx.db.query(`DELETE FROM reminder_items`);
  const res = await admin.post('/api/admin/email/reminders/run');
  assert.equal(res.status, 200);
  assert.ok('sent' in res.data && 'candidates' in res.data);
  assert.equal((await (await as('TRAIN001')).post('/api/admin/email/reminders/run')).status, 403);
});
