'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../../components/SiteLayout';
import { useAuth } from '../../../../../../contexts/AuthContext';
import { getCustomers, getJobs, createInvoice } from '../../../../../../lib/api';

export default function NewInvoicePage() {
  const { id: siteId } = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({ customer_id: '', job_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    Promise.all([
      getCustomers(siteId).then((c) => setCustomers(Array.isArray(c) ? c : [])).catch(() => setCustomers([])),
      getJobs(siteId).then((j) => setJobs(Array.isArray(j) ? j : [])).catch(() => setJobs([])),
    ]);
  }, [session, siteId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customer_id) return;
    setSaving(true);
    try {
      const inv = await createInvoice(siteId, {
        customer_id: form.customer_id,
        job_id: form.job_id || undefined,
      });
      if (inv?.id) router.push(`/dashboard/sites/${siteId}/invoices/${inv.id}`);
      else alert('Could not create invoice.');
    } catch (err) {
      alert(err?.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <Link href={`/dashboard/sites/${siteId}/invoices`} className="text-muted" style={{ fontSize: 14 }}>← Invoices</Link>
          <h1 className="page-title">New invoice</h1>
          <p className="page-subtitle">Manual invoice — add line items on the next screen</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Customer *</label>
            <select className="input" style={{ width: '100%' }} value={form.customer_id} onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))} required>
              <option value="">Select customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Job (optional)</label>
            <select className="input" style={{ width: '100%' }} value={form.job_id} onChange={(e) => setForm((f) => ({ ...f, job_id: e.target.value }))}>
              <option value="">— None —</option>
              {jobs.filter((j) => !form.customer_id || j.customer_id === form.customer_id).map((j) => (
                <option key={j.id} value={j.id}>{j.title} — {j.customer_name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create invoice'}</button>
            <Link href={`/dashboard/sites/${siteId}/invoices`} className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </SiteLayout>
  );
}
