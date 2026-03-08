'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { clearLeads, deleteLead, getLeads, getSite, rescoreLeads } from '../../../../lib/api';
import SiteLayout from '../../../../components/SiteLayout';

const RATING_COLORS = {
  HOT: { bg: '#fee2e2', color: '#dc2626' },
  WARM: { bg: '#fef3c7', color: '#d97706' },
  COLD: { bg: '#e5e7eb', color: '#6b7280' },
};

export default function LeadsPage() {
  const { id } = useParams();
  const [leads, setLeads] = useState([]);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({ hot: 0, warm: 0, cold: 0 });
  const [rescoring, setRescoring] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [clearing, setClearing] = useState(false);

  async function loadData() {
    try {
      const [siteData, leadsData] = await Promise.all([getSite(id), getLeads(id)]);
      setSite(siteData.site);
      setLeads(leadsData.leads || []);
      setCounts(leadsData.counts || { hot: 0, warm: 0, cold: 0 });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [id]);

  async function handleRefresh() {
    setLoading(true);
    setError('');
    await loadData();
    setLoading(false);
  }

  async function handleRescore() {
    if (!confirm('Re-score all leads without ratings? This will analyze conversations and assign HOT/WARM/COLD ratings.')) return;
    
    setRescoring(true);
    try {
      const result = await rescoreLeads(id);
      alert(`Re-scored ${result.updated} leads. Refreshing...`);
      await loadData();
    } catch (err) {
      alert('Failed to rescore: ' + err.message);
    } finally {
      setRescoring(false);
    }
  }

  async function handleDeleteLead(leadId) {
    if (!confirm('Delete this lead?')) return;
    setDeletingId(leadId);
    try {
      await deleteLead(id, leadId);
      await loadData();
    } catch (err) {
      alert('Failed to delete lead: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearLeads() {
    const ok = prompt('Type DELETE to remove ALL leads for this client.');
    if (ok !== 'DELETE') return;
    setClearing(true);
    try {
      const res = await clearLeads(id);
      alert(`Deleted ${res.deleted || 0} leads.`);
      await loadData();
    } catch (err) {
      alert('Failed to clear leads: ' + err.message);
    } finally {
      setClearing(false);
    }
  }

  function exportCSV() {
    const header = 'Name,Email,Phone,Issue,Rating,Date\n';
    const rows = leads
      .map((l) =>
        [
          l.name || '', 
          l.email || '', 
          l.phone || '',
          (l.issue || '').replace(/\n/g, ' '), 
          l.lead_rating || '',
          new Date(l.created_at).toLocaleString()
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${id}.csv`;
    a.click();
  }

  return (
    <SiteLayout siteName={site?.company_name || 'Loading...'}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">Captured contacts from your chatbot</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
          <button className="btn btn-secondary" onClick={handleRescore} disabled={rescoring || loading}>
            {rescoring ? '...' : '⚡ Re-score'}
          </button>
          <button className="btn btn-danger" onClick={handleClearLeads} disabled={clearing || loading}>
            {clearing ? '...' : '🗑️ Clear Leads'}
          </button>
          {leads.length > 0 && (
            <button className="btn btn-secondary" onClick={exportCSV}>
              ↓ Export CSV
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="text-muted">Loading leads...</p>}

      {!loading && (
        <>
          {/* Lead Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '16px', textAlign: 'center', background: RATING_COLORS.HOT.bg }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: RATING_COLORS.HOT.color }}>{counts.hot || 0}</div>
              <div style={{ color: RATING_COLORS.HOT.color }}>HOT</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center', background: RATING_COLORS.WARM.bg }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: RATING_COLORS.WARM.color }}>{counts.warm || 0}</div>
              <div style={{ color: RATING_COLORS.WARM.color }}>WARM</div>
            </div>
            <div className="card" style={{ padding: '16px', textAlign: 'center', background: RATING_COLORS.COLD.bg }}>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: RATING_COLORS.COLD.color }}>{counts.cold || 0}</div>
              <div style={{ color: RATING_COLORS.COLD.color }}>COLD</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rating</th>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Issue</th>
                    <th>Date</th>
                    <th>Chat</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                        No leads captured yet.
                      </td>
                    </tr>
                  )}
                  {leads.map((lead) => {
                    const ratingStyle = RATING_COLORS[lead.lead_rating] || RATING_COLORS.COLD;
                    return (
                      <tr key={lead.id}>
                        <td>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            background: ratingStyle.bg,
                            color: ratingStyle.color,
                          }}>
                            {lead.lead_rating || '—'}
                          </span>
                        </td>
                        <td>{lead.name || <span className="text-muted">—</span>}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {lead.email && (
                              <a href={`mailto:${lead.email}`} style={{ color: 'var(--primary)', fontSize: '13px' }}>
                                {lead.email}
                              </a>
                            )}
                            {lead.phone && (
                              <a href={`tel:${lead.phone}`} style={{ color: 'var(--muted)', fontSize: '12px' }}>
                                {lead.phone}
                              </a>
                            )}
                            {!lead.email && !lead.phone && <span className="text-muted">—</span>}
                          </div>
                        </td>
                        <td style={{ maxWidth: 200, color: 'var(--muted)', fontSize: '13px' }}>
                          {lead.issue
                            ? lead.issue.length > 60
                              ? lead.issue.slice(0, 60) + '...'
                              : lead.issue
                            : '—'}
                        </td>
                        <td className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                          {new Date(lead.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          {lead.conversation_id && (
                            <Link 
                              href={`/sites/${id}/conversations/${lead.conversation_id}`}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              View
                            </Link>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteLead(lead.id)}
                            disabled={deletingId === lead.id}
                            title="Delete lead"
                          >
                            {deletingId === lead.id ? '...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </SiteLayout>
  );
}
