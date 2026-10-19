const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Scores submitted answers. `answers` maps question id -> array of option ids (or a string for written).
 * Single/multiple-answer questions are all-or-nothing; written questions are stored but not scored.
 */
export function scoreAttempt(questions, answers, passMark) {
  const scored = questions.filter((q) => q.type !== 'written');
  const results = scored.map((q) => {
    const given = Array.isArray(answers?.[q.id]) ? answers[q.id].map(String) : [];
    const correctIds = q.options.filter((o) => o.correct).map((o) => String(o.id));
    return { questionId: q.id, correct: sameSet([...new Set(given)], correctIds) };
  });
  const right = results.filter((r) => r.correct).length;
  const score = scored.length ? Math.round((100 * right) / scored.length) : 100;
  return { score, passed: score >= passMark, results };
}

export function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
