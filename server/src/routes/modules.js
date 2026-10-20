import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { audit } from '../audit.js';
import { authenticate, requireAdmin, requireFreshPassword } from '../auth.js';
import { assignModules } from '../assign.js';
import { progressRows } from '../progress-query.js';
import { withStatus } from '../status.js';
import { VIDEO_ID, bunnyEnabled, getVideo, requireBunny } from '../bunny.js';
import { listAttachments } from '../access.js';
import { badRequest, notFound } from '../errors.js';
import { insertSql, updateSql } from '../sql.js';

export const router = Router();
router.use(authenticate, requireFreshPassword, requireAdmin);

const LEARNER_ROLES = ['team_member', 'outlet_incharge', 'franchisee'];
const videoId = z.string().regex(VIDEO_ID, 'Invalid video').nullable().optional();

const fields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  language: z.string().trim().min(2).max(10).optional(),
  videoId,
  instructions: z.string().max(20000).optional(),
  brandId: z.number().int().nullable().optional(),
  roles: z.array(z.enum(LEARNER_ROLES)).min(1),
  mandatory: z.boolean().optional(),
  sequence: z.number().int().min(0).max(10000).optional(),
  prerequisiteId: z.number().int().nullable().optional(),
  defaultDueDays: z.number().int().min(1).max(365).optional(),
  minWatchPercent: z.number().int().min(0).max(100).optional(),
  passMark: z.number().int().min(0).max(100).optional(),
  maxAttempts: z.number().int().min(0).max(20).optional(),
  randomize: z.boolean().optional(),
  requiresAck: z.boolean().optional(),
  ackText: z.string().trim().min(1).max(1000).optional(),
};
const createBody = z.object(fields);
const patchBody = z.object(fields).partial();

const questionBody = z
  .object({
    type: z.enum(['single', 'multiple', 'written']),
    text: z.string().trim().min(1).max(1000),
    options: z.array(z.object({ id: z.string().min(1).max(20), text: z.string().trim().min(1).max(500), correct: z.boolean() })).max(8).default([]),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'written') return;
    const correct = q.options.filter((o) => o.correct).length;
    if (q.options.length < 2) ctx.addIssue({ code: 'custom', message: `"${q.text}" needs at least 2 options` });
    if (q.type === 'single' && correct !== 1) ctx.addIssue({ code: 'custom', message: `"${q.text}" must have exactly one correct option` });
    if (q.type === 'multiple' && correct < 1) ctx.addIssue({ code: 'custom', message: `"${q.text}" needs at least one correct option` });
  });

const getModule = async (id, q = db.one.bind(db)) => {
  const m = await q('SELECT * FROM modules WHERE id = $1', [id]);
  if (!m) throw notFound('Module not found');
  return m;
};

/** Length in seconds of a finished Bunny video; throws if it is missing or still being converted. */
async function readyVideoLength(videoId, label = 'The video') {
  requireBunny();
  const v = await getVideo(videoId);
  if (!v) throw badRequest(`${label} was not found in the video library`);
  if (!v.ready) {
    throw badRequest(`${label} is still being processed (${v.state}${v.progress ? ` ${v.progress}%` : ''}). Try again in a few minutes.`, 'VIDEO_NOT_READY');
  }
  return v.length;
}

/** Everything video-related that must be in order before staff see a module. Returns the lesson video's length. */
async function checkVideos(moduleId, mainVideoId) {
  const length = mainVideoId ? await readyVideoLength(mainVideoId, 'The lesson video') : null;
  const extra = await db.all(`SELECT title, video_id FROM attachments WHERE module_id = $1 AND kind = 'video'`, [moduleId]);
  for (const a of extra) await readyVideoLength(a.video_id, `The attached video “${a.title}”`);
  return length;
}

/** When the lesson video changes, take its length from Bunny (viewing-time rules need it). */
async function videoFields(videoId) {
  if (videoId === undefined) return {};
  if (!videoId) return { durationSeconds: null };
  requireBunny();
  const v = await getVideo(videoId);
  if (!v) throw badRequest('That video was not found in the video library');
  return { durationSeconds: v.ready && v.length ? v.length : null };
}

const adminAttachments = (moduleId) =>
  db.all('SELECT id, kind, title, content_type, size_bytes, video_id FROM attachments WHERE module_id = $1 ORDER BY position, id', [moduleId]);

const getQuestions = (moduleId) => db.all('SELECT id, position, type, text, options FROM questions WHERE module_id = $1 ORDER BY position, id', [moduleId]);

async function snapshot(c, module, changeType, note, userId) {
  const { rows: questions } = await c.query('SELECT type, text, options FROM questions WHERE module_id = $1 ORDER BY position, id', [module.id]);
  const { rows: attachments } = await c.query('SELECT kind, title, file_key, video_id, content_type FROM attachments WHERE module_id = $1 ORDER BY position, id', [module.id]);
  const { password_hash, ...rest } = module;
  await c.query(
    `INSERT INTO module_versions (module_id, version, change_type, note, snapshot, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (module_id, version) DO NOTHING`,
    [module.id, module.version, changeType, note ?? null, JSON.stringify({ module: rest, questions, attachments }), userId],
  );
}

