import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { listAttachments } from '../access.js';
import { learnerAccess } from '../auth.js';
import { progressRows } from '../progress-query.js';
import { scoreAttempt, shuffle } from '../scoring.js';
import { withStatus } from '../status.js';
import { HttpError, badRequest, forbidden, notFound } from '../errors.js';

export const router = Router();
router.use(...learnerAccess);

const LIST_FIELDS = [
  'module_id', 'title', 'description', 'category', 'language', 'mandatory', 'sequence', 'version', 'requires_ack', 'pass_mark',
  'max_attempts', 'min_watch_percent', 'duration_seconds', 'has_video', 'prerequisite_title', 'due_at', 'status', 'overdue',
  'best_score', 'attempts_used', 'completed_at',
];

const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row[k]]));

async function loadModule(user, moduleId) {
  const [row] = await progressRows({ userId: user.id, moduleId });
  if (!row) throw notFound('Module not found');
  return row;
}

/** Row for a module the learner may open now (assigned, eligible, prerequisite met). */
async function openModule(user, moduleId) {
  const row = await loadModule(user, moduleId);
  if (!row.prereq_done) throw forbidden(`Complete "${row.prerequisite_title}" first`, 'PREREQUISITE_REQUIRED');
  return row;
}

async function view(user, moduleId) {
  const row = withStatus(await loadModule(user, moduleId));
  const [{ n, written }] = await db.all(
    `SELECT count(*) FILTER (WHERE type <> 'written')::int AS n, count(*) FILTER (WHERE type = 'written')::int AS written FROM questions WHERE module_id = $1`,
    [moduleId],
  );
  return {
    ...pick(row, [...LIST_FIELDS, 'instructions', 'ack_text', 'last_position', 'watched_seconds', 'lesson_completed_at', 'assessment_passed_at', 'acknowledged_at', 'randomize']),
    locked: !row.prereq_done,
    attachments: await listAttachments('module', moduleId),
    scored_questions: n,
    written_questions: written,
    attempts_left: row.max_attempts === 0 ? null : Math.max(0, row.max_attempts - row.attempts_used),
  };
}

const ensureProgress = (c, userId, m) =>
  c.query('INSERT INTO progress (user_id, module_id, version) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, m.module_id, m.version]);

const lockProgress = async (c, userId, m) => {
  await ensureProgress(c, userId, m);
  const { rows } = await c.query('SELECT * FROM progress WHERE user_id = $1 AND module_id = $2 AND version = $3 FOR UPDATE', [userId, m.module_id, m.version]);
  return rows[0];
};

/** Auto-passes modules with nothing to score, and completes the module once everything required is done. */
async function settle(c, m, progressId) {
  const { rows: [{ n }] } = await c.query(`SELECT count(*)::int AS n FROM questions WHERE module_id = $1 AND type <> 'written'`, [m.module_id]);
  if (n === 0) {
    await c.query('UPDATE progress SET assessment_passed_at = now() WHERE id = $1 AND lesson_completed_at IS NOT NULL AND assessment_passed_at IS NULL', [progressId]);
  }
  await c.query(
    `UPDATE progress SET completed_at = now()
     WHERE id = $1 AND completed_at IS NULL AND lesson_completed_at IS NOT NULL AND assessment_passed_at IS NOT NULL
       AND ($2::boolean = false OR acknowledged_at IS NOT NULL)`,
    [progressId, m.requires_ack],
  );
}

router.get('/modules', async (req, res) => {
  const rows = await progressRows({ userId: req.user.id });
  res.json(rows.map((r) => ({ ...pick(withStatus(r), LIST_FIELDS), locked: !r.prereq_done })));
});

router.get('/modules/:id', async (req, res) => {
  const id = Number(req.params.id);
  const row = await openModule(req.user, id);
  await ensureProgress({ query: db.query }, req.user.id, row);
  res.json(await view(req.user, id));
});

/**
 * Video heartbeat. The client says how many seconds it actually played since its last report;
 * the server caps that by real elapsed time, so seeking to the end cannot earn completion.
 */
router.post('/modules/:id/progress', async (req, res) => {
  const id = Number(req.params.id);
  const body = z.object({ position: z.number().min(0), delta: z.number().min(0).max(120), ended: z.boolean().optional() }).parse(req.body);
  const m = await openModule(req.user, id);
  if (!m.has_video) throw badRequest('This module has no video');
  await db.tx(async (c) => {
    const p = await lockProgress(c, req.user.id, m);
    const elapsed = p.last_report_at ? (Date.now() - new Date(p.last_report_at).getTime()) / 1000 : 15;
    const delta = Math.min(body.delta, Math.min(elapsed * 1.25 + 1, 60));
    const duration = m.duration_seconds;
    const watched = duration ? Math.min(p.watched_seconds + delta, duration) : p.watched_seconds + delta;
    const position = duration ? Math.min(body.position, duration) : body.position;
    const lessonDone = Boolean(p.lesson_completed_at) || (duration ? watched >= (duration * m.min_watch_percent) / 100 : body.ended === true);
    await c.query(
      `UPDATE progress SET last_position = $1, watched_seconds = $2, last_report_at = now(),
         lesson_completed_at = COALESCE(lesson_completed_at, CASE WHEN $3::boolean THEN now() END) WHERE id = $4`,
      [position, watched, lessonDone, p.id],
    );
    await settle(c, m, p.id);
  });
  res.json(await view(req.user, id));
});

/** Text-only modules have no video to track, so the learner confirms they have read the lesson. */
router.post('/modules/:id/lesson', async (req, res) => {
  const id = Number(req.params.id);
  const m = await openModule(req.user, id);
  if (m.has_video) throw badRequest('Watch the video to complete this lesson');
  await db.tx(async (c) => {
    const p = await lockProgress(c, req.user.id, m);
    await c.query('UPDATE progress SET lesson_completed_at = COALESCE(lesson_completed_at, now()) WHERE id = $1', [p.id]);
    await settle(c, m, p.id);
  });
  res.json(await view(req.user, id));
});

router.get('/modules/:id/quiz', async (req, res) => {
  const id = Number(req.params.id);
  const m = await openModule(req.user, id);
  if (!m.lesson_completed_at) throw forbidden('Finish the lesson before the assessment', 'LESSON_REQUIRED');
  if (m.assessment_passed_at) throw new HttpError(409, 'ALREADY_PASSED', 'You have already passed this assessment');
  if (m.max_attempts > 0 && m.attempts_used >= m.max_attempts) {
    throw forbidden('No attempts left. Ask your manager to arrange retraining', 'NO_ATTEMPTS_LEFT');
  }
  let questions = await db.all('SELECT id, type, text, options FROM questions WHERE module_id = $1 ORDER BY position, id', [id]);
  if (m.randomize) questions = shuffle(questions);
  res.json({
    passMark: m.pass_mark,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      options: (m.randomize ? shuffle(q.options) : q.options).map((o) => ({ id: o.id, text: o.text })), // never send `correct`
    })),
  });
});

