'use client';

import { useEffect, useState } from 'react';
import { getSites } from '../lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSites()
      .then((data) => setSites(data.sites || []))
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your chatbot sites</p>
        </div>
        <Link href="/sites/new" className="btn btn-primary">
          + New Site
        </Link>
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
