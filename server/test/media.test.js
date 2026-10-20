import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { client, setup, windowAround } from './helpers.js';

let ctx;
let signPlaybackUrl;
let config;
before(async () => {
  ctx = await setup();
  ({ signPlaybackUrl } = await import('../src/bunny.js'));
  ({ config } = await import('../src/config.js'));
});
after(async () => { await ctx.close(); fs.rmSync(process.env.LOCAL_STORAGE_DIR, { recursive: true, force: true }); });

const as = async (employeeId) => { const c = client(ctx.baseUrl); await c.login(employeeId); return c; };
const idOf = async (employeeId) => (await ctx.db.one('SELECT id FROM users WHERE employee_id = $1', [employeeId])).id;
const newVideo = async (admin, title = 'clip.mp4') => (await admin.post('/api/admin/videos', { title })).data.videoId;
const cdn = (url) => fetch(url);

let admin;
let tm;
let module; // published lesson with a Bunny video, assigned to TM002
let videoId;

test('video upload: the app signs a resumable upload straight to Bunny and never reveals the API key', async () => {
  admin = await as('ADMIN001');
  const res = await admin.post('/api/admin/videos', { title: 'Plating demo.mp4' });
  assert.equal(res.status, 201);
  const { videoId: id, upload } = res.data;
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(upload.endpoint, `${ctx.bunny.url}/tusupload`);
  const expire = upload.headers.AuthorizationExpire;
  const want = crypto.createHash('sha256').update(`${ctx.bunny.libraryId}${ctx.bunny.apiKey}${expire}${id}`).digest('hex');
  assert.equal(upload.headers.AuthorizationSignature, want, 'signature = sha256(library + key + expire + video)');
  assert.equal(upload.headers.VideoId, id);
  assert.equal(upload.headers.LibraryId, ctx.bunny.libraryId);
  assert.ok(Number(expire) > Date.now() / 1000 + 3000, 'valid for long enough to finish the upload');
  assert.ok(!JSON.stringify(res.data).includes(ctx.bunny.apiKey), 'the library API key never leaves the server');
  assert.ok(ctx.bunny.videos.has(id), 'the video object exists on Bunny');

  assert.equal((await (await as('TM002')).post('/api/admin/videos', { title: 'x' })).status, 403);
  assert.equal((await client(ctx.baseUrl).post('/api/admin/videos', { title: 'x' })).status, 401);
  assert.equal((await (await as('TRAIN001')).post('/api/admin/videos', { title: 'ok' })).status, 201, 'training admins may upload');

  // processing status as the admin sees it
  assert.equal((await admin.get(`/api/admin/videos/${id}`)).data.state, 'created');
  ctx.bunny.set(id, 3, 40);
  assert.deepEqual((await admin.get(`/api/admin/videos/${id}`)).data, { state: 'transcoding', ready: false, progress: 40, length: 0, resolutions: '' });
  ctx.bunny.finish(id, { length: 95 });
  const done = (await admin.get(`/api/admin/videos/${id}`)).data;
  assert.deepEqual([done.state, done.ready, done.length], ['ready', true, 95]);
  assert.equal((await admin.get('/api/admin/videos/not-a-guid')).status, 400);
  assert.equal((await admin.get(`/api/admin/videos/${crypto.randomUUID()}`)).status, 404);
  assert.deepEqual((await admin.get('/api/admin/videos/config')).data, { enabled: true, tokenTtlSeconds: 600 });
});

test('a module cannot be published until Bunny has finished converting its video; the length comes from Bunny', async () => {
  videoId = await newVideo(admin, 'lesson.mp4');
  module = (await admin.post('/api/admin/modules', { title: 'Plating Demo', roles: ['team_member'], videoId, minWatchPercent: 90, instructions: 'Watch the demo' })).data;
  assert.equal(module.duration_seconds, null, 'not converted yet, so no length');

  const early = await admin.post(`/api/admin/modules/${module.id}/publish`);
  assert.equal(early.status, 400);
  assert.equal(early.error.code, 'VIDEO_NOT_READY');
  assert.match(early.error.message, /still being processed/);

  ctx.bunny.finish(videoId, { length: 100 });
  assert.equal((await admin.post(`/api/admin/modules/${module.id}/publish`)).status, 200);
  assert.equal((await admin.get(`/api/admin/modules/${module.id}`)).data.duration_seconds, 100);
  assert.equal((await admin.patch(`/api/admin/modules/${module.id}`, { videoId: crypto.randomUUID() })).status, 400, 'unknown Bunny video is refused');
  assert.equal((await admin.patch(`/api/admin/modules/${module.id}`, { videoId: 'nope' })).status, 400);

  const assigned = await admin.post(`/api/admin/modules/${module.id}/assign`, { userIds: [await idOf('TM002')] });
  assert.equal(assigned.data.assigned, 1);
});

