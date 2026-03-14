'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';
import { getJobs } from '../../../../../lib/api';

const STATUSES = ['lead', 'scheduled', 'dispatched', 'in_progress', 'completed', 'cancelled'];

export default function JobsPage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    getJobs(siteId, filter !== 'all' ? { status: filter } : {})
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [session, siteId, filter]);

  const byStatus = {};
  STATUSES.forEach((s) => { byStatus[s] = []; });
  jobs.forEach((j) => {
    if (byStatus[j.job_status]) byStatus[j.job_status].push(j);
  });

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">Job pipeline</p>
        </div>
        <Link href={`/dashboard/sites/${siteId}/jobs/new`} className="btn btn-primary">New Job</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', ...STATUSES].map((s) => (
            <button key={s} type="button" className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-muted">Loading jobs...</p>}

      {!loading && filter === 'all' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {STATUSES.map((status) => (
            <div key={status} className="card" style={{ minHeight: 120 }}>
              <div className="card-title" style={{ textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(byStatus[status] || []).map((j) => (
                  <Link key={j.id} href={`/dashboard/sites/${siteId}/jobs/${j.id}`} style={{ padding: 8, background: 'var(--bg)', borderRadius: 8, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontWeight: 600 }}>{j.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{j.customer_name}</div>
                  </Link>
                ))}
                {(!byStatus[status] || byStatus[status].length === 0) && <p className="text-muted" style={{ fontSize: 13 }}>None</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filter !== 'all' && (
        <div className="card">
          <div className="table-wrap">
            <table style={{ minWidth: 500 }}>
              <thead>
                <tr><th>Title</th><th>Customer</th><th>Status</th><th>Scheduled</th><th></th></tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td><strong>{j.title}</strong></td>
                    <td>{j.customer_name}</td>
                    <td><span className="badge">{j.job_status}</span></td>
                    <td>{j.scheduled_date ? new Date(j.scheduled_date).toLocaleDateString() : '—'}</td>
                    <td><Link href={`/dashboard/sites/${siteId}/jobs/${j.id}`} className="btn btn-secondary btn-sm">View</Link></td>
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
