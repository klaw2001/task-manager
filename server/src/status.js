/**
 * Derives a learner-facing status from a joined assignment/progress row.
 * Expected fields: completed_at, assessment_passed_at, acknowledged_at, lesson_completed_at,
 * watched_seconds, progress_id, attempts_used, max_attempts, requires_ack, had_previous_completion.
 */
export function computeStatus(r) {
  if (r.completed_at) return 'completed';
  if (!r.assessment_passed_at && r.max_attempts > 0 && r.attempts_used >= r.max_attempts) return 'failed';
  if (r.assessment_passed_at && r.requires_ack && !r.acknowledged_at) return 'ack_pending';
  if (r.progress_id && (r.watched_seconds > 0 || r.lesson_completed_at || r.attempts_used > 0)) return 'in_progress';
  if (r.had_previous_completion) return 'retraining_required';
  return 'not_started';
}

export function isOverdue(status, dueAt, now = new Date()) {
  return status !== 'completed' && Boolean(dueAt) && new Date(dueAt) < now;
}

export function withStatus(row, now = new Date()) {
  const status = computeStatus(row);
  return { ...row, status, overdue: isOverdue(status, row.due_at, now) };
}
