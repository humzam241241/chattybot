'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';
import { getTechnicians, createTechnician } from '../../../../../lib/api';

export default function TechniciansPage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', role: '', active: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    getTechnicians(siteId).then(setList).catch(() => setList([])).finally(() => setLoading(false));
  }, [session, siteId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      const tech = await createTechnician(siteId, form);
      setList((prev) => [...prev, tech]);
      setForm({ name: '', phone: '', role: '', active: true });
      setShowForm(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Technicians</h1>
          <p className="page-subtitle">Team members for dispatch</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add Technician'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
            <input type="text" className="input" placeholder="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            <input type="text" className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <input type="text" className="input" placeholder="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active
            </label>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
          </form>
        </div>
      )}

      {loading && <p className="text-muted">Loading...</p>}
      {!loading && list.length === 0 && !showForm && <div className="card"><p className="text-muted">No technicians. Add one to get started.</p></div>}
      {!loading && list.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Role</th><th>Active</th></tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.phone || '—'}</td>
                    <td>{t.role || '—'}</td>
                    <td>{t.active ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
