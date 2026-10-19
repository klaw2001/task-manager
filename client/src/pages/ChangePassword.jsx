import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Field, Page, useToast } from '../ui.jsx';

export default function ChangePassword() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) return setError('The new passwords do not match');
    try {
      await api.post('/api/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      await refresh();
      toast('Password updated');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Page title="Change password" subtitle={user.must_change_password ? 'Choose your own password before you continue.' : undefined}>
      <form className="card stack" style={{ maxWidth: 420 }} onSubmit={submit}>
        <Field label={user.must_change_password ? 'Temporary password' : 'Current password'}><input type="password" value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" required /></Field>
        <Field label="New password" hint="At least 8 characters, with a letter and a number"><input type="password" value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" required /></Field>
        <Field label="Repeat new password"><input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required /></Field>
        {error && <div className="notice bad" role="alert">{error}</div>}
        <button className="btn primary">Save password</button>
      </form>
    </Page>
  );
}
