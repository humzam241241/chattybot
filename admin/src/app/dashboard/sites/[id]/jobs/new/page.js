'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../../components/SiteLayout';
import { useAuth } from '../../../../../../contexts/AuthContext';
import { createJob, getCustomers } from '../../../../../../lib/api';

export default function NewJobPage() {
  const { id: siteId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customer_id: searchParams.get('customer_id') || '', title: '', description: '', job_status: 'lead', priority: 'normal' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    getCustomers(siteId).then((data) => setCustomers(Array.isArray(data) ? data : [])).catch(() => setCustomers([]));
  }, [session, siteId]);

  useEffect(() => {
    const cid = searchParams.get('customer_id');
    if (cid) setForm((f) => ({ ...f, customer_id: cid }));
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customer_id || !form.title?.trim()) return;
    setSaving(true);
    try {
      const job = await createJob(siteId, form);
      if (!job || !job.id) {
        alert('Could not create job. Please try again.');
        return;
      }
      router.push(`/dashboard/sites/${siteId}/jobs/${job.id}`);
    } catch (err) {
      alert(err?.message || 'Failed to create job');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <Link href={`/dashboard/sites/${siteId}/jobs`} className="text-muted" style={{ fontSize: 14 }}>← Jobs</Link>
          <h1 className="page-title">New Job</h1>
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
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Title *</label>
            <input type="text" className="input" style={{ width: '100%' }} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Description</label>
            <textarea className="input" rows={3} style={{ width: '100%' }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block" style={{ marginBottom: 6, fontWeight: 600 }}>Status</label>
            <select className="input" style={{ width: '100%' }} value={form.job_status} onChange={(e) => setForm((f) => ({ ...f, job_status: e.target.value }))}>
              <option value="lead">Lead</option>
              <option value="scheduled">Scheduled</option>
              <option value="dispatched">Dispatched</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create Job'}</button>
            <Link href={`/dashboard/sites/${siteId}/jobs`} className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </SiteLayout>
  );
}
