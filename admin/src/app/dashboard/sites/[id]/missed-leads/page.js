'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getMissedLeads, getMissedLeadStats, getSite } from '../../../../../lib/api';
import SiteLayout from '../../../../../components/SiteLayout';
import Link from 'next/link';

export default function MissedLeadsPage() {
  const { id } = useParams();
  const [missedLeads, setMissedLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    try {
      const [siteData, leadsData, statsData] = await Promise.all([
        getSite(id), getMissedLeads(id), getMissedLeadStats(id)
      ]);
      setSite(siteData.site);
      setMissedLeads(leadsData.missed_leads || []);
      setStats(statsData);
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

  return (
    <SiteLayout siteName={site?.company_name || 'Loading...'}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Missed Opportunities</h1>
          <p className="page-subtitle">Conversations with lead signals but no contact captured</p>
        </div>
        <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="text-muted">Loading missed leads...</p>}

      {!loading && stats && (
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.total}</div>
            <div className="text-muted">Total Missed (7 days)</div>
          </div>
          {stats.top_keywords?.slice(0, 3).map((kw, i) => (
            <div key={i} className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{kw.count}</div>
              <div className="text-muted">"{kw.keyword}"</div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Reason</th>
                  <th>Keywords</th>
                  <th>Messages</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {missedLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                      No missed opportunities detected. Great job on lead capture!
                    </td>
                  </tr>
                )}
                {missedLeads.map((ml) => (
                  <tr key={ml.id}>
                    <td>
                      <code style={{ fontSize: '12px' }}>{ml.visitor_id?.slice(0, 16) || 'Unknown'}</code>
                    </td>
                    <td style={{ maxWidth: 280, color: 'var(--muted)' }}>
                      {ml.reason?.length > 80 ? ml.reason.slice(0, 80) + '...' : ml.reason}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {(ml.keywords_found || []).slice(0, 3).map((kw, i) => (
                          <span key={i} style={{
                            padding: '2px 6px',
                            background: 'var(--muted-bg)',
                            borderRadius: '4px',
                            fontSize: '11px'
                          }}>
                            {kw}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{ml.message_count}</td>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(ml.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link 
                        href={`/sites/${id}/conversations/${ml.conversation_id}`}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        View Chat
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '24px', padding: '20px', background: 'var(--info-bg)' }}>
        <h3 style={{ marginBottom: '8px' }}>💡 Tips to Reduce Missed Leads</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--muted)' }}>
          <li>Enable proactive lead capture prompts in Settings</li>
          <li>Add CTA buttons for "Get a Quote" or "Schedule Inspection"</li>
          <li>Train the bot to ask for contact info when service interest is detected</li>
          <li>Review these conversations to improve bot responses</li>
        </ul>
      </div>
    </SiteLayout>
  );
}
