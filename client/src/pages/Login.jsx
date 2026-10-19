import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Field } from '../ui.jsx';

export default function Login() {
  const { user, login, notice } = useAuth();
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(employeeId, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login stack" onSubmit={submit}>
      <h1>🍳 Staff Training</h1>
      {notice && <div className="notice warn">{notice}</div>}
      <Field label="Employee ID"><input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} autoComplete="username" autoCapitalize="characters" required autoFocus /></Field>
      <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
      {error && <div className="notice bad" role="alert">{error}</div>}
      <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="muted small" style={{ textAlign: 'center' }}>Forgot your password? Ask your manager or administrator to reset it.</p>
    </form>
  );
}
