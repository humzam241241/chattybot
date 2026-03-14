'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';
import { getPipelineSummary } from '../../../../../lib/api';

export default function PipelinePage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  function loadPipeline() {
    if (!siteId) return;
    setLoading(true);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - range);
    getPipelineSummary(siteId, { from_date: from.toISOString().slice(0, 10), to_date: to.toISOString().slice(0, 10) })
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    loadPipeline();
  }, [session, siteId, range]);

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pipeline</h1>
          <p className="page-subtitle">Leads → jobs → revenue</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={loadPipeline} disabled={loading}>{loading ? '...' : 'Refresh'}</button>
          <select className="input" value={range} onChange={(e) => setRange(Number(e.target.value))} style={{ width: 'auto' }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {loading && <p className="text-muted">Loading...</p>}

      {!loading && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          <div className="card">
            <div className="card-title">Revenue</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>${Number(summary.revenue || 0).toFixed(2)}</div>
          </div>
          <div className="card">
            <div className="card-title">Avg job value</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>${Number(summary.average_job_value || 0).toFixed(2)}</div>
          </div>
          <div className="card">
            <div className="card-title">Paid jobs</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.job_count || 0}</div>
          </div>
        </div>
      )}

      {!loading && summary?.jobs_by_status && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Jobs by status</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(summary.jobs_by_status).map(([status, count]) => (
              <div key={status}>
                <span className="badge">{status.replace(/_/g, ' ')}</span> <strong>{count}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !summary && <div className="card"><p className="text-muted">No pipeline data yet.</p></div>}
    </SiteLayout>
  );
}
