'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../../components/SiteLayout';
import { useAuth } from '../../../../../../contexts/AuthContext';
import { getCustomer, updateCustomer, deleteCustomer, getJobs } from '../../../../../../lib/api';

export default function CustomerDetailPage() {
  const { id: siteId, customer_id: customerId } = useParams();
  const { session } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !siteId || !customerId) return;
    Promise.all([getCustomer(siteId, customerId), getJobs(siteId, { customer_id: customerId })])
      .then(([c, j]) => {
        setCustomer(c);
        setJobs(j || []);
      })
      .catch(() => setCustomer(null))
      .finally(() => setLoading(false));
  }, [session, siteId, customerId]);

  async function handleDelete() {
    if (!confirm('Delete this customer? This may fail if they have jobs or invoices.')) return;
    try {
      await deleteCustomer(siteId, customerId);
      window.location.href = `/dashboard/sites/${siteId}/customers`;
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!customer) return;
    setSaving(true);
    try {
      const updated = await updateCustomer(siteId, customerId, {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        company: customer.company,
        address: customer.address,
        notes: customer.notes,
      });
      setCustomer(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !customer) {
    return (
      <SiteLayout siteId={siteId}>
        <p className="text-muted">Loading…</p>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <Link href={`/dashboard/sites/${siteId}/customers`} className="text-muted" style={{ display: 'inline-block', marginBottom: 8, fontSize: 14 }}>← Customers</Link>
          <h1 className="page-title">{customer.name}</h1>
          <p className="page-subtitle">{customer.email || customer.phone || 'No contact'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/dashboard/sites/${siteId}/jobs/new?customer_id=${customerId}`} className="btn btn-primary">New Job</Link>
          <button type="button" className="btn btn-secondary" onClick={handleDelete}>Delete</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Details</div>
        <form onSubmit={handleSave} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
          <div>
            <label className="block" style={{ marginBottom: 4, fontWeight: 600 }}>Name</label>
            <input type="text" className="input" style={{ width: '100%' }} value={customer.name || ''} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 4, fontWeight: 600 }}>Phone</label>
            <input type="text" className="input" style={{ width: '100%' }} value={customer.phone || ''} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 4, fontWeight: 600 }}>Email</label>
            <input type="email" className="input" style={{ width: '100%' }} value={customer.email || ''} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 4, fontWeight: 600 }}>Company</label>
            <input type="text" className="input" style={{ width: '100%' }} value={customer.company || ''} onChange={(e) => setCustomer((c) => ({ ...c, company: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 4, fontWeight: 600 }}>Address</label>
            <input type="text" className="input" style={{ width: '100%' }} value={customer.address || ''} onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 4, fontWeight: 600 }}>Notes</label>
            <textarea className="input" rows={2} style={{ width: '100%' }} value={customer.notes || ''} onChange={(e) => setCustomer((c) => ({ ...c, notes: e.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'fit-content' }}>{saving ? 'Saving…' : 'Save'}</button>
        </form>
      </div>

      <div className="card">
        <div className="card-title">Jobs</div>
        {jobs.length === 0 ? (
          <p className="text-muted">No jobs yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {jobs.map((j) => (
              <li key={j.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <Link href={`/dashboard/sites/${siteId}/jobs/${j.id}`}>{j.title}</Link>
                <span className="badge" style={{ marginLeft: 8 }}>{j.job_status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteLayout>
  );
}