test('playback: access is checked, then a short-lived signed HLS URL is issued that Bunny honours only for that video', async () => {
  tm = await as('TM002');
  const res = await tm.post('/api/media/playback', { type: 'module', id: module.id });
  assert.equal(res.status, 200);
  assert.equal(res.data.ttlSeconds, 600);
  const dir = encodeURIComponent(`/${videoId}/`);
  assert.match(res.data.url, new RegExp(`^${ctx.bunny.url}/bcdn_token=HS256-[\\w-]+&token_path=${dir}&expires=\\d+/${videoId}/playlist\\.m3u8$`));
  assert.ok(Math.abs(new Date(res.data.expiresAt) - (Date.now() + 600_000)) < 5000);

  assert.equal((await cdn(res.data.url)).status, 200);
  assert.match(await (await cdn(res.data.url)).text(), /^#EXTM3U/);
  assert.equal((await cdn(res.data.url.replace('HS256-', 'HS256-X'))).status, 403, 'tampered token');
  assert.equal((await cdn(res.data.url.replace(`/${videoId}/playlist`, `/${crypto.randomUUID()}/playlist`))).status, 403, 'token covers only this video');
  assert.equal((await cdn(signPlaybackUrl(videoId, -5).url)).status, 403, 'expired token');
  assert.equal((await cdn(`${ctx.bunny.url}/${videoId}/playlist.m3u8`)).status, 404, 'no token: not served');

  // nobody else gets a URL
  assert.equal((await (await as('TM004')).post('/api/media/playback', { type: 'module', id: module.id })).status, 404, 'not assigned');
  assert.equal((await (await as('INC002')).post('/api/media/playback', { type: 'module', id: module.id })).status, 404, 'wrong role');
  assert.equal((await client(ctx.baseUrl).post('/api/media/playback', { type: 'module', id: module.id })).status, 401);
  assert.equal((await tm.post('/api/media/playback', { type: 'module', id: 99999 })).status, 404);
  assert.equal((await tm.post('/api/media/playback', { type: 'bogus', id: 1 })).status, 400);

  // first play is audited; token renewals are not
  await tm.post('/api/media/playback', { type: 'module', id: module.id, renew: true });
  const plays = (await admin.get('/api/admin/audit')).data.filter((l) => l.action === 'media.play' && l.entity_id === String(module.id));
  assert.equal(plays.length, 1, 'the successful first play was audited; rejected requests and the renewal were not');
});

test('viewing progress is measured, not claimed: seeking earns nothing, real watching completes the lesson', async () => {
  const seek = await tm.post(`/api/learn/modules/${module.id}/progress`, { position: 100, delta: 100 });
  assert.ok(seek.data.watched_seconds < 25, `capped, got ${seek.data.watched_seconds}`);
  assert.equal(seek.data.lesson_completed_at, null);
  await ctx.db.query(`UPDATE progress SET watched_seconds = 85, last_report_at = now() - interval '100 seconds' WHERE user_id = $1 AND module_id = $2`, [await idOf('TM002'), module.id]);
  const watched = await tm.post(`/api/learn/modules/${module.id}/progress`, { position: 95, delta: 10 });
  assert.ok(watched.data.lesson_completed_at);
  assert.equal(watched.data.status, 'ack_pending', 'no questions: lesson done -> only the acknowledgement is left');
  assert.equal((await tm.get(`/api/learn/modules/${module.id}`)).data.last_position, 95, 'resume position is saved');
  assert.equal((await tm.post(`/api/learn/modules/${module.id}/acknowledge`)).data.status, 'completed');
});

test('shift end and access removal stop new playback URLs immediately', async () => {
  const uid = await idOf('TM002');
  const outside = windowAround(2, 3);
  await admin.patch(`/api/admin/users/${uid}`, { shiftStart: outside.start, shiftEnd: outside.end });
  const locked = await tm.post('/api/media/playback', { type: 'module', id: module.id, renew: true });
  assert.equal(locked.status, 403);
  assert.equal(locked.error.code, 'OUTSIDE_SHIFT');
  await admin.patch(`/api/admin/users/${uid}`, { shiftStart: null, shiftEnd: null });
  assert.equal((await tm.post('/api/media/playback', { type: 'module', id: module.id, renew: true })).status, 200);

  assert.equal((await admin.post(`/api/admin/users/${uid}/deactivate`)).status, 200);
  const blocked = await tm.post('/api/media/playback', { type: 'module', id: module.id, renew: true });
  assert.equal(blocked.status, 401);
  assert.equal(blocked.error.code, 'ACCOUNT_DEACTIVATED');
  await admin.post(`/api/admin/users/${uid}/reactivate`);
  tm = await as('TM002');
});

test('video hosting not configured: clear errors, text lessons still work', async () => {
  const saved = config.bunny.apiKey;
  config.bunny.apiKey = '';
  try {
    const r = await admin.post('/api/admin/videos', { title: 'x' });
    assert.equal(r.status, 503);
    assert.equal(r.error.code, 'VIDEO_NOT_CONFIGURED');
    assert.equal((await tm.post('/api/media/playback', { type: 'module', id: module.id })).error.code, 'VIDEO_NOT_CONFIGURED');
    assert.equal((await admin.get('/api/admin/videos/config')).data.enabled, false);
    assert.equal((await tm.get('/api/learn/modules')).status, 200);
  } finally {
    config.bunny.apiKey = saved;
  }
});

test('new version with a replaced video waits for the new video, takes its length, and snapshots attachments', async () => {
  const pdfSlot = (await admin.post('/api/admin/uploads', { kind: 'pdf', filename: 'Plating guide.pdf', contentType: 'application/pdf' })).data;
  assert.equal((await admin.put(pdfSlot.url, Buffer.from('%PDF-1.4 fake'), { 'Content-Type': 'application/pdf' })).status, 200);
  assert.equal((await admin.post('/api/admin/attachments', { moduleId: module.id, kind: 'pdf', title: 'Plating guide', fileKey: pdfSlot.key })).status, 201);

  const v2 = await newVideo(admin, 'lesson-v2.mp4');
  await admin.patch(`/api/admin/modules/${module.id}`, { videoId: v2 });
  assert.equal((await admin.get(`/api/admin/modules/${module.id}`)).data.duration_seconds, null, 'length unknown until the new video is converted');
  const early = await admin.post(`/api/admin/modules/${module.id}/new-version`, { changeType: 'retrain', note: 'New video' });
  assert.equal(early.error.code, 'VIDEO_NOT_READY');
  assert.equal((await ctx.db.one('SELECT version FROM modules WHERE id = $1', [module.id])).version, 1, 'nothing changed');

  ctx.bunny.finish(v2, { length: 140 });
  const ok = await admin.post(`/api/admin/modules/${module.id}/new-version`, { changeType: 'retrain', note: 'New video' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.version, 2);
  assert.equal(ok.data.duration_seconds, 140);
  const snap = await ctx.db.one('SELECT snapshot FROM module_versions WHERE module_id = $1 AND version = 2', [module.id]);
  assert.deepEqual(snap.snapshot.attachments.map((a) => [a.kind, a.title]), [['pdf', 'Plating guide']]);
  assert.equal(snap.snapshot.module.video_id, v2, 'the version records which video it used');
  const v1 = await ctx.db.one('SELECT snapshot FROM module_versions WHERE module_id = $1 AND version = 1', [module.id]);
  assert.equal(v1.snapshot.module.video_id, videoId, 'version 1 still points at the original video');
});

let attModule;
test('attachments: PDF, image and video on a module, shown only to people who may see the module', async () => {
  attModule = (await admin.post('/api/admin/modules', { title: 'Allergen Guide', roles: ['team_member'], instructions: 'Read the sheet.' })).data;
  await admin.post(`/api/admin/modules/${attModule.id}/publish`);
  await admin.post(`/api/admin/modules/${attModule.id}/assign`, { userIds: [await idOf('TM002')] });

  const upload = async (kind, filename, contentType, bytes) => {
    const slot = (await admin.post('/api/admin/uploads', { kind, filename, contentType })).data;
    assert.equal((await admin.put(slot.url, bytes, { 'Content-Type': contentType })).status, 200);
    return slot.key;
  };
  const pdfBytes = Buffer.from('%PDF-1.4\n% allergen sheet');
  const pdfKey = await upload('pdf', 'allergens.pdf', 'application/pdf', pdfBytes);
  const imgKey = await upload('image', 'chart.png', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
  const clip = await newVideo(admin, 'extra.mp4');

  // validation
  assert.equal((await admin.post('/api/admin/uploads', { kind: 'video', filename: 'a.mp4', contentType: 'video/mp4' })).status, 400, 'videos go to Bunny, not storage');
  assert.equal((await admin.post('/api/admin/uploads', { kind: 'pdf', filename: 'a.pdf', contentType: 'image/png' })).status, 400, 'type must match kind');
  assert.equal((await admin.post('/api/admin/attachments', { moduleId: attModule.id, kind: 'image', title: 'x', fileKey: pdfKey })).status, 400, 'a PDF key cannot be attached as an image');
  assert.equal((await admin.post('/api/admin/attachments', { moduleId: attModule.id, recipeId: 1, kind: 'pdf', title: 'x', fileKey: pdfKey })).status, 400, 'one owner only');
  assert.equal((await admin.post('/api/admin/attachments', { moduleId: attModule.id, kind: 'pdf', title: 'x', fileKey: '../../etc/passwd' })).status, 400);
  assert.equal((await admin.post('/api/admin/attachments', { moduleId: attModule.id, kind: 'video', title: 'x', videoId: crypto.randomUUID() })).status, 400, 'video must exist on Bunny');
  const ghost = await admin.post('/api/admin/attachments', { moduleId: attModule.id, kind: 'image', title: 'x', fileKey: `images/${crypto.randomUUID()}/ghost.png` });
  assert.equal(ghost.status, 400);
  assert.match(ghost.error.message, /not been uploaded/);
  assert.equal((await admin.post('/api/admin/attachments', { moduleId: 99999, kind: 'pdf', title: 'x', fileKey: pdfKey })).status, 404);
  assert.equal((await tm.post('/api/admin/attachments', { moduleId: attModule.id, kind: 'pdf', title: 'x', fileKey: pdfKey })).status, 403);

  const pdf = (await admin.post('/api/admin/attachments', { moduleId: attModule.id, kind: 'pdf', title: 'Allergen sheet', fileKey: pdfKey })).data;
  const img = (await admin.post('/api/admin/attachments', { moduleId: attModule.id, kind: 'image', title: 'Allergen chart', fileKey: imgKey })).data;
  const vid = (await admin.post('/api/admin/attachments', { moduleId: attModule.id, kind: 'video', title: 'Extra clip', videoId: clip })).data;
  assert.deepEqual([pdf.position, img.position, vid.position], [0, 1, 2]);
  assert.equal(pdf.content_type, 'application/pdf');
  assert.equal(Number(pdf.size_bytes), pdfBytes.length, 'size is read from the stored file');
  assert.equal(img.content_type, 'image/png');

  // admin view lists them; learner view lists them without storage keys or Bunny IDs
  assert.equal((await admin.get(`/api/admin/modules/${attModule.id}`)).data.attachments.length, 3);
  const view = (await tm.get(`/api/learn/modules/${attModule.id}`)).data;
  assert.deepEqual(view.attachments.map((a) => [a.kind, a.title]), [['pdf', 'Allergen sheet'], ['image', 'Allergen chart'], ['video', 'Extra clip']]);
  assert.ok(!JSON.stringify(view.attachments).includes('allergens.pdf') && !JSON.stringify(view.attachments).includes(clip), 'no keys or IDs for learners');

  // PDF / image bytes are served inline, never cached, with range support
  const file = await tm.get(`/api/media/attachments/${pdf.id}/file`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.match(file.headers.get('content-disposition'), /^inline/);
  assert.match(file.headers.get('cache-control'), /no-store/);
  assert.ok(file.data.equals(pdfBytes));
  const part = await tm.get(`/api/media/attachments/${pdf.id}/file`, { Range: 'bytes=0-4' });
  assert.equal(part.status, 206);
  assert.equal(part.data.toString(), '%PDF-');
  assert.equal((await tm.get(`/api/media/attachments/${img.id}/file`)).headers.get('content-type'), 'image/png');
  assert.equal((await tm.get(`/api/media/attachments/${vid.id}/file`)).status, 404, 'videos are never served as files');

  // an attached video plays through Bunny, once it is converted
  const notReady = await admin.post(`/api/admin/modules/${attModule.id}/new-version`, { changeType: 'reack', note: 'n' });
  assert.equal(notReady.error.code, 'VIDEO_NOT_READY');
  assert.match(notReady.error.message, /Extra clip/);
  ctx.bunny.finish(clip, { length: 30 });
  const play = await tm.post('/api/media/playback', { type: 'attachment', id: vid.id });
  assert.equal(play.status, 200);
  assert.equal((await cdn(play.data.url)).status, 200);
  assert.ok(play.data.url.includes(encodeURIComponent(`/${clip}/`)));
  assert.equal((await tm.post('/api/media/playback', { type: 'attachment', id: pdf.id })).status, 404, 'only video attachments have playback');

  // others cannot reach them
  for (const who of ['TM004', 'INC002']) {
    const other = await as(who);
    assert.equal((await other.get(`/api/media/attachments/${pdf.id}/file`)).status, 404, who);
    assert.equal((await other.post('/api/media/playback', { type: 'attachment', id: vid.id })).status, 404, who);
  }
  assert.equal((await client(ctx.baseUrl).get(`/api/media/attachments/${pdf.id}/file`)).status, 401);

  // outside the shift they are locked too
  const uid = await idOf('TM002');
  const outside = windowAround(2, 3);
  await admin.patch(`/api/admin/users/${uid}`, { shiftStart: outside.start, shiftEnd: outside.end });
  assert.equal((await tm.get(`/api/media/attachments/${pdf.id}/file`)).error.code, 'OUTSIDE_SHIFT');
  await admin.patch(`/api/admin/users/${uid}`, { shiftStart: null, shiftEnd: null });

  // rename, then remove (the stored file stays, so earlier versions still work)
  assert.equal((await admin.patch(`/api/admin/attachments/${pdf.id}`, { title: 'Allergen sheet v2' })).data.title, 'Allergen sheet v2');
  assert.equal((await admin.delete(`/api/admin/attachments/${pdf.id}`)).status, 200);
  assert.equal((await tm.get(`/api/media/attachments/${pdf.id}/file`)).status, 404);
  assert.equal((await tm.get(`/api/learn/modules/${attModule.id}`)).data.attachments.length, 2);
  assert.ok(fs.existsSync(`${process.env.LOCAL_STORAGE_DIR}/${pdfKey}`));
});

test('recipes: video and attachments follow the same brand/role rules', async () => {
  const slot = (await admin.post('/api/admin/uploads', { kind: 'image', filename: 'plated.jpg', contentType: 'image/jpeg' })).data;
  await admin.put(slot.url, Buffer.from('jpeg-bytes'), { 'Content-Type': 'image/jpeg' });
  const rv = await newVideo(admin, 'recipe.mp4');
  const burger = await ctx.db.one(`SELECT id FROM brands WHERE name = 'Burger Barn'`);
  const recipe = (await admin.post('/api/admin/recipes', { name: 'Smash Burger', brandId: burger.id, roles: ['team_member'], videoId: rv, imageKey: slot.key })).data;

  const early = await admin.patch(`/api/admin/recipes/${recipe.id}`, { status: 'published' });
  assert.equal(early.error.code, 'VIDEO_NOT_READY', 'cannot publish a recipe whose video is still converting');
  ctx.bunny.finish(rv, { length: 60 });
  assert.equal((await admin.patch(`/api/admin/recipes/${recipe.id}`, { status: 'published' })).status, 200);

  const pdfKey = (await (async () => { const s = (await admin.post('/api/admin/uploads', { kind: 'pdf', filename: 'card.pdf', contentType: 'application/pdf' })).data; await admin.put(s.url, Buffer.from('%PDF-1.4 card'), { 'Content-Type': 'application/pdf' }); return s.key; })());
  const att = (await admin.post('/api/admin/attachments', { recipeId: recipe.id, kind: 'pdf', title: 'Prep card', fileKey: pdfKey })).data;
  assert.equal((await admin.get(`/api/admin/recipes/${recipe.id}`)).data.attachments.length, 1);

  const burgerStaff = await as('TM002');
  const detail = (await burgerStaff.get(`/api/recipes/${recipe.id}`)).data;
  assert.equal(detail.has_video, true);
  assert.deepEqual(detail.attachments.map((a) => a.title), ['Prep card']);
  assert.equal((await burgerStaff.post('/api/media/playback', { type: 'recipe', id: recipe.id })).status, 200);
  assert.equal((await burgerStaff.get(`/api/media/attachments/${att.id}/file`)).status, 200);
  assert.equal((await burgerStaff.get(`/api/media/recipes/${recipe.id}/image`)).data.toString(), 'jpeg-bytes');

  const dosaStaff = await as('TM004'); // different brand
  assert.equal((await dosaStaff.get(`/api/recipes/${recipe.id}`)).status, 404);
  assert.equal((await dosaStaff.post('/api/media/playback', { type: 'recipe', id: recipe.id })).status, 404);
  assert.equal((await dosaStaff.get(`/api/media/attachments/${att.id}/file`)).status, 404);
  assert.equal((await dosaStaff.get(`/api/media/recipes/${recipe.id}/image`)).status, 404);

  // replacing a published recipe's video with one that is not ready is refused
  const nv = await newVideo(admin, 'recipe2.mp4');
  assert.equal((await admin.patch(`/api/admin/recipes/${recipe.id}`, { videoId: nv })).error.code, 'VIDEO_NOT_READY');
});
