import { api } from '../api.js';
import { Loading, Page, fmtDateTime, useLoad } from '../ui.jsx';

export default function Audit() {
  const state = useLoad(() => api.get('/api/admin/audit?limit=300'));
  return (
    <Page title="Audit log" subtitle="The most recent 300 actions: sign-ins, content changes, assignments and access changes.">
      {!state.data ? <Loading state={state} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th><th>Details</th></tr></thead>
            <tbody>
              {state.data.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(a.created_at)}</td>
                  <td>{a.actor || '—'}<div className="muted small">{a.actor_employee_id}</div></td>
                  <td><code>{a.action}</code></td>
                  <td>{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</td>
                  <td className="small muted" style={{ maxWidth: 360, overflowWrap: 'anywhere' }}>{a.detail ? JSON.stringify(a.detail) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
