import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinShift, shiftInfo } from '../src/shift.js';
import { scoreAttempt } from '../src/scoring.js';
import { computeStatus, isOverdue } from '../src/status.js';

// 2026-01-15 10:30 in Asia/Kolkata (UTC+5:30) is 05:00 UTC
const at = (hhmmIst) => new Date(`2026-01-15T${hhmmIst}:00+05:30`);

test('shift window: inside, outside and boundaries (end is exclusive)', () => {
  assert.equal(isWithinShift('09:00', '18:00', at('10:30'), 'Asia/Kolkata'), true);
  assert.equal(isWithinShift('09:00', '18:00', at('08:59'), 'Asia/Kolkata'), false);
  assert.equal(isWithinShift('09:00', '18:00', at('09:00'), 'Asia/Kolkata'), true);
  assert.equal(isWithinShift('09:00', '18:00', at('18:00'), 'Asia/Kolkata'), false);
});

test('shift window handles overnight shifts', () => {
  assert.equal(isWithinShift('22:00', '06:00', at('23:30'), 'Asia/Kolkata'), true);
  assert.equal(isWithinShift('22:00', '06:00', at('02:00'), 'Asia/Kolkata'), true);
  assert.equal(isWithinShift('22:00', '06:00', at('12:00'), 'Asia/Kolkata'), false);
});

test('shift is evaluated in the configured timezone, not the server timezone', () => {
  const instant = new Date('2026-01-15T05:00:00Z'); // 10:30 IST, 05:00 UTC
  assert.equal(isWithinShift('09:00', '18:00', instant, 'Asia/Kolkata'), true);
  assert.equal(isWithinShift('09:00', '18:00', instant, 'UTC'), false);
});

test('no shift set means no restriction; admins are never restricted', () => {
  assert.equal(isWithinShift(null, null, at('03:00'), 'Asia/Kolkata'), true);
  const admin = { role: 'super_admin', shift_start: '09:00:00', shift_end: '10:00:00' };
  assert.deepEqual(shiftInfo(admin, at('03:00'), 'Asia/Kolkata').restricted, false);
  const member = { role: 'team_member', shift_start: '09:00:00', shift_end: '18:00:00' };
  const info = shiftInfo(member, at('03:00'), 'Asia/Kolkata');
  assert.deepEqual([info.restricted, info.open, info.start, info.end], [true, false, '09:00', '18:00']);
});

const questions = [
  { id: 1, type: 'single', options: [{ id: 'a', correct: false }, { id: 'b', correct: true }] },
  { id: 2, type: 'multiple', options: [{ id: 'a', correct: true }, { id: 'b', correct: true }, { id: 'c', correct: false }] },
  { id: 3, type: 'written', options: [] },
];

test('scoring: multiple-answer is all-or-nothing, written answers are not scored', () => {
  const full = scoreAttempt(questions, { 1: ['b'], 2: ['b', 'a'], 3: 'anything' }, 70);
  assert.equal(full.score, 100);
  assert.equal(full.passed, true);
  const partial = scoreAttempt(questions, { 1: ['b'], 2: ['a'] }, 70);
  assert.equal(partial.score, 50);
  assert.equal(partial.passed, false);
  assert.equal(scoreAttempt(questions, {}, 70).score, 0);
});

test('status derivation', () => {
  const base = { completed_at: null, assessment_passed_at: null, acknowledged_at: null, lesson_completed_at: null, watched_seconds: 0, progress_id: null, attempts_used: 0, max_attempts: 3, requires_ack: true, had_previous_completion: false };
  assert.equal(computeStatus(base), 'not_started');
  assert.equal(computeStatus({ ...base, progress_id: 1, watched_seconds: 5 }), 'in_progress');
  assert.equal(computeStatus({ ...base, attempts_used: 3 }), 'failed');
  assert.equal(computeStatus({ ...base, attempts_used: 3, max_attempts: 0 }), 'not_started'); // 0 = unlimited
  assert.equal(computeStatus({ ...base, assessment_passed_at: new Date() }), 'ack_pending');
  assert.equal(computeStatus({ ...base, had_previous_completion: true }), 'retraining_required');
  assert.equal(computeStatus({ ...base, completed_at: new Date() }), 'completed');
  assert.equal(isOverdue('in_progress', '2020-01-01'), true);
  assert.equal(isOverdue('completed', '2020-01-01'), false);
});

import { directoryToken } from '../src/bunny.js';
import { reminderItems } from '../src/reminders.js';

test('Bunny directory token matches an independent HMAC-SHA256 (checked with openssl)', () => {
  // printf '/abc/1700000000token_path=/abc/' | openssl dgst -sha256 -hmac 'secret-key' -binary | base64 | tr '+/' '-_' | tr -d '='
  assert.equal(directoryToken('secret-key', '/abc/', 1700000000), 'HS256-PmycFoV5PzMuaGXgS8rlcm_iKD3LY6jRppreexJ3-HQ');
});

test('reminder items: one kind per assignment, most urgent first, overdue reminders stop after five', () => {
  const now = new Date('2026-03-10T10:00:00Z');
  const DAY = 24 * 3600 * 1000;
  const base = { user_id: 1, module_id: 1, version: 1, title: 'T', status: 'not_started', assigned_at: new Date(+now - 30 * DAY) };
  const kind = (r) => reminderItems([{ ...base, ...r }], now)[0]?.kind;
  assert.equal(kind({ due_at: new Date(+now - DAY) }), 'overdue');
  assert.equal(kind({ due_at: new Date(+now + 2 * DAY) }), 'due_soon');
  assert.equal(kind({ due_at: new Date(+now + 10 * DAY) }), undefined, 'not due yet and not new: nothing to say');
  assert.equal(kind({ due_at: new Date(+now + 10 * DAY), assigned_at: new Date(+now - 3600_000) }), 'new_training');
  assert.equal(kind({ due_at: new Date(+now + 10 * DAY), status: 'retraining_required' }), 'retraining');
  assert.equal(kind({ due_at: new Date(+now + 2 * DAY), assigned_at: new Date(+now - 3600_000) }), 'due_soon', 'urgent wins over "new"');
  assert.equal(kind({ due_at: new Date(+now - DAY), status: 'completed' }), undefined);
  assert.equal(kind({ due_at: new Date(+now - 14 * DAY) }), 'overdue');
  assert.equal(kind({ due_at: new Date(+now - 15 * DAY) }), undefined, 'the fifth overdue reminder is the last');
  // keys change with the bucket (so each 3-day step is a new reminder) and with the due date
  const key = (due) => reminderItems([{ ...base, due_at: due }], now)[0].key;
  assert.notEqual(key(new Date(+now - DAY)), key(new Date(+now - 4 * DAY)));
});
