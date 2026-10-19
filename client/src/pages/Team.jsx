import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Loading, Modal, Page, ROLE_LABEL, StatusBadge, fmtDate, useLoad } from '../ui.jsx';

const STATUS_OPTIONS = [
  ['overdue', 'Overdue'], ['failed', 'Failed'], ['retraining_required', 'Retraining required'], ['not_started', 'Not started'],
  ['in_progress', 'In progress'], ['ack_pending', 'Awaiting acknowledgement'], ['completed', 'Completed'],
];
const GROUPS = { records: 'Records', employee: 'By employee', outlet: 'By outlet', brand: 'By brand', role: 'By role' };

function History({ userId, onClose }) {
  const state = useLoad(() => api.get(`/api/reports/history/${userId}`), [userId]);
  return (
    <Modal title={state.data ? `${state.data.person.name} · training history` : 'Training history'} onClose={onClose} wide>
      {!state.data ? <Loading state={state} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Module</th><th>Version</th><th>Lesson</th><th>Best score</th><th>Attempts</th><th>Acknowledged</th><th>Completed</th></tr></thead>
            <tbody>
              {state.data.history.map((h, i) => (
                <tr key={i}>
                  <td>{h.title}</td>
                  <td>v{h.version}{h.version < h.current_version && <span className="muted small"> (superseded)</span>}</td>
                  <td>{fmtDate(h.lesson_completed_at)}</td><td>{h.best_score != null ? `${h.best_score}%` : '—'}</td><td>{h.attempts}</td>
                  <td>{fmtDate(h.acknowledged_at)}</td><td>{fmtDate(h.completed_at)}</td>
                </tr>
              ))}
              {state.data.history.length === 0 && <tr><td colSpan="7" className="muted">No training activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function groupRows(rows, by) {
  const key = { employee: (r) => `${r.user_name} (${r.employee_id})`, outlet: (r) => r.outlet_name || '—', brand: (r) => r.brand_name || '—', role: (r) => ROLE_LABEL[r.user_role] }[by];
  const groups = new Map();
  for (const r of rows) {
    const g = groups.get(key(r)) || { name: key(r), total: 0, completed: 0, overdue: 0, failed: 0, retrain: 0 };
    g.total++;
    if (r.status === 'completed') g.completed++;
    if (r.overdue) g.overdue++;
    if (r.status === 'failed') g.failed++;
    if (r.status === 'retraining_required') g.retrain++;
    groups.set(key(r), g);
  }
  return [...groups.values()].sort((a, b) => b.overdue + b.failed - (a.overdue + a.failed) || a.name.localeCompare(b.name));
}

export default function Team() {
  const { user } = useAuth();
  const [f, setF] = useState({ moduleId: '', outletId: '', brandId: '', role: '', status: '' });
  const [group, setGroup] = useState('records');
  const [historyFor, setHistoryFor] = useState(null);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const everything = useLoad(() => api.get('/api/reports/progress'), []); // unfiltered, only to build the filter lists
  const state = useLoad(() => api.get(`/api/reports/progress?${qs}`), [qs]);

  const options = useMemo(() => {
    const rows = everything.data?.rows || [];
    const uniq = (idKey, nameKey) => [...new Map(rows.filter((r) => r[idKey]).map((r) => [r[idKey], r[nameKey]])).entries()];
    return { modules: uniq('module_id', 'title'), outlets: uniq('outlet_id', 'outlet_name'), brands: uniq('brand_id', 'brand_name'), roles: [...new Set(rows.map((r) => r.user_role))] };
  }, [everything.data]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const s = state.data?.summary;
  const rows = state.data?.rows || [];

  return (
    <Page
      title={user.isAdmin ? 'Training reports' : 'My team'}
      subtitle={user.role === 'outlet_incharge' ? `Staff at ${user.outlet_name}` : user.role === 'franchisee' ? 'Staff at your outlets' : 'All brands and outlets'}
      actions={<a className="btn" href={`/api/reports/progress.csv?${qs}`}>⬇ Download CSV (Excel)</a>}
    >
      {s && (
        <div className="tiles">
          <div className="tile"><b>{s.total}</b><span>Assignments</span></div>
          <div className="tile good"><b>{s.completed}</b><span>Completed</span></div>
          <div className="tile"><b>{s.inProgress}</b><span>In progress</span></div>
          <div className={`tile ${s.overdue ? 'bad' : ''}`}><b>{s.overdue}</b><span>Overdue</span></div>
          <div className={`tile ${s.failed ? 'bad' : ''}`}><b>{s.failed}</b><span>Failed</span></div>
          <div className="tile"><b>{s.retrainingRequired}</b><span>Retraining due</span></div>
        </div>
      )}

      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <select value={f.status} onChange={set('status')} aria-label="Status"><option value="">Any status</option>{STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={f.moduleId} onChange={set('moduleId')} aria-label="Module"><option value="">All modules</option>{options.modules.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        {options.brands.length > 1 && <select value={f.brandId} onChange={set('brandId')} aria-label="Brand"><option value="">All brands</option>{options.brands.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}
        {options.outlets.length > 1 && <select value={f.outletId} onChange={set('outletId')} aria-label="Outlet"><option value="">All outlets</option>{options.outlets.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}
        <select value={f.role} onChange={set('role')} aria-label="Role"><option value="">All roles</option>{options.roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      </div>

      <div className="tabs" role="tablist">
        {Object.entries(GROUPS).map(([k, label]) => <button key={k} role="tab" aria-selected={group === k} className={group === k ? 'active' : ''} onClick={() => setGroup(k)}>{label}</button>)}
      </div>

      {!state.data ? <Loading state={state} /> : group === 'records' ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Outlet</th><th>Module</th><th>Status</th><th>Score</th><th>Attempts</th><th>Due</th><th>Completed</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.user_id}-${r.module_id}`}>
                  <td><button className="btn link" onClick={() => setHistoryFor(r.user_id)}>{r.user_name}</button><div className="muted small">{r.employee_id} · {ROLE_LABEL[r.user_role]}</div></td>
                  <td>{r.outlet_name || '—'}<div className="muted small">{r.brand_name}</div></td>
                  <td>{r.title}<div className="muted small">v{r.version}</div></td>
                  <td><StatusBadge status={r.status} overdue={r.overdue} /></td>
                  <td>{r.best_score != null ? `${r.best_score}%` : '—'}</td>
                  <td>{r.attempts_used}{r.max_attempts ? `/${r.max_attempts}` : ''}</td>
                  <td>{fmtDate(r.due_at)}</td><td>{fmtDate(r.completed_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="8" className="muted">Nothing matches these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>{GROUPS[group].replace('By ', '')}</th><th>Assigned</th><th>Completed</th><th>Completion</th><th>Overdue</th><th>Failed</th><th>Retraining</th></tr></thead>
            <tbody>
              {groupRows(rows, group).map((g) => (
                <tr key={g.name}>
                  <td>{g.name}</td><td>{g.total}</td><td>{g.completed}</td>
                  <td style={{ minWidth: 120 }}><div className="bar"><i style={{ width: `${Math.round((100 * g.completed) / g.total)}%` }} /></div><span className="small muted">{Math.round((100 * g.completed) / g.total)}%</span></td>
                  <td>{g.overdue || '—'}</td><td>{g.failed || '—'}</td><td>{g.retrain || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {historyFor && <History userId={historyFor} onClose={() => setHistoryFor(null)} />}
    </Page>
  );
}
