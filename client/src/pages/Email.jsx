import { useState } from 'react';
import { api } from '../api.js';
import { Badge, Card, Field, Loading, Page, fmtDateTime, useLoad, useToast } from '../ui.jsx';

const KIND = { invite: 'Login details', password_reset: 'Password reset', new_training: 'New training', due_soon: 'Due soon', overdue: 'Overdue', retraining: 'Retraining', test: 'Test' };
const TONE = { sent: 'green', failed: 'red', pending: 'amber' };

export default function Email() {
  const toast = useToast();
  const state = useLoad(() => api.get('/api/admin/email'));
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState('');
  const info = state.data;
  if (!info) return <Loading state={state} />;

  async function run(kind, fn, done) {
    setBusy(kind);
    try { toast(done(await fn())); } catch (e) { toast.error(e); } finally { setBusy(''); state.reload(); }
  }

  return (
    <Page title="Email" subtitle="Login details and training reminders are sent through Brevo SMTP.">
      {!info.enabled ? (
        <div className="notice warn">
          <b>Email is switched off.</b> Add the Brevo SMTP login, SMTP key and a verified sender to the server settings (<code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>MAIL_FROM</code>), restart, and come back here to send a test. See docs/EMAIL.md.
        </div>
      ) : (
        <div className="notice ok">Email is on. Sending as <b>{info.from}</b> through {info.host}:{info.port}.</div>
      )}

      <div className="form-grid" style={{ alignItems: 'start' }}>
        <Card>
          <h2>Send a test email</h2>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); run('test', () => api.post('/api/admin/email/test', { to }), () => `Test email sent to ${to}`); }}>
            <Field label="Send to"><input type="email" value={to} onChange={(e) => setTo(e.target.value)} required placeholder="you@yourcompany.com" /></Field>
            <button className="btn primary" disabled={!info.enabled || busy === 'test'}>{busy === 'test' ? 'Sending…' : 'Send test'}</button>
          </form>
        </Card>
        <Card>
          <h2>Training reminders</h2>
          <p className="muted small">
            Staff with an email address are emailed when training is assigned or needs retaking, 3 days before it is due, and every 3 days while overdue (up to 5 times).
            Reminders go out between {info.reminders.hours} India time, checked every 30 minutes.
          </p>
          <button className="btn" disabled={!info.enabled || busy === 'run'} onClick={() => run('run', () => api.post('/api/admin/email/reminders/run'), (r) => (r.skipped ? r.skipped : `Reminders: ${r.sent} email(s) sent, ${r.failed} failed`))}>
            {busy === 'run' ? 'Running…' : 'Send due reminders now'}
          </button>
        </Card>
      </div>

      <h3>Recent emails</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>To</th><th>Type</th><th>Subject</th><th>Status</th></tr></thead>
          <tbody>
            {info.log.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(l.created_at)}</td><td>{l.to_address}</td><td>{KIND[l.kind] || l.kind}</td><td>{l.subject}</td>
                <td><Badge tone={TONE[l.status]}>{l.status}</Badge>{l.error && <div className="small muted" style={{ maxWidth: 260 }}>{l.error}</div>}</td>
              </tr>
            ))}
            {info.log.length === 0 && <tr><td colSpan="5" className="muted">Nothing sent yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
