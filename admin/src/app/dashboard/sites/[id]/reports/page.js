'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getWeeklyReports, getSite } from '../../../../../lib/api';
import SiteLayout from '../../../../../components/SiteLayout';

export default function ReportsPage() {
  const { id } = useParams();
  const [reports, setReports] = useState([]);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedReport, setExpandedReport] = useState(null);

  async function loadData() {
    try {
      const [siteData, reportsData] = await Promise.all([getSite(id), getWeeklyReports(id)]);
      setSite(siteData.site);
      setReports(reportsData.reports || []);
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
          <h1 className="page-title">Weekly Reports</h1>
          <p className="page-subtitle">Historical performance reports sent to your team</p>
        </div>
        <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="text-muted">Loading reports...</p>}

      {!loading && reports.length === 0 && (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '8px' }}>No Reports Yet</h3>
          <p className="text-muted">Weekly reports are generated every Sunday at midnight.</p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reports.map((report) => (
            <div key={report.id} className="card" style={{ padding: '20px' }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
              >
                <div>
                  <h3 style={{ marginBottom: '4px' }}>
                    Week of {new Date(report.report_date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </h3>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
                    <span>{report.total_conversations} conversations</span>
                    <span>{report.total_leads} leads</span>
                    {report.sent_at && (
                      <span className="text-muted">Sent {new Date(report.sent_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: '20px' }}>{expandedReport === report.id ? '▲' : '▼'}</span>
              </div>

              {expandedReport === report.id && (
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ textAlign: 'center', padding: '16px', background: 'var(--muted-bg)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{report.total_conversations}</div>
                      <div className="text-muted">Conversations</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px', background: 'var(--muted-bg)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{report.total_leads}</div>
                      <div className="text-muted">Total Leads</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px', background: '#fee2e2', borderRadius: '8px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>{report.hot_leads}</div>
                      <div className="text-muted">HOT</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px', background: '#fef3c7', borderRadius: '8px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#d97706' }}>{report.warm_leads}</div>
                      <div className="text-muted">WARM</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px', background: 'var(--muted-bg)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{report.cold_leads}</div>
                      <div className="text-muted">COLD</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '16px', background: '#fff7ed', borderRadius: '8px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ea580c' }}>{report.missed_leads}</div>
                      <div className="text-muted">Missed</div>
                    </div>
                  </div>

                  {report.top_questions && report.top_questions.length > 0 && (
                    <div>
                      <h4 style={{ marginBottom: '8px' }}>Top Customer Questions</h4>
                      <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--muted)' }}>
                        {report.top_questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SiteLayout>
  );
}
