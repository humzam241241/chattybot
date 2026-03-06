'use client';

import { useEffect, useState } from 'react';
import { getSites, triggerReconciliation } from '../lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  async function loadSites() {
    try {
      const data = await getSites();
      setSites(data.sites || []);
    } catch {
      setSites([]);
    }
  }

  useEffect(() => {
    loadSites().finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setLoading(true);
    await loadSites();
    setLoading(false);
  }

  async function handleReconcile() {
    if (!confirm('Scan the database for missed lead data? This may take a few minutes.')) return;
    
    setReconciling(true);
    try {
      const result = await triggerReconciliation();
      alert(`Data reconciliation started. Check the backend logs for results.`);
    } catch (err) {
      alert(`Failed to start reconciliation: ${err.message}`);
    } finally {
      setReconciling(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your chatbot clients</p>
        </div>
        <div className="flex gap-2">
          <button 
            className="btn btn-secondary" 
            onClick={handleReconcile} 
            disabled={reconciling}
            title="Scan database to recover missed lead data"
          >
            {reconciling ? '...' : '🔄 Scan for Missed Data'}
          </button>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
          <Link href="/sites/new" className="btn btn-primary">
            + New Client
          </Link>
        </div>
      </div>

      {loading && <p className="text-muted">Loading...</p>}

      {!loading && sites.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🚀</p>
          <p className="card-title">No sites yet</p>
          <p className="card-meta" style={{ marginBottom: 20 }}>
            Create your first site to start using ChattyBot.
          </p>
          <Link href="/sites/new" className="btn btn-primary">
            Create Site
          </Link>
        </div>
      )}

      <div>
        {sites.map((site) => (
          <div key={site.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  className="color-dot"
                  style={{ width: 16, height: 16, background: site.primary_color }}
                />
                <div>
                  <div className="card-title">{site.company_name}</div>
                  <div className="card-meta">{site.domain || 'No domain set'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/sites/${site.id}`} className="btn btn-secondary btn-sm">
                  Edit
                </Link>
                <Link href={`/sites/${site.id}/leads`} className="btn btn-secondary btn-sm">
                  Leads
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
