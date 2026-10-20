import { useState } from 'react';
import { api } from '../api.js';
import { Badge, Confirm, Field, Loading, Modal, Page, ROLE_LABEL, fmtDateTime, useLoad, useToast } from '../ui.jsx';

const EMPTY = { employeeId: '', name: '', mobile: '', email: '', sendInvite: true, role: 'team_member', brandId: '', outletId: '', designation: '', managerId: '', joiningDate: '', language: 'en', shiftStart: '', shiftEnd: '', dueDays: '' };
const LANGUAGES = [['en', 'English'], ['hi', 'Hindi'], ['mr', 'Marathi'], ['gu', 'Gujarati'], ['ta', 'Tamil'], ['te', 'Telugu'], ['kn', 'Kannada'], ['bn', 'Bengali']];
const num = (v) => (v === '' ? null : Number(v));

function UserForm({ user, outlets, brands, users, onClose, onDone }) {
  const toast = useToast();
  const editing = Boolean(user);
  const [f, setF] = useState(editing ? {
    employeeId: user.employee_id, name: user.name, mobile: user.mobile || '', email: user.email || '', sendInvite: true, role: user.role, brandId: user.brand_id ?? '', outletId: user.outlet_id ?? '',
    designation: user.designation || '', managerId: user.manager_id ?? '', joiningDate: user.joining_date || '', language: user.language,
    shiftStart: user.shift_start?.slice(0, 5) || '', shiftEnd: user.shift_end?.slice(0, 5) || '', dueDays: '',
  } : EMPTY);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isStaff = f.role === 'team_member' || f.role === 'outlet_incharge';
  const isAdminRole = f.role === 'super_admin' || f.role === 'training_admin';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const body = {
      employeeId: f.employeeId.trim(), name: f.name.trim(), mobile: f.mobile.trim() || null, email: f.email.trim() || null, role: f.role,
      outletId: isStaff ? num(f.outletId) : null, brandId: f.role === 'franchisee' ? num(f.brandId) : isAdminRole ? null : undefined,
      designation: f.designation.trim() || null, managerId: num(f.managerId), joiningDate: f.joiningDate || null, language: f.language,
      shiftStart: !isAdminRole && f.shiftStart ? f.shiftStart : null, shiftEnd: !isAdminRole && f.shiftEnd ? f.shiftEnd : null,
    };
    try {
      if (editing) {
        await api.patch(`/api/admin/users/${user.id}`, body);
        toast('User updated');
        onDone();
      } else {
        const res = await api.post('/api/admin/users', { ...body, sendInvite: Boolean(body.email) && f.sendInvite, dueDays: f.dueDays ? Number(f.dueDays) : undefined });
        onDone(res);
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? `Edit ${user.name}` : 'Add user'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name"><input value={f.name} onChange={set('name')} required /></Field>
          <Field label="Employee ID" hint="They sign in with this"><input value={f.employeeId} onChange={set('employeeId')} required /></Field>
          <Field label="Mobile number"><input type="tel" inputMode="tel" value={f.mobile} onChange={set('mobile')} /></Field>
          <Field label="Email (optional)" hint="For login details and training reminders"><input type="email" value={f.email} onChange={set('email')} autoComplete="off" /></Field>
          <Field label="Role">
            <select value={f.role} onChange={set('role')}>{Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          {isStaff && (
            <Field label="Outlet" hint={editing ? 'Changing this transfers the person and assigns their new outlet’s training' : undefined}>
              <select value={f.outletId} onChange={set('outletId')} required><option value="">Select…</option>{outlets.map((o) => <option key={o.id} value={o.id}>{o.brand_name} – {o.name}</option>)}</select>
            </Field>
          )}
          {f.role === 'franchisee' && (
            <Field label="Brand"><select value={f.brandId} onChange={set('brandId')} required><option value="">Select…</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          )}
          <Field label="Designation"><input value={f.designation} onChange={set('designation')} /></Field>
          <Field label="Reporting manager"><select value={f.managerId} onChange={set('managerId')}><option value="">None</option>{users.filter((u) => u.id !== user?.id && u.is_active).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.employee_id})</option>)}</select></Field>
          <Field label="Joining date"><input type="date" value={f.joiningDate} onChange={set('joiningDate')} /></Field>
          <Field label="Preferred language"><select value={f.language} onChange={set('language')}>{LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          {!editing && isStaff && <Field label="Training deadline (days)" hint="Leave blank to use each module’s default"><input type="number" min="1" max="365" value={f.dueDays} onChange={set('dueDays')} /></Field>}
        </div>
        {!editing && f.email.trim() && (
          <label className="check"><input type="checkbox" checked={f.sendInvite} onChange={(e) => setF({ ...f, sendInvite: e.target.checked })} /><span>Email the Employee ID and temporary password to this address</span></label>
        )}
        {!isAdminRole && (
          <>
            <h3>Shift (optional)</h3>
            <p className="muted small">Training and recipes only open between these times (India time). Leave both blank for no restriction.</p>
            <div className="form-grid">
              <Field label="Shift starts"><input type="time" value={f.shiftStart} onChange={set('shiftStart')} /></Field>
              <Field label="Shift ends"><input type="time" value={f.shiftEnd} onChange={set('shiftEnd')} /></Field>
            </div>
          </>
        )}
        <div className="row end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{editing ? 'Save changes' : 'Create user'}</button></div>
      </form>
    </Modal>
  );
}