router.post('/modules/:id/attempts', async (req, res) => {
  const id = Number(req.params.id);
  const { answers } = z
    .object({ answers: z.record(z.string(), z.union([z.array(z.string().max(20)).max(8), z.string().max(2000)])) })
    .parse(req.body);
  const m = await openModule(req.user, id);
  if (!m.lesson_completed_at) throw forbidden('Finish the lesson before the assessment', 'LESSON_REQUIRED');
  const questions = await db.all('SELECT id, type, options FROM questions WHERE module_id = $1', [id]);

  const outcome = await db.tx(async (c) => {
    const p = await lockProgress(c, req.user.id, m);
    if (p.assessment_passed_at) throw new HttpError(409, 'ALREADY_PASSED', 'You have already passed this assessment');
    const { rows: [{ used }] } = await c.query(
      `SELECT count(*)::int AS used FROM attempts WHERE user_id = $1 AND module_id = $2 AND version = $3 AND ($4::timestamptz IS NULL OR created_at > $4)`,
      [req.user.id, id, m.version, p.attempts_reset_at],
    );
    if (m.max_attempts > 0 && used >= m.max_attempts) throw forbidden('No attempts left. Ask your manager to arrange retraining', 'NO_ATTEMPTS_LEFT');

    const result = scoreAttempt(questions, answers, m.pass_mark);
    await c.query('INSERT INTO attempts (user_id, module_id, version, score, passed, answers) VALUES ($1,$2,$3,$4,$5,$6)', [
      req.user.id, id, m.version, result.score, result.passed, JSON.stringify(answers),
    ]);
    if (result.passed) {
      await c.query('UPDATE progress SET assessment_passed_at = now() WHERE id = $1', [p.id]);
      await settle(c, m, p.id);
    }
    return result;
  });
  res.json({ ...outcome, passMark: m.pass_mark, module: await view(req.user, id) });
});

router.post('/modules/:id/acknowledge', async (req, res) => {
  const id = Number(req.params.id);
  const m = await openModule(req.user, id);
  await db.tx(async (c) => {
    const p = await lockProgress(c, req.user.id, m);
    if (!p.lesson_completed_at || !p.assessment_passed_at) throw forbidden('Pass the assessment before acknowledging', 'ASSESSMENT_REQUIRED');
    await c.query('UPDATE progress SET acknowledged_at = COALESCE(acknowledged_at, now()) WHERE id = $1', [p.id]);
    await settle(c, m, p.id);
  });
  res.json(await view(req.user, id));
});
