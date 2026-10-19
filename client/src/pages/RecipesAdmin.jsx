import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, uploadFile } from '../api.js';
import SecureVideo from '../SecureVideo.jsx';
import { Badge, Card, Field, LEARNER_ROLES, Loading, Page, ROLE_LABEL, StatusBadge, fmtDate, useLoad, useToast } from '../ui.jsx';

export function RecipeAdminList() {
  const state = useLoad(() => api.get('/api/admin/recipes'));
  return (
    <Page title="Recipes" subtitle="The recipe & SOP library. Staff only see published recipes for their brand and role." actions={<Link className="btn primary" to="/manage/recipes/new">+ New recipe</Link>}>
      {!state.data ? <Loading state={state} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Recipe</th><th>Brand</th><th>Visible to</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {state.data.map((r) => (
                <tr key={r.id} className={r.status === 'archived' ? 'inactive' : ''}>
                  <td><Link to={`/manage/recipes/${r.id}`}><b>{r.name}</b></Link><div className="muted small">{r.category}</div></td>
                  <td>{r.brand_name || 'All brands'}</td><td>{r.roles.map((x) => ROLE_LABEL[x]).join(', ')}</td>
                  <td><StatusBadge status={r.status} /></td><td>{fmtDate(r.updated_at)}</td>
                </tr>
              ))}
              {state.data.length === 0 && <tr><td colSpan="5" className="muted">No recipes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

const NEW = {
  name: '', brandId: '', category: 'General', roles: ['team_member', 'outlet_incharge', 'franchisee'], status: 'draft', videoKey: null, imageKey: null, portionSize: '', yield: '',
  equipment: '', ingredients: [{ name: '', quantity: '', unit: '' }], stepsText: '', cookingInstructions: '', storage: '', shelfLife: '', foodSafety: '', commonMistakes: '', qualityCheckpoints: '',
};
const fromRecipe = (r) => ({
  ...NEW, name: r.name, brandId: r.brand_id ?? '', category: r.category, roles: r.roles, status: r.status, videoKey: r.video_key, imageKey: r.image_key,
  portionSize: r.portion_size, yield: r.yield, equipment: r.equipment, ingredients: r.ingredients.length ? r.ingredients : NEW.ingredients, stepsText: r.steps.join('\n'),
  cookingInstructions: r.cooking_instructions, storage: r.storage, shelfLife: r.shelf_life, foodSafety: r.food_safety, commonMistakes: r.common_mistakes, qualityCheckpoints: r.quality_checkpoints,
});

export function RecipeEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const toast = useToast();
  const brands = useLoad(() => api.get('/api/org/brands'));
  const state = useLoad(() => (isNew ? Promise.resolve(null) : api.get(`/api/admin/recipes/${id}`)), [id]);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');

  if (!isNew && !state.data) return <Loading state={state} />;
  if (!brands.data) return <Loading state={brands} />;
  const form = f ?? (isNew ? NEW : fromRecipe(state.data));
  const update = (change) => setF({ ...form, ...change });
  const set = (k) => (e) => update({ [k]: e.target.value });
  const setIng = (i, change) => update({ ingredients: form.ingredients.map((x, n) => (n === i ? { ...x, ...change } : x)) });
  const toggleRole = (r) => update({ roles: form.roles.includes(r) ? form.roles.filter((x) => x !== r) : [...form.roles, r] });

  async function pick(kind, e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(kind);
    try {
      update({ [kind === 'video' ? 'videoKey' : 'imageKey']: await uploadFile(file, kind) });
      toast(`${kind === 'video' ? 'Video' : 'Image'} uploaded — remember to save`);
    } catch (err) {
      toast.error(err);
    } finally {
      setUploading('');
      e.target.value = '';
    }
  }

  async function save(status) {
    setBusy(true);
    const body = {
      name: form.name.trim(), brandId: form.brandId === '' ? null : Number(form.brandId), category: form.category.trim() || 'General', roles: form.roles, status: status ?? form.status,
      videoKey: form.videoKey, imageKey: form.imageKey, portionSize: form.portionSize, yield: form.yield, equipment: form.equipment,
      ingredients: form.ingredients.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), quantity: String(i.quantity).trim(), unit: i.unit.trim() })),
      steps: form.stepsText.split('\n').map((s) => s.trim()).filter(Boolean), cookingInstructions: form.cookingInstructions, storage: form.storage,
      shelfLife: form.shelfLife, foodSafety: form.foodSafety, commonMistakes: form.commonMistakes, qualityCheckpoints: form.qualityCheckpoints,
    };
    try {
      if (isNew) {
        const r = await api.post('/api/admin/recipes', body);
        toast('Recipe created');
        navigate(`/manage/recipes/${r.id}`, { replace: true });
      } else {
        await api.patch(`/api/admin/recipes/${id}`, body);
        toast(status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Saved');
        setF(null);
        state.reload();
      }
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  const text = (k, label, rows = 3) => <Field label={label} wide><textarea style={{ minHeight: rows * 28 }} value={form[k]} onChange={set(k)} /></Field>;

  return (
    <Page
      title={isNew ? 'New recipe' : form.name || 'Recipe'}
      actions={<>
        {!isNew && <StatusBadge status={state.data.status} />}
        <button className="btn" disabled={busy} onClick={() => save()}>Save</button>
        {form.status !== 'published' && <button className="btn primary" disabled={busy || !form.name.trim()} onClick={() => save('published')}>Save & publish</button>}
        {!isNew && form.status === 'published' && <button className="btn" disabled={busy} onClick={() => save('archived')}>Archive</button>}
      </>}
    >
      <p className="small"><Link to="/manage/recipes">← All recipes</Link></p>
      <div className="stack">
        <Card>
          <div className="form-grid">
            <Field label="Recipe name" wide><input value={form.name} onChange={set('name')} required /></Field>
            <Field label="Brand"><select value={form.brandId} onChange={set('brandId')}><option value="">All brands</option>{brands.data.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Category"><input value={form.category} onChange={set('category')} /></Field>
            <Field label="Portion size"><input value={form.portionSize} onChange={set('portionSize')} /></Field>
            <Field label="Yield"><input value={form.yield} onChange={set('yield')} /></Field>
          </div>
          <h3>Visible to</h3>
          <div className="row">{LEARNER_ROLES.map((r) => <label className="check" key={r}><input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />{ROLE_LABEL[r]}</label>)}</div>
        </Card>

        <Card>
          <h2>Media</h2>
          <div className="form-grid">
            <Field label="Preparation video"><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => pick('video', e)} disabled={Boolean(uploading)} /></Field>
            <Field label="Plating image"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick('image', e)} disabled={Boolean(uploading)} /></Field>
          </div>
          {uploading && <p className="notice">Uploading {uploading}… keep this page open.</p>}
          <div className="row">
            {form.videoKey && <><Badge tone="green">Video attached</Badge><button className="btn small" onClick={() => update({ videoKey: null })}>Remove</button></>}
            {form.imageKey && <><Badge tone="green">Image attached</Badge><button className="btn small" onClick={() => update({ imageKey: null })}>Remove</button></>}
          </div>
          {!isNew && state.data.video_key && <div style={{ marginTop: '.75rem' }}><SecureVideo src={`/api/media/recipes/${id}/video`} /></div>}
        </Card>

        <Card>
          <h2>Ingredients & quantities</h2>
          {form.ingredients.map((ing, i) => (
            <div className="row" key={i} style={{ marginBottom: '.4rem', flexWrap: 'nowrap' }}>
              <input style={{ flex: 3 }} placeholder="Ingredient" value={ing.name} onChange={(e) => setIng(i, { name: e.target.value })} aria-label="Ingredient" />
              <input style={{ flex: 1, minWidth: 70 }} placeholder="Qty" value={ing.quantity} onChange={(e) => setIng(i, { quantity: e.target.value })} aria-label="Quantity" />
              <input style={{ flex: 1, minWidth: 70 }} placeholder="Unit" value={ing.unit} onChange={(e) => setIng(i, { unit: e.target.value })} aria-label="Unit" />
              <button className="icon-btn" onClick={() => update({ ingredients: form.ingredients.filter((_, n) => n !== i) })} aria-label="Remove ingredient">✕</button>
            </div>
          ))}
          <button className="btn small" onClick={() => update({ ingredients: [...form.ingredients, { name: '', quantity: '', unit: '' }] })}>+ Ingredient</button>
        </Card>

        <Card>
          <div className="form-grid">
            {text('equipment', 'Equipment required', 2)}
            <Field label="Preparation steps" hint="One step per line" wide><textarea style={{ minHeight: 140 }} value={form.stepsText} onChange={set('stepsText')} /></Field>
            {text('cookingInstructions', 'Cooking / heating instructions')}
            {text('storage', 'Storage instructions', 2)}
            <Field label="Shelf life" wide><input value={form.shelfLife} onChange={set('shelfLife')} /></Field>
            {text('foodSafety', 'Food-safety instructions')}
            {text('commonMistakes', 'Common mistakes')}
            {text('qualityCheckpoints', 'Quality checkpoints')}
          </div>
        </Card>
      </div>
    </Page>
  );
}
