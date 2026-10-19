import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { client, setup, windowAround } from './helpers.js';

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await ctx.close(); fs.rmSync(process.env.LOCAL_STORAGE_DIR, { recursive: true, force: true }); });

const as = async (employeeId) => { const c = client(ctx.baseUrl); await c.login(employeeId); return c; };
const idOf = async (employeeId) => (await ctx.db.one('SELECT id FROM users WHERE employee_id = $1', [employeeId])).id;
const moduleId = async (title) => (await ctx.db.one('SELECT id FROM modules WHERE title = $1', [title])).id;
const byText = (list, text) => list.find((x) => (x.title ?? x.text) === text);

const CORRECT = {
  'How long should you wash your hands before handling food?': ['b'],
  'Which temperatures are safe? (select all)': ['a', 'b'],
  'Raw chicken and salad can share a chopping board.': ['b'],
  'Describe one hygiene mistake you have seen in a kitchen (optional).': 'Not washing hands',
};
const answers = (quiz, right) =>
  Object.fromEntries(quiz.questions.map((q) => [q.id, right ? CORRECT[q.text] : q.type === 'written' ? '' : ['c']]));

test('unauthenticated requests are rejected; wrong password is rejected', async () => {
  const anon = client(ctx.baseUrl);
  assert.equal((await anon.get('/api/learn/modules')).status, 401);
  assert.equal((await anon.get('/api/admin/users')).status, 401);
  const bad = await anon.post('/api/auth/login', { employeeId: 'TM001', password: 'nope' });
  assert.equal(bad.status, 401);
  assert.equal(bad.error.code, 'INVALID_CREDENTIALS');
  const ok = await anon.post('/api/auth/login', { employeeId: 'tm001', password: 'Demo@1234' });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(ok.headers.get('set-cookie'), /SameSite=Strict/i);
  assert.equal(ok.data.user.password_hash, undefined);
});

test('shift: content is locked outside the shift window and opens inside it', async () => {
  const admin = await as('ADMIN001');
  const tm = await as('TM001');
  const uid = await idOf('TM001');

  const outside = windowAround(2, 3);
  assert.equal((await admin.patch(`/api/admin/users/${uid}`, { shiftStart: outside.start, shiftEnd: outside.end })).status, 200);
  for (const url of ['/api/learn/modules', '/api/recipes', `/api/media/recipes/1/image`]) {
    const r = await tm.get(url);
    assert.equal(r.status, 403, url);
    assert.equal(r.error.code, 'OUTSIDE_SHIFT');
    assert.equal(r.error.shift.start, outside.start);
  }
  const me = await tm.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.user.shift.open, false);

  const inside = windowAround(-1, 1);
  await admin.patch(`/api/admin/users/${uid}`, { shiftStart: inside.start, shiftEnd: inside.end });
  assert.equal((await tm.get('/api/learn/modules')).status, 200);
  assert.equal((await tm.get('/api/auth/me')).data.user.shift.open, true);

  // half-set shifts are refused
  assert.equal((await admin.patch(`/api/admin/users/${uid}`, { shiftStart: null })).status, 400);
  // admins are never shift-locked, whatever is set on them
  const adminId = await idOf('ADMIN001');
  await ctx.db.query(`UPDATE users SET shift_start='00:00', shift_end='00:01' WHERE id=$1`, [adminId]);
  assert.equal((await admin.get('/api/recipes')).status, 200);
});