router.get('/', async (_req, res) => {
  res.json(
    await db.all(
      `SELECT m.id, m.title, m.category, m.language, m.status, m.version, m.mandatory, m.sequence, m.roles, m.brand_id, b.name AS brand_name,
              (SELECT count(*)::int FROM assignments a WHERE a.module_id = m.id) AS assigned,
              (SELECT count(*)::int FROM progress p WHERE p.module_id = m.id AND p.version = m.version AND p.completed_at IS NOT NULL) AS completed,
              m.updated_at
       FROM modules m LEFT JOIN brands b ON b.id = m.brand_id
       ORDER BY (m.status = 'archived'), m.sequence, m.id`,
    ),
  );
});

router.post('/', async (req, res) => {
  const body = createBody.parse(req.body);
  Object.assign(body, await videoFields(body.videoId));
  const { text, params } = insertSql('modules', { ...body, createdBy: req.user.id });
  const m = await db.one(text, params).catch((err) => {
    if (err.code === '23503') throw badRequest('Unknown brand or prerequisite module');
    throw err;
  });
  audit(req, 'module.create', 'module', m.id, { title: m.title });
  res.status(201).json(m);
});

router.get('/:id', async (req, res) => {
  const m = await getModule(Number(req.params.id));
  res.json({ ...m, questions: await getQuestions(m.id), attachments: await adminAttachments(m.id) });
});

router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await getModule(id);
  const body = patchBody.parse(req.body);
  if (body.prerequisiteId === id) throw badRequest('A module cannot be its own prerequisite');
  Object.assign(body, await videoFields(body.videoId));
  const stmt = updateSql('modules', id, body);
  if (!stmt) throw badRequest('Nothing to update');
  const m = await db.one(stmt.text, stmt.params).catch((err) => {
    if (err.code === '23503') throw badRequest('Unknown brand or prerequisite module');
    throw err;
  });
  audit(req, 'module.update', 'module', id, { fields: Object.keys(body) });
  res.json(m);
});

router.put('/:id/questions', async (req, res) => {
  const id = Number(req.params.id);
  await getModule(id);
  const { questions } = z.object({ questions: z.array(questionBody).max(100) }).parse(req.body);
  await db.tx(async (c) => {
    await c.query('DELETE FROM questions WHERE module_id = $1', [id]);
    for (const [i, q] of questions.entries()) {
      await c.query('INSERT INTO questions (module_id, position, type, text, options) VALUES ($1,$2,$3,$4,$5)', [
        id, i, q.type, q.text, JSON.stringify(q.type === 'written' ? [] : q.options),
      ]);
    }
  });
  audit(req, 'module.questions_update', 'module', id, { count: questions.length });
  res.json(await getQuestions(id));
});

router.post('/:id/publish', async (req, res) => {
  const id = Number(req.params.id);
  const current = await getModule(id);
  if (current.status === 'published') return res.json(current);
  if (!current.video_id && !current.instructions.trim()) throw badRequest('Add a video or written instructions before publishing');
  const length = await checkVideos(id, current.video_id); // talks to Bunny, so done before taking the row lock
  const m = await db.tx(async (c) => {
    const module = await getModule(id, async (t, p) => (await c.query(`${t} FOR UPDATE`, p)).rows[0]);
    if (module.status === 'published') return module;
    const { rows } = await c.query(
      `UPDATE modules SET status = 'published', duration_seconds = COALESCE($2::int, duration_seconds), updated_at = now() WHERE id = $1 RETURNING *`,
      [id, length],
    );
    await snapshot(c, rows[0], 'initial', 'Published', req.user.id);
    return rows[0];
  });
  audit(req, 'module.publish', 'module', id, { version: m.version });
  res.json(m);
});

router.post('/:id/archive', async (req, res) => {
  const id = Number(req.params.id);
  const m = await db.one(`UPDATE modules SET status = 'archived', updated_at = now() WHERE id = $1 RETURNING *`, [id]);
  if (!m) throw notFound('Module not found');
  audit(req, 'module.archive', 'module', id);
  res.json(m);
});

/**
 * Starts a new version of a published module.
 *  retrain – everyone must redo the module (earlier completions stay on record against the old version)
 *  reack   – lesson/assessment progress carries over, but everyone must acknowledge again
 */
