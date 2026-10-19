import { useState } from 'react';
import { api } from '../api.js';
import { Card, Field, Loading, Page, useLoad, useToast } from '../ui.jsx';

export default function Org() {
  const toast = useToast();
  const brands = useLoad(() => api.get('/api/org/brands'));
  const outlets = useLoad(() => api.get('/api/org/outlets'));
  const franchisees = useLoad(() => api.get('/api/admin/users?role=franchisee&active=true'));
  const [brand, setBrand] = useState('');
  const [outlet, setOutlet] = useState({ name: '', brandId: '', franchiseeId: '' });

  async function run(fn, done) {
    try { await fn(); toast('Saved'); done?.(); brands.reload(); outlets.reload(); } catch (e) { toast.error(e); }
  }

  return (
    <Page title="Brands & outlets" subtitle="Training, recipes and reports are restricted by brand and outlet. Franchisees see the outlets assigned to them here.">
      <div className="form-grid" style={{ alignItems: 'start' }}>
        <Card>
          <h2>Brands</h2>
          {!brands.data ? <Loading state={brands} /> : <ul>{brands.data.map((b) => <li key={b.id}>{b.name}</li>)}</ul>}
          <form className="row" onSubmit={(e) => { e.preventDefault(); run(() => api.post('/api/org/brands', { name: brand }), () => setBrand('')); }}>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="New brand name" required style={{ flex: 1 }} />
            <button className="btn primary">Add</button>
          </form>
        </Card>
        <Card>
          <h2>Add outlet</h2>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); run(() => api.post('/api/org/outlets', { name: outlet.name, brandId: Number(outlet.brandId), franchiseeId: outlet.franchiseeId ? Number(outlet.franchiseeId) : null }), () => setOutlet({ name: '', brandId: '', franchiseeId: '' })); }}>
            <Field label="Outlet name"><input value={outlet.name} onChange={(e) => setOutlet({ ...outlet, name: e.target.value })} required /></Field>
            <Field label="Brand"><select value={outlet.brandId} onChange={(e) => setOutlet({ ...outlet, brandId: e.target.value })} required><option value="">Select…</option>{(brands.data || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Franchisee (optional)"><select value={outlet.franchiseeId} onChange={(e) => setOutlet({ ...outlet, franchiseeId: e.target.value })}><option value="">Company-owned</option>{(franchisees.data || []).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.employee_id})</option>)}</select></Field>
            <button className="btn primary">Add outlet</button>
          </form>
        </Card>
      </div>
      <h3>Outlets</h3>
      {!outlets.data ? <Loading state={outlets} /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Outlet</th><th>Brand</th><th>Franchisee</th></tr></thead>
            <tbody>
              {outlets.data.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td><td>{o.brand_name}</td>
                  <td>
                    <select value={o.franchisee_id || ''} aria-label={`Franchisee for ${o.name}`} onChange={(e) => run(() => api.patch(`/api/org/outlets/${o.id}`, { franchiseeId: e.target.value ? Number(e.target.value) : null }))}>
                      <option value="">Company-owned</option>
                      {(franchisees.data || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
