'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSites, listAllLeads } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';

const RATING_COLORS = {
  HOT: { bg: '#fee2e2', color: '#dc2626' },
  WARM: { bg: '#fef3c7', color: '#d97706' },
  COLD: { bg: '#e5e7eb', color: '#6b7280' },
};

export default function AllLeadsPage() {
  const { isAdmin, hasAccess } = useAuth();
  const canView = hasAccess || isAdmin;

  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [siteId, setSiteId] = useState('');
  const [rating, setRating] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [data, setData] = useState({ leads: [], pagination: { total: 0, limit, offset: 0 } });

  const selectedSiteName = useMemo(() => {
    if (!siteId) return 'All clients';
    return sites.find((s) => s.id === siteId)?.company_name || 'Client';
  }, [siteId, sites]);

  async function load() {
    setError('');
    const [sitesRes, leadsRes] = await Promise.all([
      getSites(),
      listAllLeads({ siteId: siteId || null, rating: rating || null, q: q || null, limit, offset }),
    ]);
    setSites(sitesRes?.sites || []);
    setData(leadsRes || { leads: [], pagination: { total: 0, limit, offset } });
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
  }, [siteId, rating, offset]);

  const total = data?.pagination?.total || 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + limit, total);

  return (
    <div style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Leads</h1>
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
          <h3>Upgrade to unlock leads</h3>
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

            <label className="text-muted" style={{ fontSize: 13 }}>Rating</label>
            <select className="input" value={rating} onChange={(e) => { setOffset(0); setRating(e.target.value); }}>
              <option value="">All</option>
              <option value="HOT">HOT</option>
              <option value="WARM">WARM</option>
              <option value="COLD">COLD</option>
            </select>

            <label className="text-muted" style={{ fontSize: 13 }}>Search</label>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, phone, issue…"
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
                    <th>Rating</th>
                    <th>Client</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Issue</th>
                    <th>Date</th>
                    <th>Chat</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.leads || []).length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                        {loading ? 'Loading leads…' : 'No leads found.'}
                      </td>
                    </tr>
                  )}
                  {(data?.leads || []).map((lead) => {
                    const ratingStyle = RATING_COLORS[lead.lead_rating] || RATING_COLORS.COLD;
                    return (
                      <tr key={lead.id}>
                        <td>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              background: ratingStyle.bg,
                              color: ratingStyle.color,
                            }}
                          >
                            {lead.lead_rating || '—'}
                          </span>
                        </td>
                        <td>{lead.site_name || '—'}</td>
                        <td>{lead.name || <span className="text-muted">—</span>}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {lead.email ? (
                              <a href={`mailto:${lead.email}`} style={{ color: 'var(--primary)', fontSize: 13 }}>
                                {lead.email}
                              </a>
                            ) : null}
                            {lead.phone ? (
                              <a href={`tel:${lead.phone}`} style={{ color: 'var(--muted)', fontSize: 12 }}>
                                {lead.phone}
                              </a>
                            ) : null}
                            {!lead.email && !lead.phone ? <span className="text-muted">—</span> : null}
                          </div>
                        </td>
                        <td style={{ maxWidth: 240, color: 'var(--muted)', fontSize: 13 }}>
                          {lead.issue ? (lead.issue.length > 80 ? `${lead.issue.slice(0, 80)}…` : lead.issue) : '—'}
                        </td>
                        <td className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                          {lead.created_at ? new Date(lead.created_at).toLocaleString() : '—'}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {lead.conversation_id ? (
                            <Link
                              href={`/dashboard/sites/${lead.site_id}/conversations/${lead.conversation_id}`}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: 11 }}
                            >
                              View
                            </Link>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <button className="btn btn-secondary" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>
              ← Prev
            </button>
            <div className="text-muted" style={{ fontSize: 13 }}>
              {pageStart}–{pageEnd} of {total}
            </div>
            <button
              className="btn btn-secondary"
              disabled={offset + limit >= total || loading}
              onClick={() => setOffset(offset + limit)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