router.post('/:id/new-version', async (req, res) => {
  const id = Number(req.params.id);
  const body = z
    .object({ changeType: z.enum(['retrain', 'reack']), note: z.string().trim().min(1).max(500), dueDays: z.number().int().min(1).max(365).optional() })
    .parse(req.body);
  const before = await getModule(id);
  if (before.status !== 'published') throw badRequest('Only a published module can get a new version');
  const length = await checkVideos(id, before.video_id); // the new version must not go live with an unfinished video
  const m = await db.tx(async (c) => {
    const current = await getModule(id, async (t, p) => (await c.query(`${t} FOR UPDATE`, p)).rows[0]);
    if (current.status !== 'published') throw badRequest('Only a published module can get a new version');
    const { rows } = await c.query(
      'UPDATE modules SET version = version + 1, duration_seconds = COALESCE($2::int, duration_seconds), updated_at = now() WHERE id = $1 RETURNING *',
      [id, length],
    );
    const next = rows[0];
    await snapshot(c, next, body.changeType, body.note, req.user.id);
    if (body.changeType === 'reack') {
      await c.query(
        `INSERT INTO progress (user_id, module_id, version, last_position, watched_seconds, lesson_completed_at, assessment_passed_at)
         SELECT user_id, module_id, $2, last_position, watched_seconds, lesson_completed_at, assessment_passed_at
         FROM progress WHERE module_id = $1 AND version = $3
         ON CONFLICT DO NOTHING`,
        [id, next.version, current.version],
      );
    }
    await c.query(
      `UPDATE assignments SET due_at = now() + (COALESCE($2::int, $3::int) * interval '1 day') WHERE module_id = $1`,
      [id, body.dueDays ?? null, next.default_due_days],
    );
    return next;
  });
  audit(req, 'module.new_version', 'module', id, { version: m.version, changeType: body.changeType, note: body.note });
  res.json(m);
});

router.get('/:id/versions', async (req, res) => {
  const id = Number(req.params.id);
  await getModule(id);
  res.json(
    await db.all(
      `SELECT v.version, v.change_type, v.note, v.created_at, u.name AS created_by,
              (SELECT count(*)::int FROM progress p WHERE p.module_id = v.module_id AND p.version = v.version AND p.completed_at IS NOT NULL) AS completions
       FROM module_versions v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.module_id = $1 ORDER BY v.version DESC`,
      [id],
    ),
  );
});

router.get('/:id/assignments', async (req, res) => {
  const rows = await progressRows({ moduleId: Number(req.params.id) });
  res.json(
    rows.map((r) => withStatus(r)).map((r) => ({
      user_id: r.user_id, user_name: r.user_name, employee_id: r.employee_id, role: r.user_role, outlet_name: r.outlet_name,
      due_at: r.due_at, status: r.status, overdue: r.overdue, best_score: r.best_score, attempts_used: r.attempts_used,
      max_attempts: r.max_attempts,
    })),
  );
});

router.post('/:id/assign', async (req, res) => {
  const id = Number(req.params.id);
  const m = await getModule(id);
  if (m.status !== 'published') throw badRequest('Publish the module before assigning it');
  const body = z
    .object({
      userIds: z.array(z.number().int()).max(5000).optional(),
      role: z.enum(LEARNER_ROLES).optional(),
      brandId: z.number().int().optional(),
      outletId: z.number().int().optional(),
      dueDays: z.number().int().min(1).max(365).optional(),
    })
    .parse(req.body);
  let userIds = body.userIds;
  if (!userIds) {
    userIds = (
      await db.all(
        `SELECT id FROM users WHERE is_active AND role = ANY($1)
           AND ($2::text IS NULL OR role = $2) AND ($3::int IS NULL OR brand_id = $3) AND ($4::int IS NULL OR outlet_id = $4)`,
        [LEARNER_ROLES, body.role ?? null, body.brandId ?? null, body.outletId ?? null],
      )
    ).map((u) => u.id);
  }
  const assigned = await assignModules(db.query, { moduleIds: [id], userIds, assignedBy: req.user.id, dueDays: body.dueDays ?? null });
  audit(req, 'module.assign', 'module', id, { targets: userIds.length, assigned, filter: { ...body, userIds: body.userIds?.length } });
  res.json({ assigned, alreadyAssignedOrNotEligible: userIds.length - assigned });
});

router.delete('/:id/assignments/:userId', async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM assignments WHERE module_id = $1 AND user_id = $2', [Number(req.params.id), Number(req.params.userId)]);
  if (!rowCount) throw notFound('Assignment not found');
  audit(req, 'module.unassign', 'module', req.params.id, { userId: Number(req.params.userId) });
  res.json({ ok: true });
});

/** Gives a learner who ran out of attempts (and has not completed) a fresh go: attempts and lesson progress restart. */
router.post('/:id/retake/:userId', async (req, res) => {
  const { rowCount } = await db.query(
    `UPDATE progress p SET attempts_reset_at = now(), watched_seconds = 0, last_position = 0, last_report_at = NULL,
            lesson_completed_at = NULL, assessment_passed_at = NULL, acknowledged_at = NULL
     FROM modules m
     WHERE m.id = p.module_id AND p.version = m.version AND p.module_id = $1 AND p.user_id = $2 AND p.completed_at IS NULL`,
    [Number(req.params.id), Number(req.params.userId)],
  );
  if (!rowCount) throw badRequest('Nothing to reset: the learner has not started this module or has already completed it');
  audit(req, 'module.retake', 'module', req.params.id, { userId: Number(req.params.userId) });
  res.json({ ok: true });
});
