import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/* ---------- data loading ---------- */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await fnRef.current(), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, deps);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}

/* ---------- toasts ---------- */
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'ok') => {
    const id = Math.random();
    setItems((s) => [...s, { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 4500);
  }, []);
  const toast = useCallback((m) => push(m, 'ok'), [push]);
  toast.error = (e) => push(e?.message || String(e), 'bad');
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((i) => <div key={i.id} className={`toast ${i.tone}`}>{i.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- building blocks ---------- */
export const Spinner = () => <div className="spinner" role="progressbar" aria-label="Loading" />;

export function Loading({ state }) {
  if (state.loading && !state.data) return <div className="center"><Spinner /></div>;
  if (state.error) return <div className="notice bad">{state.error.message}</div>;
  return null;
}

export function Page({ title, subtitle, actions, children }) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export const Card = ({ children, className = '', ...rest }) => <div className={`card ${className}`} {...rest}>{children}</div>;

export const Badge = ({ tone = 'grey', children }) => <span className={`badge ${tone}`}>{children}</span>;

const STATUS = {
  not_started: ['grey', 'Not started'],
  in_progress: ['blue', 'In progress'],
  ack_pending: ['amber', 'Acknowledge'],
  completed: ['green', 'Completed'],
  failed: ['red', 'Failed – retraining needed'],
  retraining_required: ['amber', 'Retraining required'],
  draft: ['grey', 'Draft'],
  published: ['green', 'Published'],
  archived: ['grey', 'Archived'],
};
export function StatusBadge({ status, overdue }) {
  const [tone, label] = STATUS[status] || ['grey', status];
  return (
    <>
      <Badge tone={tone}>{label}</Badge>
      {overdue && <Badge tone="red">Overdue</Badge>}
    </>
  );
}

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose, children }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      {children}
      <div className="row end">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- formatting ---------- */
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtDate = (d) => (d ? dateFmt.format(new Date(d)) : '—');
export const fmtDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '—');
export const fmtDuration = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '—');
export const ROLE_LABEL = {
  super_admin: 'Super Admin', training_admin: 'Training Admin', outlet_incharge: 'Outlet In-charge', team_member: 'Team Member', franchisee: 'Franchisee',
};
export const LEARNER_ROLES = ['team_member', 'outlet_incharge', 'franchisee'];
