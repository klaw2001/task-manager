import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import SecureVideo from '../SecureVideo.jsx';
import ShiftGate from '../ShiftGate.jsx';
import { Badge, Card, Loading, Page, StatusBadge, fmtDate, useLoad, useToast } from '../ui.jsx';

function Quiz({ module, onPassed, onUpdate }) {
  const toast = useToast();
  const quiz = useLoad(() => api.get(`/api/learn/modules/${module.module_id}/quiz`), [module.attempts_used]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  if (result) {
    const byId = Object.fromEntries(result.results.map((r) => [r.questionId, r.correct]));
    return (
      <Card>
        <h2>{result.passed ? '✅ You passed' : '❌ Not passed yet'}</h2>
        <p>Your score: <b>{result.score}%</b> (pass mark {result.passMark}%)</p>
        {!result.passed && (
          <>
            <p className="muted">Questions you got wrong are marked below.</p>
            {result.module.attempts_left === 0
              ? <div className="notice bad">You have used all your attempts. Speak to your manager to arrange retraining.</div>
              : <p>{result.module.attempts_left == null ? '' : `${result.module.attempts_left} attempt(s) left. `}Review the lesson, then try again.</p>}
            <ul>{(quiz.data?.questions || []).filter((q) => byId[q.id] === false).map((q) => <li key={q.id}>{q.text}</li>)}</ul>
          </>
        )}
        <div className="row end">
          {result.passed
            ? <button className="btn primary" onClick={() => onPassed(result.module)}>Continue</button>
            : result.module.attempts_left !== 0 && <button className="btn primary" onClick={() => { setResult(null); setAnswers({}); onUpdate(result.module); }}>Try again</button>}
        </div>
      </Card>
    );
  }
  if (!quiz.data) return <Loading state={quiz} />;

  const toggle = (q, optId) => {
    const cur = answers[q.id] || [];
    setAnswers({ ...answers, [q.id]: q.type === 'single' ? [optId] : cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId] });
  };
  const unanswered = quiz.data.questions.filter((q) => q.type !== 'written' && !(answers[q.id]?.length));

  async function submit() {
    setBusy(true);
    try {
      setResult(await api.post(`/api/learn/modules/${module.module_id}/attempts`, { answers }));
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2>Assessment</h2>
      <p className="muted small">Pass mark {quiz.data.passMark}%. {module.attempts_left != null && `${module.attempts_left} attempt(s) left.`}</p>
      {quiz.data.questions.map((q, i) => (
        <div className="q" key={q.id}>
          <b>{i + 1}. {q.text}</b>
          {q.type === 'multiple' && <div className="muted small">Select all that apply</div>}
          {q.type === 'written' && <div className="muted small">Optional written response</div>}
          {q.type === 'written' ? (
            <textarea value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} maxLength={2000} />
          ) : (
            q.options.map((o) => (
              <label className="option" key={o.id}>
                <input type={q.type === 'single' ? 'radio' : 'checkbox'} name={`q${q.id}`} checked={(answers[q.id] || []).includes(o.id)} onChange={() => toggle(q, o.id)} />
                {o.text}
              </label>
            ))
          )}
        </div>
      ))}
      <div className="row end">
        <button className="btn primary" disabled={busy || unanswered.length > 0} onClick={submit}>{busy ? 'Submitting…' : 'Submit answers'}</button>
      </div>
      {unanswered.length > 0 && <p className="muted small" style={{ textAlign: 'right' }}>{unanswered.length} question(s) still to answer</p>}
    </Card>
  );
}

