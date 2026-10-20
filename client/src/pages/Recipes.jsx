import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Attachments from '../Attachments.jsx';
import SecureVideo from '../SecureVideo.jsx';
import ShiftGate from '../ShiftGate.jsx';
import { Badge, Card, Loading, Page, useLoad } from '../ui.jsx';

function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function List() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const dq = useDebounced(q);
  const state = useLoad(() => api.get(`/api/recipes?${new URLSearchParams({ ...(dq && { q: dq }), ...(category && { category }) })}`), [dq, category]);
  const all = useLoad(() => api.get('/api/recipes'), []);
  const categories = [...new Set((all.data || []).map((r) => r.category))].sort();

  return (
    <>
      <div className="form-grid" style={{ marginBottom: '1rem' }}>
        <input type="search" placeholder="Search recipes or ingredients…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {!state.data ? <Loading state={state} /> : state.data.length === 0 ? (
        <div className="notice">No recipes found.</div>
      ) : (
        <div className="cards">
          {state.data.map((r) => (
            <Link className="card" key={r.id} to={`/recipes/${r.id}`}>
              {r.has_image && <img src={`/api/media/recipes/${r.id}/image`} alt="" loading="lazy" draggable="false" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, marginBottom: '.5rem' }} />}
              <b>{r.name}</b>
              <p className="muted small">{r.category}{r.brand_name ? ` · ${r.brand_name}` : ''}</p>
              <p className="small">{[r.portion_size, r.yield && `Yield: ${r.yield}`].filter(Boolean).join(' · ')}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function RecipeList() {
  return <Page title="Recipes" subtitle="Search and replay any recipe for your brand and role — no assessment needed."><ShiftGate><List /></ShiftGate></Page>;
}

const Section = ({ title, children }) => (children ? <Card><h2>{title}</h2><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{children}</p></Card> : null);

function Detail() {
  const { id } = useParams();
  const state = useLoad(() => api.get(`/api/recipes/${id}`), [id]);
  const r = state.data;
  if (!r) return <Loading state={state} />;
  return (
    <Page title={r.name} subtitle={`${r.category}${r.brand_name ? ` · ${r.brand_name}` : ''}`}>
      <p className="small"><Link to="/recipes">← All recipes</Link></p>
      <div className="stack">
        {r.has_video && <SecureVideo source={{ type: 'recipe', id }} />}
        <div className="row">
          {r.portion_size && <Badge tone="blue">Portion: {r.portion_size}</Badge>}
          {r.yield && <Badge tone="blue">Yield: {r.yield}</Badge>}
        </div>
        {r.ingredients.length > 0 && (
          <Card>
            <h2>Ingredients</h2>
            <table className="ingredients"><tbody>{r.ingredients.map((i, n) => <tr key={n}><td>{i.name}</td><td><b>{i.quantity}</b> {i.unit}</td></tr>)}</tbody></table>
          </Card>
        )}
        <Section title="Equipment">{r.equipment}</Section>
        {r.steps.length > 0 && <Card><h2>Preparation steps</h2><ol>{r.steps.map((s, n) => <li key={n}>{s}</li>)}</ol></Card>}
        <Section title="Cooking / heating">{r.cooking_instructions}</Section>
        {r.has_image && <Card><h2>Plating</h2><img src={`/api/media/recipes/${id}/image`} alt={`${r.name} plated`} draggable="false" onContextMenu={(e) => e.preventDefault()} style={{ width: '100%', borderRadius: 8 }} /></Card>}
        <Section title="Storage">{[r.storage, r.shelf_life && `Shelf life: ${r.shelf_life}`].filter(Boolean).join('\n')}</Section>
        <Section title="Food safety">{r.food_safety}</Section>
        <Section title="Common mistakes">{r.common_mistakes}</Section>
        <Section title="Quality checkpoints">{r.quality_checkpoints}</Section>
        <Attachments items={r.attachments} />
      </div>
    </Page>
  );
}

export function RecipeDetail() {
  return <ShiftGate><Detail /></ShiftGate>;
}
