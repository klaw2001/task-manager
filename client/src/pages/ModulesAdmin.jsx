import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Attachments from '../Attachments.jsx';
import AttachmentsEditor from '../AttachmentsEditor.jsx';
import SecureVideo from '../SecureVideo.jsx';
import VideoUpload from '../VideoUpload.jsx';
import { Card, Confirm, Field, LEARNER_ROLES, Loading, Modal, Page, ROLE_LABEL, StatusBadge, Badge, fmtDate, useLoad, useToast } from '../ui.jsx';

/* ---------------- list ---------------- */
export function ModuleList() {
  const state = useLoad(() => api.get('/api/admin/modules'));
  return (
    <Page title="Training modules" subtitle="Create, publish and assign training. Drafts are invisible to staff." actions={<Link className="btn primary" to="/manage/modules/new">+ New module</Link>}>
      {!state.data ? <Loading state={state} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Module</th><th>For</th><th>Status</th><th>Version</th><th>Completed</th><th>Updated</th></tr></thead>
            <tbody>
              {state.data.map((m) => (
                <tr key={m.id} className={m.status === 'archived' ? 'inactive' : ''}>
                  <td><Link to={`/manage/modules/${m.id}`}><b>{m.title}</b></Link><div className="muted small">{m.category}{m.mandatory ? '' : ' · optional'}</div></td>
                  <td>{m.roles.map((r) => ROLE_LABEL[r]).join(', ')}<div className="muted small">{m.brand_name || 'All brands'}</div></td>
                  <td><StatusBadge status={m.status} /></td>
                  <td>v{m.version}</td>
                  <td>{m.completed}/{m.assigned}</td>
                  <td>{fmtDate(m.updated_at)}</td>
                </tr>
              ))}
              {state.data.length === 0 && <tr><td colSpan="6" className="muted">No modules yet. Create your first one.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

/* ---------------- details tab ---------------- */
const NEW = {
  title: '', description: '', category: 'General', language: 'en', videoId: null, instructions: '', brandId: '', roles: ['team_member'],
  mandatory: true, sequence: 0, prerequisiteId: '', defaultDueDays: 14, minWatchPercent: 90, passMark: 70, maxAttempts: 3, randomize: true, requiresAck: true,
  ackText: 'I have read and understood this SOP and will follow it.',
};
const fromModule = (m) => ({ ...NEW, ...m, brandId: m.brand_id ?? '', videoId: m.video_id, prerequisiteId: m.prerequisite_id ?? '', defaultDueDays: m.default_due_days, minWatchPercent: m.min_watch_percent, passMark: m.pass_mark, maxAttempts: m.max_attempts, requiresAck: m.requires_ack, ackText: m.ack_text });

function DetailsTab({ module, brands, modules, onSaved }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState(module ? fromModule(module) : NEW);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const num = (k) => (e) => setF({ ...f, [k]: e.target.value === '' ? '' : Number(e.target.value) });
  const toggleRole = (r) => setF({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const body = {
      title: f.title.trim(), description: f.description, category: f.category.trim() || 'General', language: f.language,
      videoId: f.videoId, instructions: f.instructions,
      brandId: f.brandId === '' ? null : Number(f.brandId), roles: f.roles, mandatory: f.mandatory, sequence: Number(f.sequence) || 0,
      prerequisiteId: f.prerequisiteId === '' ? null : Number(f.prerequisiteId), defaultDueDays: Number(f.defaultDueDays), minWatchPercent: Number(f.minWatchPercent),
      passMark: Number(f.passMark), maxAttempts: Number(f.maxAttempts), randomize: f.randomize, requiresAck: f.requiresAck, ackText: f.ackText,
    };
    try {
      if (module) { await api.patch(`/api/admin/modules/${module.id}`, body); toast('Saved'); onSaved(); }
      else { const m = await api.post('/api/admin/modules', body); toast('Module created'); navigate(`/manage/modules/${m.id}`, { replace: true }); }
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <Card>
        <h2>Basics</h2>
        <div className="form-grid">
          <Field label="Title" wide><input value={f.title} onChange={set('title')} required maxLength={200} /></Field>
          <Field label="Description" wide><textarea value={f.description} onChange={set('description')} style={{ minHeight: 60 }} /></Field>
          <Field label="Category"><input value={f.category} onChange={set('category')} /></Field>
          <Field label="Language"><input value={f.language} onChange={set('language')} maxLength={10} /></Field>
          <Field label="Brand"><select value={f.brandId} onChange={set('brandId')}><option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Prerequisite module"><select value={f.prerequisiteId} onChange={set('prerequisiteId')}><option value="">None</option>{modules.filter((m) => m.id !== module?.id && m.status !== 'archived').map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></Field>
          <Field label="Sequence" hint="Lower numbers are shown first"><input type="number" min="0" value={f.sequence} onChange={num('sequence')} /></Field>
        </div>
        <h3>Training path (who gets this module)</h3>
        <div className="row">{LEARNER_ROLES.map((r) => <label className="check" key={r}><input type="checkbox" checked={f.roles.includes(r)} onChange={() => toggleRole(r)} />{ROLE_LABEL[r]}</label>)}</div>
        <label className="check"><input type="checkbox" checked={f.mandatory} onChange={set('mandatory')} />Mandatory (untick for optional training)</label>
      </Card>

      <Card>
        <h2>Lesson</h2>
        <VideoUpload
          label="Lesson video"
          videoId={f.videoId}
          onUploaded={(id) => setF((cur) => ({ ...cur, videoId: id }))}
          onRemove={() => setF({ ...f, videoId: null })}
        />
        {f.videoId && f.videoId !== module?.video_id && <p className="notice warn small">Save the module to attach this video. Publish a new version if staff should see it.</p>}
        <Field label="Written instructions" hint="Shown under the video. Modules without a video use this as the lesson." wide>
          <textarea value={f.instructions} onChange={set('instructions')} style={{ minHeight: 140 }} />
        </Field>
      </Card>

      <Card>
        <h2>Assessment & completion</h2>
        <div className="form-grid">
          <Field label="Minimum viewing (%)" hint="Share of the video that must actually be watched"><input type="number" min="0" max="100" value={f.minWatchPercent} onChange={num('minWatchPercent')} /></Field>
          <Field label="Pass mark (%)"><input type="number" min="0" max="100" value={f.passMark} onChange={num('passMark')} /></Field>
          <Field label="Attempts allowed" hint="0 = unlimited"><input type="number" min="0" max="20" value={f.maxAttempts} onChange={num('maxAttempts')} /></Field>
          <Field label="Default deadline (days)" hint="After assignment"><input type="number" min="1" max="365" value={f.defaultDueDays} onChange={num('defaultDueDays')} /></Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.randomize} onChange={set('randomize')} />Randomise question and answer order</label>
        <label className="check"><input type="checkbox" checked={f.requiresAck} onChange={set('requiresAck')} />Require acknowledgement of the SOP</label>
        {f.requiresAck && <Field label="Acknowledgement wording"><input value={f.ackText} onChange={set('ackText')} /></Field>}
      </Card>
      <div className="row end"><button className="btn primary" disabled={busy || f.roles.length === 0}>{module ? 'Save changes' : 'Create module'}</button></div>
    </form>
  );
}

/* ---------------- questions tab ---------------- */
const blankQuestion = (type) => ({ type, text: '', options: type === 'written' ? [] : [{ text: '', correct: type === 'single' }, { text: '', correct: false }] });

function QuestionsTab({ module, onSaved }) {
  const toast = useToast();
  const [qs, setQs] = useState(module.questions.map((q) => ({ type: q.type, text: q.text, options: q.options.map((o) => ({ text: o.text, correct: o.correct })) })));
  const [busy, setBusy] = useState(false);
  const patch = (i, change) => setQs(qs.map((q, n) => (n === i ? { ...q, ...change } : q)));
  const setOpt = (i, j, change) => patch(i, { options: qs[i].options.map((o, n) => (n === j ? { ...o, ...change } : change.correct && qs[i].type === 'single' ? { ...o, correct: false } : o)) });

  function changeType(i, type) {
    const q = qs[i];
    if (type === 'written') return patch(i, { type, options: [] });
    const options = q.options.length >= 2 ? q.options : blankQuestion(type).options;
    const firstCorrect = Math.max(0, options.findIndex((o) => o.correct));
    patch(i, { type, options: options.map((o, n) => ({ ...o, correct: type === 'single' ? n === firstCorrect : o.correct })) });
  }

  async function save() {
    setBusy(true);
    try {
      await api.put(`/api/admin/modules/${module.id}/questions`, { questions: qs.map((q) => ({ ...q, options: q.options.map((o, n) => ({ id: String.fromCharCode(97 + n), ...o })) })) });
      toast('Questions saved');
      onSaved();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <p className="muted">Single-answer and multiple-answer questions are marked automatically. Written questions are optional responses and are not scored.</p>
      {qs.map((q, i) => (
        <Card key={i}>
          <div className="row between">
            <b>Question {i + 1}</b>
            <div className="row">
              <select value={q.type} onChange={(e) => changeType(i, e.target.value)} aria-label="Question type">
                <option value="single">Single answer</option><option value="multiple">Multiple answers</option><option value="written">Written (optional)</option>
              </select>
              <button className="btn small" onClick={() => setQs(qs.filter((_, n) => n !== i))}>Delete</button>
            </div>
          </div>
          <Field label="Question"><input value={q.text} onChange={(e) => patch(i, { text: e.target.value })} /></Field>
          {q.type !== 'written' && (
            <>
              <h3>Answers — tick the correct {q.type === 'single' ? 'one' : 'ones'}</h3>
              {q.options.map((o, j) => (
                <div className="row" key={j} style={{ marginBottom: '.4rem' }}>
                  <input type={q.type === 'single' ? 'radio' : 'checkbox'} name={`c${i}`} checked={o.correct} onChange={(e) => setOpt(i, j, { correct: e.target.checked })} aria-label="Correct answer" />
                  <input style={{ flex: 1 }} value={o.text} onChange={(e) => setOpt(i, j, { text: e.target.value })} placeholder={`Answer ${j + 1}`} />
                  {q.options.length > 2 && <button className="icon-btn" onClick={() => patch(i, { options: q.options.filter((_, n) => n !== j) })} aria-label="Remove answer">✕</button>}
                </div>
              ))}
              {q.options.length < 8 && <button className="btn small" onClick={() => patch(i, { options: [...q.options, { text: '', correct: false }] })}>+ Add answer</button>}
            </>
          )}
        </Card>
      ))}
      <div className="row between">
        <div className="row"><button className="btn" onClick={() => setQs([...qs, blankQuestion('single')])}>+ Question</button><button className="btn" onClick={() => setQs([...qs, blankQuestion('written')])}>+ Written question</button></div>
        <button className="btn primary" disabled={busy} onClick={save}>Save questions</button>
      </div>
    </div>
  );
}

/* ---------------- assign tab ---------------- */
function AssignTab({ module }) {
  const toast = useToast();
  const brands = useLoad(() => api.get('/api/org/brands'));
  const outlets = useLoad(() => api.get('/api/org/outlets'));
  const list = useLoad(() => api.get(`/api/admin/modules/${module.id}/assignments`), [module.id, module.version]);
  const [f, setF] = useState({ role: '', brandId: '', outletId: '', dueDays: '' });
  const [confirm, setConfirm] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const published = module.status === 'published';

  async function assign(e) {
    e.preventDefault();
    try {
      const body = { ...(f.role && { role: f.role }), ...(f.brandId && { brandId: Number(f.brandId) }), ...(f.outletId && { outletId: Number(f.outletId) }), ...(f.dueDays && { dueDays: Number(f.dueDays) }) };
      const r = await api.post(`/api/admin/modules/${module.id}/assign`, body);
      toast(`Assigned to ${r.assigned} new ${r.assigned === 1 ? 'person' : 'people'}`);
      list.reload();
    } catch (err) {
      toast.error(err);
    }
  }
  const run = (fn, msg) => async () => { await fn(); toast(msg); list.reload(); };

  return (
    <div className="stack">
      {!published && <div className="notice warn">Publish this module before assigning it.</div>}
      <Card>
        <h2>Assign to a group</h2>
        <p className="muted small">Everyone who matches and is eligible for this module (right role and brand) is assigned. Leave all blank to assign to everyone eligible. New joiners get their training path automatically.</p>
        <form onSubmit={assign}>
          <div className="form-grid">
            <Field label="Role"><select value={f.role} onChange={set('role')}><option value="">Any</option>{module.roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
            <Field label="Brand"><select value={f.brandId} onChange={set('brandId')}><option value="">Any</option>{(brands.data || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Outlet"><select value={f.outletId} onChange={set('outletId')}><option value="">Any</option>{(outlets.data || []).map((o) => <option key={o.id} value={o.id}>{o.brand_name} – {o.name}</option>)}</select></Field>
            <Field label="Deadline (days)" hint={`Default ${module.default_due_days}`}><input type="number" min="1" max="365" value={f.dueDays} onChange={set('dueDays')} /></Field>
          </div>
          <div className="row end"><button className="btn primary" disabled={!published}>Assign</button></div>
        </form>
      </Card>
      <h3>Assigned ({list.data?.length ?? '…'})</h3>
      {!list.data ? <Loading state={list} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Outlet</th><th>Status</th><th>Score</th><th>Attempts</th><th>Due</th><th /></tr></thead>
            <tbody>
              {list.data.map((a) => (
                <tr key={a.user_id}>
                  <td>{a.user_name}<div className="muted small">{a.employee_id} · {ROLE_LABEL[a.role]}</div></td>
                  <td>{a.outlet_name || '—'}</td>
                  <td><StatusBadge status={a.status} overdue={a.overdue} /></td>
                  <td>{a.best_score != null ? `${a.best_score}%` : '—'}</td>
                  <td>{a.attempts_used}{a.max_attempts ? `/${a.max_attempts}` : ''}</td>
                  <td>{fmtDate(a.due_at)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {(a.status === 'failed' || a.status === 'in_progress') && <button className="btn small" onClick={() => setConfirm({ kind: 'retake', a })}>Allow retake</button>}{' '}
                    <button className="btn small" onClick={() => setConfirm({ kind: 'remove', a })}>Unassign</button>
                  </td>
                </tr>
              ))}
              {list.data.length === 0 && <tr><td colSpan="7" className="muted">Nobody is assigned yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {confirm?.kind === 'retake' && (
        <Confirm title="Allow retake" message={`${confirm.a.user_name} will restart this module: their attempts, video progress and acknowledgement are reset. Past attempts stay in their history.`} confirmLabel="Allow retake"
          onClose={() => setConfirm(null)} onConfirm={run(() => api.post(`/api/admin/modules/${module.id}/retake/${confirm.a.user_id}`), 'Retraining set up')} />
      )}
      {confirm?.kind === 'remove' && (
        <Confirm danger title="Unassign" message={`Remove this module from ${confirm.a.user_name}? They will no longer see it. Their records are kept.`} confirmLabel="Unassign"
          onClose={() => setConfirm(null)} onConfirm={run(() => api.delete(`/api/admin/modules/${module.id}/assignments/${confirm.a.user_id}`), 'Unassigned')} />
      )}
    </div>
  );
}

/* ---------------- versions + preview ---------------- */
function VersionsTab({ module }) {
  const state = useLoad(() => api.get(`/api/admin/modules/${module.id}/versions`), [module.id, module.version]);
  return !state.data ? <Loading state={state} /> : (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Version</th><th>Change</th><th>Note</th><th>By</th><th>When</th><th>Completions</th></tr></thead>
        <tbody>
          {state.data.map((v) => (
            <tr key={v.version}>
              <td>v{v.version}{v.version === module.version && <> <Badge tone="green">Current</Badge></>}</td>
              <td>{{ initial: 'First published', retrain: 'Retraining required', reack: 'Fresh acknowledgement' }[v.change_type]}</td>
              <td>{v.note}</td><td>{v.created_by || '—'}</td><td>{fmtDate(v.created_at)}</td><td>{v.completions}</td>
            </tr>
          ))}
          {state.data.length === 0 && <tr><td colSpan="6" className="muted">Version history starts when the module is published.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PreviewTab({ module }) {
  return (
    <div className="stack">
      <div className="notice">Preview as staff will see it. Nothing is recorded.</div>
      {module.video_id ? <SecureVideo source={{ type: 'module', id: module.id }} /> : <div className="notice warn">No lesson video attached.</div>}
      {module.instructions && <Card><h2>Instructions</h2><p style={{ whiteSpace: 'pre-wrap' }}>{module.instructions}</p></Card>}
      <Attachments items={module.attachments} />
      <Card>
        <h2>Assessment ({module.questions.length} questions · pass mark {module.pass_mark}%)</h2>
        {module.questions.map((q, i) => (
          <div className="q" key={q.id}>
            <b>{i + 1}. {q.text}</b>
            {q.options.map((o) => <div key={o.id} className="option" style={{ cursor: 'default' }}>{o.correct ? '✅' : '⬜'} {o.text}</div>)}
            {q.type === 'written' && <div className="muted small">Written response (optional, not scored)</div>}
          </div>
        ))}
        {module.questions.length === 0 && <p className="muted">No questions: passing is automatic once the lesson is complete.</p>}
      </Card>
      {module.requires_ack && <Card><h2>Acknowledgement</h2><p>☐ {module.ack_text}</p></Card>}
    </div>
  );
}

function NewVersion({ module, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ changeType: 'retrain', note: '', dueDays: '' });
  async function submit(e) {
    e.preventDefault();
    try {
      await api.post(`/api/admin/modules/${module.id}/new-version`, { changeType: f.changeType, note: f.note, ...(f.dueDays && { dueDays: Number(f.dueDays) }) });
      toast(`Version ${module.version + 1} published`);
      onDone();
    } catch (err) {
      toast.error(err);
    }
  }
  return (
    <Modal title={`Publish version ${module.version + 1}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">Everything you saved is live as soon as you publish. Choose what staff must do again. Their earlier completions stay on record against version {module.version}.</p>
        <label className="option"><input type="radio" checked={f.changeType === 'retrain'} onChange={() => setF({ ...f, changeType: 'retrain' })} /><span><b>Retrain</b><br /><span className="small muted">Important change. Everyone watches, takes the assessment and acknowledges again.</span></span></label>
        <label className="option"><input type="radio" checked={f.changeType === 'reack'} onChange={() => setF({ ...f, changeType: 'reack' })} /><span><b>Fresh acknowledgement only</b><br /><span className="small muted">Progress carries over; everyone re-acknowledges the SOP.</span></span></label>
        <Field label="What changed?" hint="Recorded in the change history"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} required maxLength={500} /></Field>
        <Field label="New deadline (days from today)" hint={`Blank = ${module.default_due_days} days`}><input type="number" min="1" max="365" value={f.dueDays} onChange={(e) => setF({ ...f, dueDays: e.target.value })} /></Field>
        <div className="row end"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Publish new version</button></div>
      </form>
    </Modal>
  );
}

/* ---------------- editor ---------------- */
export function ModuleEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const toast = useToast();
  const [tab, setTab] = useState('details');
  const [dialog, setDialog] = useState(null);
  const brands = useLoad(() => api.get('/api/org/brands'));
  const modules = useLoad(() => api.get('/api/admin/modules'));
  const state = useLoad(() => (isNew ? Promise.resolve(null) : api.get(`/api/admin/modules/${id}`)), [id]);
  const m = state.data;
  if (!isNew && !m) return <Loading state={state} />;
  if (!brands.data || !modules.data) return <Loading state={!brands.data ? brands : modules} />;

  const act = (path, msg) => async () => { try { await api.post(`/api/admin/modules/${id}/${path}`); toast(msg); state.reload(); } catch (e) { toast.error(e); throw e; } };
  const tabs = isNew ? [['details', 'Details']] : [['details', 'Details'], ['questions', `Questions (${m.questions.length})`], ['resources', `Attachments (${m.attachments.length})`], ['assign', 'Assign & progress'], ['versions', 'Versions'], ['preview', 'Preview']];

  return (
    <Page
      title={isNew ? 'New module' : m.title}
      subtitle={isNew ? undefined : `Version ${m.version}`}
      actions={!isNew && (
        <>
          <StatusBadge status={m.status} />
          {m.status !== 'published' && <button className="btn primary" onClick={act('publish', 'Published')}>Publish</button>}
          {m.status === 'published' && <button className="btn" onClick={() => setDialog('version')}>Publish new version…</button>}
          {m.status === 'published' && <button className="btn" onClick={() => setDialog('archive')}>Archive</button>}
        </>
      )}
    >
      <p className="small"><Link to="/manage/modules">← All modules</Link></p>
      <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'details' && <DetailsTab key={m?.updated_at ?? 'new'} module={m} brands={brands.data} modules={modules.data} onSaved={() => { state.reload(); modules.reload(); }} />}
      {tab === 'questions' && <QuestionsTab module={m} onSaved={state.reload} />}
      {tab === 'resources' && <AttachmentsEditor owner={{ moduleId: m.id }} items={m.attachments} onChanged={state.reload} />}
      {tab === 'assign' && <AssignTab module={m} />}
      {tab === 'versions' && <VersionsTab module={m} />}
      {tab === 'preview' && <PreviewTab module={m} />}
      {dialog === 'version' && <NewVersion module={m} onClose={() => setDialog(null)} onDone={() => { setDialog(null); state.reload(); }} />}
      {dialog === 'archive' && <Confirm danger title="Archive module" message="Staff will no longer see this module. All records are kept and you can publish it again later." confirmLabel="Archive" onClose={() => setDialog(null)} onConfirm={act('archive', 'Archived')} />}
    </Page>
  );
}
