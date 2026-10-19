import { useAuth } from './auth.jsx';

/** Learner content is hidden outside the user's shift. The server enforces this too - this is just the friendly screen. */
export default function ShiftGate({ children }) {
  const { user } = useAuth();
  const s = user.shift;
  if (s.restricted && !s.open) {
    return (
      <div className="card lock-screen">
        <div className="big" aria-hidden>🔒</div>
        <h1>Outside your shift</h1>
        <p>Training and recipes are available during your shift, <b>{s.start} – {s.end}</b> ({s.timezone.replace('_', ' ')}).</p>
        <p className="muted">Please come back then. Speak to your manager if your shift timing is wrong.</p>
      </div>
    );
  }
  return children;
}
