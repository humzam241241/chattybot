'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../../components/SiteLayout';
import { useAuth } from '../../../../../../contexts/AuthContext';
import { createCustomer } from '../../../../../../lib/api';

export default function NewCustomerPage() {
  const { id: siteId } = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const customer = await createCustomer(siteId, form);
      router.push(`/dashboard/sites/${siteId}/customers/${customer.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <Link href={`/dashboard/sites/${siteId}/customers`} className="text-muted" style={{ display: 'inline-block', marginBottom: 8, fontSize: 14 }}>← Customers</Link>
          <h1 className="page-title">New Customer</h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Name *</label>
            <input type="text" className="input" style={{ width: '100%' }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Phone</label>
            <input type="text" className="input" style={{ width: '100%' }} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Email</label>
            <input type="email" className="input" style={{ width: '100%' }} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Company</label>
            <input type="text" className="input" style={{ width: '100%' }} value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Address</label>
            <input type="text" className="input" style={{ width: '100%' }} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Notes</label>
            <textarea className="input" rows={3} style={{ width: '100%' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create Customer'}</button>
            <Link href={`/dashboard/sites/${siteId}/customers`} className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </SiteLayout>
  );
}