test('learner journey: lesson -> assessment (fail then pass) -> acknowledge -> complete; prerequisites unlock', async () => {
  const tm = await as('TM002');
  const list = (await tm.get('/api/learn/modules')).data;
  const safety = byText(list, 'Food Safety Basics');
  const burger = byText(list, 'Burger Assembly SOP');
  assert.equal(safety.status, 'not_started');
  assert.equal(burger.locked, true);
  assert.equal((await tm.get(`/api/learn/modules/${burger.module_id}`)).error.code, 'PREREQUISITE_REQUIRED');
  assert.equal((await tm.get(`/api/learn/modules/${safety.module_id}/quiz`)).error.code, 'LESSON_REQUIRED');

  const lesson = await tm.post(`/api/learn/modules/${safety.module_id}/lesson`);
  assert.equal(lesson.status, 200);
  assert.equal(lesson.data.status, 'in_progress');

  const quiz = (await tm.get(`/api/learn/modules/${safety.module_id}/quiz`)).data;
  assert.equal(quiz.questions.length, 4);
  assert.ok(!JSON.stringify(quiz).includes('correct'), 'answer key must never be sent to the browser');

  const failed = await tm.post(`/api/learn/modules/${safety.module_id}/attempts`, { answers: answers(quiz, false) });
  assert.equal(failed.data.passed, false);
  assert.equal(failed.data.module.attempts_left, 2);
  assert.equal(failed.data.module.status, 'in_progress');

  const passed = await tm.post(`/api/learn/modules/${safety.module_id}/attempts`, { answers: answers(quiz, true) });
  assert.equal(passed.data.passed, true);
  assert.equal(passed.data.score, 100);
  assert.equal(passed.data.module.status, 'ack_pending', 'passing alone must not complete the module');
  assert.equal(passed.data.module.completed_at, null);
  assert.equal((await tm.post(`/api/learn/modules/${safety.module_id}/attempts`, { answers: answers(quiz, true) })).error.code, 'ALREADY_PASSED');

  const done = await tm.post(`/api/learn/modules/${safety.module_id}/acknowledge`);
  assert.equal(done.data.status, 'completed');
  assert.ok(done.data.completed_at);
  assert.equal(done.data.best_score, 100);
  assert.equal((await tm.get(`/api/learn/modules/${burger.module_id}`)).status, 200, 'prerequisite done -> unlocked');
});

test('attempt limit: failing every attempt blocks the module until an admin allows a retake', async () => {
  const admin = await as('ADMIN001');
  const inc = await as('INC002');
  const mid = await moduleId('Food Safety Basics');
  await inc.post(`/api/learn/modules/${mid}/lesson`);
  const quiz = (await inc.get(`/api/learn/modules/${mid}/quiz`)).data;
  for (let i = 0; i < 3; i++) await inc.post(`/api/learn/modules/${mid}/attempts`, { answers: answers(quiz, false) });
  const modules = (await inc.get('/api/learn/modules')).data;
  assert.equal(byText(modules, 'Food Safety Basics').status, 'failed');
  assert.equal((await inc.get(`/api/learn/modules/${mid}/quiz`)).error.code, 'NO_ATTEMPTS_LEFT');
  assert.equal((await inc.post(`/api/learn/modules/${mid}/attempts`, { answers: answers(quiz, true) })).error.code, 'NO_ATTEMPTS_LEFT');

  const report = (await admin.get('/api/reports/progress?status=failed')).data;
  assert.ok(report.rows.some((r) => r.employee_id === 'INC002'), 'managers can see failed training');

  assert.equal((await admin.post(`/api/admin/modules/${mid}/retake/${await idOf('INC002')}`)).status, 200);
  const after = byText((await inc.get('/api/learn/modules')).data, 'Food Safety Basics');
  assert.notEqual(after.status, 'failed');
  assert.equal((await inc.post(`/api/learn/modules/${mid}/lesson`)).status, 200);
  assert.equal((await inc.get(`/api/learn/modules/${mid}/quiz`)).status, 200);
});

test('new version: retrain keeps the old completion on record; reack only needs a fresh acknowledgement', async () => {
  const admin = await as('ADMIN001');
  const tm = await as('TM002');
  const mid = await moduleId('Food Safety Basics');
  const uid = await idOf('TM002');

  const v2 = await admin.post(`/api/admin/modules/${mid}/new-version`, { changeType: 'retrain', note: 'New allergen rules' });
  assert.equal(v2.data.version, 2);
  assert.equal(byText((await tm.get('/api/learn/modules')).data, 'Food Safety Basics').status, 'retraining_required');
  let rows = await ctx.db.all('SELECT version, completed_at FROM progress WHERE user_id=$1 AND module_id=$2 ORDER BY version', [uid, mid]);
  assert.deepEqual(rows.map((r) => [r.version, Boolean(r.completed_at)]), [[1, true]], 'v1 completion survives');

  await tm.post(`/api/learn/modules/${mid}/lesson`);
  const quiz = (await tm.get(`/api/learn/modules/${mid}/quiz`)).data;
  await tm.post(`/api/learn/modules/${mid}/attempts`, { answers: answers(quiz, true) });
  assert.equal((await tm.post(`/api/learn/modules/${mid}/acknowledge`)).data.status, 'completed');

  const v3 = await admin.post(`/api/admin/modules/${mid}/new-version`, { changeType: 'reack', note: 'Wording change' });
  assert.equal(v3.data.version, 3);
  assert.equal(byText((await tm.get('/api/learn/modules')).data, 'Food Safety Basics').status, 'ack_pending');
  assert.equal((await tm.post(`/api/learn/modules/${mid}/acknowledge`)).data.status, 'completed');

  rows = await ctx.db.all('SELECT version, completed_at FROM progress WHERE user_id=$1 AND module_id=$2 ORDER BY version', [uid, mid]);
  assert.deepEqual(rows.map((r) => [r.version, Boolean(r.completed_at)]), [[1, true], [2, true], [3, true]]);
  const attempts = await ctx.db.all('SELECT DISTINCT version FROM attempts WHERE user_id=$1 AND module_id=$2 ORDER BY version', [uid, mid]);
  assert.deepEqual(attempts.map((a) => a.version), [1, 2], 'attempts stay linked to the version they were made on');

  const versions = (await admin.get(`/api/admin/modules/${mid}/versions`)).data;
  assert.deepEqual(versions.map((v) => v.version), [3, 2, 1]);
  const history = (await admin.get(`/api/reports/history/${uid}`)).data.history;
  assert.equal(history.filter((h) => h.completed_at).length, 3);
});

