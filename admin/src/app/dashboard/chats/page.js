'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSites, listAllConversations } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';

export default function AllChatsPage() {
  const { isAdmin, hasAccess } = useAuth();

  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [siteId, setSiteId] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [data, setData] = useState({ conversations: [], pagination: { total: 0, limit, offset: 0 } });

  const canView = hasAccess || isAdmin;

  const selectedSiteName = useMemo(() => {
    if (!siteId) return 'All clients';
    return sites.find((s) => s.id === siteId)?.company_name || 'Client';
  }, [siteId, sites]);

  async function load() {
    setError('');
    const [sitesRes, convRes] = await Promise.all([
      getSites(),
      listAllConversations({ siteId: siteId || null, q: q || null, limit, offset }),
    ]);
    setSites(sitesRes?.sites || []);
    setData(convRes || { conversations: [], pagination: { total: 0, limit, offset } });
  }

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, offset]);

  const total = data?.pagination?.total || 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  function goToPage(page) {
    const p = Math.max(1, Math.min(page, totalPages));
    setOffset((p - 1) * limit);
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Chats</h1>
          <p className="page-subtitle">
            {selectedSiteName} • Showing {pageStart}–{pageEnd} of {total}
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => { setOffset(0); setLoading(true); load().finally(() => setLoading(false)); }} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {!canView && (
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <h3>Upgrade to unlock chats</h3>
          <p>Your account doesn’t have an active plan right now.</p>
          <Link href="/pricing" className="btn btn-primary" style={{ marginTop: 16 }}>
            View plans
          </Link>
        </div>
      )}

      {canView && (
        <>
          <div className="card" style={{ padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="text-muted" style={{ fontSize: 13 }}>Client</label>
            <select className="input" value={siteId} onChange={(e) => { setOffset(0); setSiteId(e.target.value); }}>
              <option value="">All clients</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.company_name}</option>
              ))}
            </select>
            <label className="text-muted" style={{ fontSize: 13 }}>Search</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Visitor ID or summary…"
              style={{ minWidth: 260, flex: 1 }}
            />
            <button
              className="btn btn-secondary"
              onClick={() => { setOffset(0); setLoading(true); load().finally(() => setLoading(false)); }}
              disabled={loading}
            >
              Search
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Visitor</th>
                    <th>Messages</th>
                    <th>Updated</th>
                    <th>Summary</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.conversations || []).length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                        {loading ? 'Loading chats…' : 'No chats found.'}
                      </td>
                    </tr>
                  )}
                  {(data?.conversations || []).map((c) => (
                    <tr key={c.id}>
                      <td>{c.site_name || '—'}</td>
                      <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
                        {c.visitor_id || '—'}
                      </td>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{c.message_count || 0}</td>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                        {c.updated_at ? new Date(c.updated_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ maxWidth: 420 }}>
                        <span className="text-muted">
                          {c.summary ? (c.summary.length > 120 ? `${c.summary.slice(0, 120)}…` : c.summary) : '—'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Link href={`/dashboard/sites/${c.site_id}/conversations/${c.id}`} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <button
              className="btn btn-secondary"
              disabled={offset === 0 || loading}
              onClick={() => goToPage(currentPage - 1)}
            >
              ← Prev
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#475569', marginRight: 8 }}>
                {pageStart}–{pageEnd} of {total}
              </span>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p;
                if (totalPages <= 7) p = i + 1;
                else if (currentPage <= 4) p = i + 1;
                else if (currentPage >= totalPages - 3) p = totalPages - 6 + i;
                else p = currentPage - 3 + i;
                if (p < 1) return null;
                return (
                  <button
                    key={p}
                    type="button"
                    className="btn btn-sm"
                    style={{
                      minWidth: 32,
                      ...(p === currentPage ? { background: '#4338ca', color: '#fff', borderColor: '#4338ca' } : {}),
                    }}
                    disabled={loading}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <button
              className="btn btn-secondary"
              disabled={offset + limit >= total || loading}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

