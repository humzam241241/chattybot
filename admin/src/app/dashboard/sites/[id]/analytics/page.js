'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getAnalytics, getSite } from '../../../../../lib/api';
import SiteLayout from '../../../../../components/SiteLayout';

export default function AnalyticsPage() {
  const { id } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);

  async function loadData() {
    try {
      const [siteData, analyticsData] = await Promise.all([
        getSite(id), 
        fetch(`/api/analytics/${id}?days=${days}`).then(r => r.json())
      ]);
      setSite(siteData.site);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [id, days]);

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
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Chatbot performance metrics and insights</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="form-input"
            style={{ width: 'auto' }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="text-muted">Loading analytics...</p>}

      {!loading && analytics && (
        <>
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--primary)' }}>
                {analytics.conversations?.total || 0}
              </div>
              <div className="text-muted">Total Conversations</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                <span style={{ color: 'var(--success)' }}>+{analytics.conversations?.last_24_hours || 0}</span> today
              </div>
            </div>

            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--success)' }}>
                {analytics.leads?.total || 0}
              </div>
              <div className="text-muted">Leads Captured</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                {analytics.leads?.conversion_rate || 0}% conversion
              </div>
            </div>

            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#dc2626' }}>
                {analytics.leads?.hot || 0}
              </div>
              <div className="text-muted">HOT Leads</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Ready to convert
              </div>
            </div>

            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--warning)' }}>
                {analytics.missed_leads || 0}
              </div>
              <div className="text-muted">Missed Opportunities</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Needs follow-up
              </div>
            </div>
          </div>

          {/* Lead Breakdown */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Lead Breakdown</h3>
            <div style={{ display: 'flex', gap: '8px', height: '32px', borderRadius: '8px', overflow: 'hidden' }}>
              {analytics.leads?.hot > 0 && (
                <div style={{ 
                  flex: analytics.leads.hot, 
                  background: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  HOT {analytics.leads.hot}
                </div>
              )}
              {analytics.leads?.warm > 0 && (
                <div style={{ 
                  flex: analytics.leads.warm, 
                  background: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  WARM {analytics.leads.warm}
                </div>
              )}
              {analytics.leads?.cold > 0 && (
                <div style={{ 
                  flex: analytics.leads.cold, 
                  background: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  COLD {analytics.leads.cold}
                </div>
              )}
              {(!analytics.leads?.total || analytics.leads.total === 0) && (
                <div style={{ flex: 1, background: 'var(--muted-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  No leads yet
                </div>
              )}
            </div>
          </div>

          {/* Daily Activity */}
          {analytics.daily_breakdown?.length > 0 && (
            <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '16px' }}>Daily Activity</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                {analytics.daily_breakdown.slice(0, 14).reverse().map((day, i) => {
                  const maxConvos = Math.max(...analytics.daily_breakdown.map(d => d.conversations));
                  const height = maxConvos > 0 ? (day.conversations / maxConvos * 100) : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div 
                        style={{ 
                          width: '100%', 
                          height: `${Math.max(height, 4)}%`,
                          background: 'var(--primary)',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '4px'
                        }}
                        title={`${day.conversations} conversations on ${new Date(day.date).toLocaleDateString()}`}
                      />
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Additional Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '16px' }}>Conversation Metrics</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Avg Messages/Conversation</span>
                  <strong>{analytics.conversations?.avg_messages || 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Last 7 Days</span>
                  <strong>{analytics.conversations?.last_7_days || 0}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Last 24 Hours</span>
                  <strong>{analytics.conversations?.last_24_hours || 0}</strong>
                </div>
              </div>
            </div>

            {analytics.top_intents?.length > 0 && (
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>Top User Intents</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analytics.top_intents.map((intent, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        background: 'var(--muted-bg)', 
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}>
                        {intent.intent}
                      </span>
                      <strong>{intent.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </SiteLayout>
  );
}