test('video: upload, protected streaming in short ranges, tamper-proof progress, and immediate revocation', async () => {
  const admin = await as('ADMIN001');
  const bytes = randomBytes(1024 * 1024);

  const slot = (await admin.post('/api/admin/uploads', { kind: 'video', filename: 'plating demo.mp4', contentType: 'video/mp4' })).data;
  assert.match(slot.key, /^videos\/[0-9a-f-]{36}\/plating_demo\.mp4$/);
  assert.equal((await admin.put(slot.url, bytes, { 'Content-Type': 'video/mp4' })).status, 200);
  assert.equal((await admin.post('/api/admin/uploads', { kind: 'video', filename: 'x.exe', contentType: 'application/x-msdownload' })).status, 400);
  // %2f survives URL normalisation, so the server really receives ../../etc/passwd as the key
  assert.equal((await admin.put('/api/admin/uploads/local/videos/00000000-0000-0000-0000-000000000000/..%2f..%2f..%2fetc%2fpasswd', bytes, { 'Content-Type': 'video/mp4' })).status, 400);

  // onboarding a new user: temporary password must be changed before anything else works
  const outlet = await ctx.db.one(`SELECT id FROM outlets WHERE name='Andheri'`);
  const created = await admin.post('/api/admin/users', { employeeId: 'TM900', name: '=HYPERLINK("http://evil")', role: 'team_member', outletId: outlet.id, shiftStart: null, shiftEnd: null });
  assert.equal(created.status, 201);
  assert.ok(created.data.assigned >= 2, 'training path is assigned automatically');
  const nu = client(ctx.baseUrl);
  const first = await nu.post('/api/auth/login', { employeeId: 'TM900', password: created.data.temporaryPassword });
  assert.equal(first.status, 200);
  assert.equal((await nu.get('/api/learn/modules')).error.code, 'PASSWORD_CHANGE_REQUIRED');
  assert.equal((await nu.post('/api/auth/change-password', { currentPassword: created.data.temporaryPassword, newPassword: 'short' })).status, 400);
  assert.equal((await nu.post('/api/auth/change-password', { currentPassword: created.data.temporaryPassword, newPassword: 'Fresh-pass-42' })).status, 200);
  assert.equal((await nu.get('/api/learn/modules')).status, 200);

  const mod = (await admin.post('/api/admin/modules', { title: 'Plating Demo', roles: ['team_member'], videoKey: slot.key, durationSeconds: 100, minWatchPercent: 90, instructions: 'Watch the demo' })).data;
  assert.equal((await admin.post(`/api/admin/modules/${mod.id}/assign`, { userIds: [await idOf('TM900')] })).status, 400, 'cannot assign before publishing');
  assert.equal((await admin.post(`/api/admin/modules/${mod.id}/publish`)).status, 200);
  const assignRes = await admin.post(`/api/admin/modules/${mod.id}/assign`, { role: 'team_member', outletId: outlet.id });
  assert.ok(assignRes.data.assigned >= 3);

  // streaming
  const range = await nu.get(`/api/media/modules/${mod.id}/video`, { Range: 'bytes=0-' });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), `bytes 0-${256 * 1024 - 1}/${bytes.length}`, 'each response is capped so access is re-checked often');
  assert.equal(range.data.length, 256 * 1024);
  assert.ok(range.data.equals(bytes.subarray(0, 256 * 1024)));
  assert.match(range.headers.get('cache-control'), /no-store/);
  assert.match(range.headers.get('content-disposition'), /^inline/);
  assert.equal((await nu.get(`/api/media/modules/${mod.id}/video`)).status, 206, 'no Range header still gets only the first chunk');
  const mid = await nu.get(`/api/media/modules/${mod.id}/video`, { Range: 'bytes=500000-600000' });
  assert.ok(mid.data.equals(bytes.subarray(500000, 600001)));
  assert.equal((await nu.get(`/api/media/modules/${mod.id}/video`, { Range: 'bytes=99999999-' })).status, 416);

  // a user who is not assigned / not eligible gets nothing
  const other = await as('TM004');
  assert.equal((await other.get(`/api/media/modules/${mod.id}/video`)).status, 404);
  assert.equal((await client(ctx.baseUrl).get(`/api/media/modules/${mod.id}/video`)).status, 401);
  assert.equal((await as('INC002').then((c) => c.get(`/api/media/modules/${mod.id}/video`))).status, 404, 'wrong role');

  // progress: seeking to the end earns nothing
  const seek = await nu.post(`/api/learn/modules/${mod.id}/progress`, { position: 100, delta: 100 });
  assert.equal(seek.status, 200);
  assert.ok(seek.data.watched_seconds < 25, `capped, got ${seek.data.watched_seconds}`);
  assert.equal(seek.data.lesson_completed_at, null);
  // ...but genuine watching over real time does
  await ctx.db.query(`UPDATE progress SET watched_seconds = 85, last_report_at = now() - interval '100 seconds' WHERE user_id = $1 AND module_id = $2`, [await idOf('TM900'), mod.id]);
  const watched = await nu.post(`/api/learn/modules/${mod.id}/progress`, { position: 95, delta: 10 });
  assert.ok(watched.data.lesson_completed_at);
  assert.equal(watched.data.status, 'ack_pending', 'no questions: lesson done -> only the acknowledgement is left');
  assert.equal((await nu.get(`/api/learn/modules/${mod.id}`)).data.last_position, 95, 'resume position is saved');
  assert.equal((await nu.post(`/api/learn/modules/${mod.id}/acknowledge`)).data.status, 'completed');

  // revocation: the very next request fails, including the next chunk of a video that is already playing
  assert.equal((await nu.get(`/api/media/modules/${mod.id}/video`, { Range: 'bytes=262144-' })).status, 206);
  assert.equal((await admin.post(`/api/admin/users/${await idOf('TM900')}/deactivate`)).status, 200);
  const blocked = await nu.get(`/api/media/modules/${mod.id}/video`, { Range: 'bytes=524288-' });
  assert.equal(blocked.status, 401);
  assert.equal(blocked.error.code, 'ACCOUNT_DEACTIVATED');
  assert.equal((await client(ctx.baseUrl).post('/api/auth/login', { employeeId: 'TM900', password: 'Fresh-pass-42' })).status, 401);
  assert.equal((await admin.post(`/api/admin/users/${await idOf('TM900')}/reactivate`)).status, 200);
  assert.equal((await nu.get('/api/learn/modules')).status, 401, 'cookie was cleared; must sign in again');
  assert.equal((await nu.post('/api/auth/login', { employeeId: 'TM900', password: 'Fresh-pass-42' })).status, 200);
});

