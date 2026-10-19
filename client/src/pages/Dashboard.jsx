import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ShiftGate from '../ShiftGate.jsx';
import { Badge, Card, Loading, Page, StatusBadge, fmtDate, useLoad } from '../ui.jsx';

function ModuleCard({ m }) {
  const body = (
    <>
      <div className="row between">
        <b>{m.title}</b>
        {m.mandatory ? <Badge tone="grey">Mandatory</Badge> : <Badge tone="grey">Optional</Badge>}
      </div>
      <p className="muted small">{m.category}{m.duration_seconds ? ` · ${Math.ceil(m.duration_seconds / 60)} min video` : ''}</p>
      <div><StatusBadge status={m.status} overdue={m.overdue} /></div>
      <p className="small muted" style={{ marginTop: '.5rem' }}>
        Due {fmtDate(m.due_at)}
        {m.best_score != null && ` · Best score ${m.best_score}%`}
        {m.attempts_used > 0 && ` · ${m.attempts_used}/${m.max_attempts || '∞'} attempts`}
      </p>
      {m.locked && <p className="small">🔒 Complete “{m.prerequisite_title}” first</p>}
      {m.status === 'ack_pending' && <p className="small"><b>Waiting for your acknowledgement</b></p>}
      {m.status === 'failed' && <p className="small">Speak to your manager to arrange retraining.</p>}
    </>
  );
  return m.locked ? <Card className="locked">{body}</Card> : <Link className="card" to={`/modules/${m.module_id}`}>{body}</Link>;
}

function Content() {
  const state = useLoad(() => api.get('/api/learn/modules'));
  const { data } = state;
  if (!data) return <Loading state={state} />;
  const todo = data.filter((m) => m.status !== 'completed');
  const done = data.filter((m) => m.status === 'completed');
  const count = (fn) => data.filter(fn).length;
  return (
    <>
      <div className="tiles">
        <div className="tile"><b>{todo.length}</b><span>To do</span></div>
        <div className={`tile ${count((m) => m.overdue) ? 'bad' : ''}`}><b>{count((m) => m.overdue)}</b><span>Overdue</span></div>
        <div className="tile"><b>{count((m) => m.status === 'ack_pending')}</b><span>To acknowledge</span></div>
        <div className="tile good"><b>{done.length}</b><span>Completed</span></div>
      </div>
      {todo.length === 0 && <div className="notice ok">You are all caught up. 🎉 Recipes are always available under <Link to="/recipes">Recipes</Link>.</div>}
      <div className="cards">{todo.map((m) => <ModuleCard key={m.module_id} m={m} />)}</div>
      {done.length > 0 && (
        <>
          <h3>Completed</h3>
          <div className="cards">{done.map((m) => <ModuleCard key={m.module_id} m={m} />)}</div>
        </>
      )}
    </>
  );
}

export default function Dashboard() {
  return (
    <Page title="My training" actions={<Link className="btn" to="/recipes">🍳 Recipes</Link>}>
      <ShiftGate><Content /></ShiftGate>
    </Page>
  );
}
