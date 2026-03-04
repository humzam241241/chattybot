'use client';

import { useEffect, useState } from 'react';
import { getSites, deleteSite } from '../../lib/api';
import Link from 'next/link';

export default function SitesPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchSites();
  }, []);

  async function fetchSites() {
    try {
      const data = await getSites();
      setSites(data.sites || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This will remove all documents and leads.`)) return;
    setDeletingId(id);
    try {
      await deleteSite(id);
      setSites((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sites</h1>
          <p className="page-subtitle">All registered chatbot sites</p>
        </div>
        <Link href="/sites/new" className="btn btn-primary">+ New Site</Link>
      </div>

      {loading && <p className="text-muted">Loading...</p>}

      {!loading && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Domain</th>
                  <th>Color</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sites.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                      No sites yet.{' '}
                      <Link href="/sites/new" style={{ color: 'var(--primary)' }}>
                        Create one
                      </Link>
                    </td>
                  </tr>
                )}
                {sites.map((site) => (
                  <tr key={site.id}>
                    <td>
                      <Link href={`/sites/${site.id}`} style={{ fontWeight: 500, color: 'var(--primary)', textDecoration: 'none' }}>
                        {site.company_name}
                      </Link>
                    </td>
                    <td className="text-muted">{site.domain || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          className="color-dot"
                          style={{ background: site.primary_color }}
                        />
                        <span className="text-muted">{site.primary_color}</span>
                      </div>
                    </td>
                    <td className="text-muted">
                      {new Date(site.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                        <Link href={`/sites/${site.id}/conversations`} className="btn btn-secondary btn-sm">
                          💬 Chats
                        </Link>
                        <Link href={`/sites/${site.id}/leads`} className="btn btn-secondary btn-sm">
                          👥 Leads
                        </Link>
                        <Link href={`/sites/${site.id}/files`} className="btn btn-secondary btn-sm">
                          📁 Files
                        </Link>
                        <Link href={`/sites/${site.id}/settings`} className="btn btn-secondary btn-sm">
                          ⚙️ Settings
                        </Link>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(site.id, site.company_name)}
                          disabled={deletingId === site.id}
                        >
                          {deletingId === site.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