test('access is scoped by role, brand and outlet', async () => {
  const admin = await as('ADMIN001');
  const inc1 = await as('INC001');
  const fr = await as('FR001');
  const tm = await as('TM002');

  const r1 = (await inc1.get('/api/reports/progress')).data;
  assert.ok(r1.rows.length > 0);
  assert.ok(r1.rows.every((r) => r.outlet_name === 'Andheri'), 'in-charge sees only their outlet');
  assert.equal((await inc1.get(`/api/reports/history/${await idOf('TM003')}`)).status, 404, 'other outlet staff are invisible');
  assert.equal((await inc1.get(`/api/reports/history/${await idOf('TM002')}`)).status, 200);

  const rf = (await fr.get('/api/reports/progress')).data;
  assert.ok(rf.rows.length > 0);
  assert.ok(rf.rows.every((r) => r.outlet_name === 'Bandra'), 'franchisee sees only outlets they own');
  assert.equal((await fr.get(`/api/reports/history/${await idOf('TM002')}`)).status, 404);

  const all = (await admin.get('/api/reports/progress')).data;
  assert.ok(new Set(all.rows.map((r) => r.outlet_name)).size >= 3);

  assert.equal((await tm.get('/api/reports/progress')).status, 403);
  assert.equal((await tm.get('/api/admin/users')).status, 403);
  assert.equal((await inc1.get('/api/admin/modules')).status, 403);
  assert.equal((await inc1.post('/api/admin/users', {})).status, 403);
  const trainer = await as('TRAIN001');
  assert.equal((await trainer.get('/api/admin/modules')).status, 200);
  assert.equal((await trainer.get('/api/admin/users')).status, 403, 'only super admins manage users');

  // brand-restricted recipes
  const burgerRecipe = await ctx.db.one(`SELECT id FROM recipes WHERE name = 'Classic Cheeseburger'`);
  const dosaTm = await as('TM004');
  const dosaList = (await dosaTm.get('/api/recipes')).data;
  assert.deepEqual(dosaList.map((r) => r.name), ['Masala Dosa Batter']);
  assert.equal((await dosaTm.get(`/api/recipes/${burgerRecipe.id}`)).status, 404);
  assert.equal((await dosaTm.get(`/api/media/recipes/${burgerRecipe.id}/video`)).status, 404);
  assert.equal((await tm.get(`/api/recipes/${burgerRecipe.id}`)).status, 200);

  // recipe search (name, category, ingredient) works without any assessment
  assert.equal((await tm.get('/api/recipes?q=cheese')).data.length, 1);
  assert.equal((await tm.get('/api/recipes?q=beef')).data.length, 1);
  assert.equal((await tm.get('/api/recipes?q=zzzz')).data.length, 0);

  // module admin APIs never leak to learners; learner never sees modules that are not theirs
  const dosaModules = (await dosaTm.get('/api/learn/modules')).data.map((m) => m.title);
  assert.ok(!dosaModules.includes('Burger Assembly SOP'));
});

