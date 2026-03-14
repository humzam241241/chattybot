'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../../components/SiteLayout';
import { useAuth } from '../../../../../../contexts/AuthContext';
import { getJob, updateJob, addJobTask, updateJobTask, createInvoice, getTechnicians } from '../../../../../../lib/api';

export default function JobDetailPage() {
  const { id: siteId, job_id: jobId } = useParams();
  const { session } = useAuth();
  const [job, setJob] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!session?.access_token || !siteId || !jobId) return;
    getJob(siteId, jobId).then(setJob).catch(() => setJob(null)).finally(() => setLoading(false));
  }, [session, siteId, jobId]);

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    getTechnicians(siteId).then((t) => setTechnicians(Array.isArray(t) ? t : [])).catch(() => setTechnicians([]));
  }, [session, siteId]);

  async function handleStatusChange(status) {
    try {
      const updated = await updateJob(siteId, jobId, { job_status: status });
      setJob(updated);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTaskDesc.trim()) return;
    try {
      await addJobTask(siteId, jobId, { description: newTaskDesc.trim() });
      const updated = await getJob(siteId, jobId);
      setJob(updated);
      setNewTaskDesc('');
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleCreateInvoice() {
    if (!job?.customer_id) return;
    setCreatingInvoice(true);
    try {
      const inv = await createInvoice(siteId, { customer_id: job.customer_id, job_id: jobId });
      if (inv?.id) router.push(`/dashboard/sites/${siteId}/invoices/${inv.id}`);
      else alert('Could not create invoice.');
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingInvoice(false);
    }
  }

  if (loading || !job) {
    return <SiteLayout siteId={siteId}><p className="text-muted">Loading…</p></SiteLayout>;
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <Link href={`/dashboard/sites/${siteId}/jobs`} className="text-muted" style={{ fontSize: 14 }}>← Jobs</Link>
          <h1 className="page-title">{job.title}</h1>
          <p className="page-subtitle">{job.customer_name} · {job.job_status}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="input" value={job.job_status} onChange={(e) => handleStatusChange(e.target.value)} style={{ width: 'auto' }}>
            <option value="lead">Lead</option>
            <option value="scheduled">Scheduled</option>
            <option value="dispatched">Dispatched</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Link href={`/dashboard/sites/${siteId}/customers/${job.customer_id}`} className="btn btn-secondary">Customer</Link>
          {job.estimate_id && <Link href={`/dashboard/sites/${siteId}/estimates/${job.estimate_id}`} className="btn btn-secondary">Estimate</Link>}
          <Link href={`/dashboard/sites/${siteId}/dispatch?job_id=${jobId}`} className="btn btn-secondary">Send to dispatch</Link>
          <button type="button" className="btn btn-primary" onClick={handleCreateInvoice} disabled={creatingInvoice}>
            {creatingInvoice ? '...' : 'Create invoice'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Customer & details</div>
        <p><strong>Customer:</strong> <Link href={`/dashboard/sites/${siteId}/customers/${job.customer_id}`}>{job.customer_name}</Link></p>
        <p><strong>Contact:</strong> {job.customer_email || job.customer_phone || '—'}</p>
        <p>
          <strong>Technician:</strong>{' '}
          <select className="input" style={{ width: 'auto', display: 'inline-block' }} value={job.technician_id || ''} onChange={(e) => handleTechnicianChange(e.target.value)}>
            <option value="">— Unassigned —</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </p>
        {job.description && <p><strong>Description:</strong> {job.description}</p>}
        {job.scheduled_date && <p><strong>Scheduled:</strong> {new Date(job.scheduled_date).toLocaleString()}</p>}
      </div>

      <div className="card">
        <div className="card-title">Tasks</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px 0' }}>
          {(job.tasks || []).map((t) => (
            <li key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t.description}</span>
              <span className="badge">{t.status}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddTask} style={{ display: 'flex', gap: 8 }}>
          <input type="text" className="input" placeholder="New task" value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
        </form>
      </div>
    </SiteLayout>
  );
}