function Secret({ title, intro, password, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{intro}</p>
      <p><code className="pw">{password}</code></p>
      <p className="notice warn small">This is shown only once. They must change it the first time they sign in.</p>
      <div className="row end"><button className="btn" onClick={() => navigator.clipboard?.writeText(password)}>Copy</button><button className="btn primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}

export default function Users() {
  const toast = useToast();
  const [filter, setFilter] = useState({ search: '', role: '', active: 'true' });
  const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
  const state = useLoad(() => api.get(`/api/admin/users?${qs}`), [qs]);
  const everyone = useLoad(() => api.get('/api/admin/users'), []);
  const outlets = useLoad(() => api.get('/api/org/outlets'));
  const brands = useLoad(() => api.get('/api/org/brands'));
  const [dialog, setDialog] = useState(null);
  const [emailReset, setEmailReset] = useState(true);

  const refresh = () => { state.reload(); everyone.reload(); };
  const act = (fn, msg) => async () => { try { const r = await fn(); toast(msg); refresh(); return r; } catch (e) { toast.error(e); throw e; } };

  return (
    <Page title="Users" subtitle="Create staff, set their shift, transfer between outlets and remove access." actions={<button className="btn primary" onClick={() => setDialog({ type: 'form' })}>+ Add user</button>}>
      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <input type="search" placeholder="Search name or employee ID" value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
        <select value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })}><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={filter.active} onChange={(e) => setFilter({ ...filter, active: e.target.value })}><option value="true">Active</option><option value="false">Deactivated</option><option value="">All</option></select>
      </div>
      {!state.data ? <Loading state={state} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Outlet</th><th>Shift</th><th>Last sign-in</th><th /></tr></thead>
            <tbody>
              {state.data.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'inactive'}>
                  <td><b>{u.name}</b><div className="muted small">{u.employee_id}{u.mobile ? ` · ${u.mobile}` : ''}</div>{u.email && <div className="muted small">{u.email}</div>}</td>
                  <td>{ROLE_LABEL[u.role]}{!u.is_active && <> <Badge tone="red">Deactivated</Badge></>}{u.must_change_password && u.is_active && <> <Badge tone="amber">Invited</Badge></>}</td>
                  <td>{u.outlet_name ? `${u.brand_name} – ${u.outlet_name}` : u.brand_name || '—'}</td>
                  <td>{u.shift_start ? `${u.shift_start.slice(0, 5)}–${u.shift_end.slice(0, 5)}` : 'Always'}</td>
                  <td>{fmtDateTime(u.last_login_at)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn small" onClick={() => setDialog({ type: 'form', user: u })}>Edit</button>{' '}
                    {u.is_active ? (
                      <>
                        <button className="btn small" onClick={() => setDialog({ type: 'reset', user: u })}>Reset password</button>{' '}
                        <button className="btn small danger" onClick={() => setDialog({ type: 'deactivate', user: u })}>Remove access</button>
                      </>
                    ) : <button className="btn small" onClick={act(() => api.post(`/api/admin/users/${u.id}/reactivate`), 'Access restored')}>Restore access</button>}
                  </td>
                </tr>
              ))}
              {state.data.length === 0 && <tr><td colSpan="6" className="muted">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.type === 'form' && (
        <UserForm
          user={dialog.user} outlets={outlets.data || []} brands={brands.data || []} users={everyone.data || []}
          onClose={() => setDialog(null)}
          onDone={(created) => { refresh(); setDialog(created ? { type: 'secret', title: `${created.user.name} added`, intro: `${created.emailed ? `Login details were emailed to ${created.user.email}. ` : created.emailError ? `The email could not be sent (${created.emailError}), so give ${created.user.name} these details yourself. ` : `Give ${created.user.name} their Employee ID (${created.user.employee_id}) and this temporary password. `}${created.assigned} training module(s) were assigned.`, password: created.temporaryPassword } : null); }}
        />
      )}
      {dialog?.type === 'secret' && <Secret title={dialog.title} intro={dialog.intro} password={dialog.password} onClose={() => setDialog(null)} />}
      {dialog?.type === 'reset' && (
        <Confirm title="Reset password" message={`Create a new temporary password for ${dialog.user.name}? Their current password stops working.`} confirmLabel="Reset"
          onClose={() => setDialog((d) => (d?.type === 'reset' ? null : d))} // keep the follow-up "new password" dialog open
          onConfirm={async () => {
            const r = await act(() => api.post(`/api/admin/users/${dialog.user.id}/reset-password`, { sendEmail: Boolean(dialog.user.email) && emailReset }), 'Password reset')();
            setDialog({ type: 'secret', title: 'New temporary password', intro: `For ${dialog.user.name} (${dialog.user.employee_id}):${r.emailed ? ` It was also emailed to ${dialog.user.email}.` : r.emailError ? ` The email could not be sent (${r.emailError}).` : ''}`, password: r.temporaryPassword });
          }}>
          {dialog.user.email
            ? <label className="check"><input type="checkbox" checked={emailReset} onChange={(e) => setEmailReset(e.target.checked)} /><span>Email it to {dialog.user.email}</span></label>
            : <p className="muted small">No email address on file, so you will need to pass it on yourself.</p>}
        </Confirm>
      )}
      {dialog?.type === 'deactivate' && (
        <Confirm danger title="Remove access" confirmLabel="Remove access"
          message={`${dialog.user.name} will be signed out immediately and will not be able to sign in or play any video. Their training records are kept. You can restore access later.`}
          onClose={() => setDialog(null)} onConfirm={act(() => api.post(`/api/admin/users/${dialog.user.id}/deactivate`), 'Access removed')} />
      )}
    </Page>
  );
}