function Player() {
  const { id } = useParams();
  const toast = useToast();
  const state = useLoad(() => api.get(`/api/learn/modules/${id}`), [id]);
  const [ack, setAck] = useState(false);
  const [continued, setContinued] = useState(false);
  const startedInLesson = useRef(null);
  const m = state.data;
  const setM = state.setData;

  const serverStage = !m ? '' : m.completed_at ? 'done' : !m.lesson_completed_at ? 'lesson' : !m.assessment_passed_at ? 'quiz' : 'ack';
  if (m && startedInLesson.current === null) startedInLesson.current = serverStage === 'lesson' && m.has_video;
  // someone who was watching stays on the video until they press Continue, even once enough has been watched
  const stage = startedInLesson.current && !continued && serverStage !== 'lesson' ? 'lesson' : serverStage;
  useEffect(() => window.scrollTo({ top: 0 }), [stage]);

  if (!m) return <Loading state={state} />;
  const act = (path) => api.post(`/api/learn/modules/${id}/${path}`).then(setM).catch(toast.error);
  const hasQuiz = m.scored_questions > 0;
  const steps = [
    ['Lesson', stage !== 'lesson'],
    ...(hasQuiz ? [['Assessment', stage === 'ack' || stage === 'done']] : []),
    ...(m.requires_ack ? [['Acknowledge', stage === 'done']] : []),
  ];
  const current = steps.findIndex(([, done]) => !done);
  const pct = m.duration_seconds ? Math.min(100, Math.round((m.watched_seconds / m.duration_seconds) * 100)) : 0;

  return (
    <Page title={m.title} subtitle={m.description} actions={<StatusBadge status={m.status} overdue={m.overdue} />}>
      <p className="muted small"><Link to="/">← All training</Link> · {m.category} · Due {fmtDate(m.due_at)} · Version {m.version}</p>
      <div className="steps">{steps.map(([name, done], i) => <div key={name} className={done ? 'done' : i === current ? 'now' : ''}>{done ? '✓ ' : ''}{name}</div>)}</div>

      {stage === 'done' && (
        <div className="notice ok">
          <b>Module complete.</b> {m.best_score != null && `Score ${m.best_score}%. `}Well done! You can revisit the lesson any time.
        </div>
      )}

      {(stage === 'lesson' || stage === 'done') && (
        <div className="stack">
          {m.has_video && (
            <>
              <SecureVideo src={`/api/media/modules/${id}/video`} track={!m.lesson_completed_at ? { moduleId: id, startAt: m.last_position, onUpdate: setM } : undefined} />
              {stage === 'lesson' && (
                m.lesson_completed_at ? (
                  <div className="row between">
                    <span className="notice ok" style={{ margin: 0 }}>✓ Lesson complete</span>
                    <button className="btn primary" onClick={() => setContinued(true)}>Continue</button>
                  </div>
                ) : (
                  <div>
                    <div className="bar" aria-hidden><i style={{ width: `${pct}%` }} /></div>
                    <p className="muted small">You need to watch at least {m.min_watch_percent}% of the video to continue. Watched so far: {pct}%.</p>
                  </div>
                )
              )}
            </>
          )}
          {m.instructions && <Card><h2>Instructions</h2><p style={{ whiteSpace: 'pre-wrap' }}>{m.instructions}</p></Card>}
          {stage === 'lesson' && !m.has_video && <div className="row end"><button className="btn primary" onClick={() => act('lesson')}>I have read this</button></div>}
        </div>
      )}

      {stage === 'quiz' && (
        m.attempts_left === 0
          ? <div className="notice bad"><b>No attempts left.</b> Speak to your manager to arrange retraining.</div>
          : <Quiz module={m} onUpdate={setM} onPassed={setM} />
      )}

      {stage === 'ack' && (
        <Card>
          <h2>Acknowledge</h2>
          <p>You passed the assessment{m.best_score != null ? ` with ${m.best_score}%` : ''}. One last step:</p>
          <label className="check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>{m.ack_text}</span></label>
          <div className="row end"><button className="btn primary" disabled={!ack} onClick={() => act('acknowledge')}>Acknowledge and complete</button></div>
        </Card>
      )}
      {m.mandatory === false && <Badge tone="grey">Optional module</Badge>}
    </Page>
  );
}

export default function ModulePlayer() {
  return <ShiftGate><Player /></ShiftGate>;
}