test('csv export is Excel-friendly and neutralises spreadsheet formulas', async () => {
  const admin = await as('ADMIN001');
  const csv = await admin.get('/api/reports/progress.csv');
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const text = csv.data.toString('utf8');
  assert.ok(text.startsWith('\uFEFFEmployee ID,Name,Role'));
  assert.ok(text.includes(`"'=HYPERLINK(""http://evil"")"`), 'formula cells are escaped');
  assert.equal((await (await as('TM002')).get('/api/reports/progress.csv')).status, 403);
});

test('admin actions are written to the audit log', async () => {
  const admin = await as('ADMIN001');
  const log = (await admin.get('/api/admin/audit')).data;
  const actions = new Set(log.map((l) => l.action));
  for (const a of ['auth.login', 'user.create', 'user.deactivate', 'module.publish', 'module.new_version', 'media.play']) assert.ok(actions.has(a), a);
  assert.equal((await (await as('TM002')).get('/api/admin/audit')).status, 403);
});

test('recipes: admin can publish, update and archive; learners only see published', async () => {
  const admin = await as('ADMIN001');
  const tm = await as('TM002');
  const created = await admin.post('/api/admin/recipes', { name: 'Peri Peri Fries', roles: ['team_member'], category: 'Sides', ingredients: [{ name: 'Potato', quantity: '200', unit: 'g' }], steps: ['Fry', 'Season'] });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal((await tm.get(`/api/recipes/${id}`)).status, 404, 'drafts are invisible');
  assert.equal((await admin.patch(`/api/admin/recipes/${id}`, { status: 'published', shelfLife: '2 hours' })).status, 200);
  const seen = await tm.get(`/api/recipes/${id}`);
  assert.equal(seen.data.shelf_life, '2 hours');
  assert.equal(seen.data.ingredients[0].name, 'Potato');
  await admin.patch(`/api/admin/recipes/${id}`, { status: 'archived' });
  assert.equal((await tm.get(`/api/recipes/${id}`)).status, 404);
});

test('repeated failed sign-ins lock only that account; successful sign-ins are never counted', async () => {
  const anon = client(ctx.baseUrl);
  for (let i = 0; i < 3; i++) assert.equal((await anon.post('/api/auth/login', { employeeId: 'TM003', password: 'wrong' })).status, 401);
  const locked = await anon.post('/api/auth/login', { employeeId: 'TM003', password: 'Demo@1234' });
  assert.equal(locked.status, 429, 'even the right password is refused while locked');
  assert.equal(locked.error.code, 'TOO_MANY_ATTEMPTS');
  // everyone else at the same outlet/IP is unaffected, however many times they sign in
  for (let i = 0; i < 6; i++) await as('TM002');
});
