'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  getAdminOverview, 
  getAdminUsers, 
  updateUserPricing,
  getLeadsBySite,
  getApiUsageBySite,
  getSmsUsageBySite,
} from '../../../lib/api';

export default function AdminOverviewPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [leadsBySite, setLeadsBySite] = useState([]);
  const [apiUsage, setApiUsage] = useState([]);
  const [smsUsage, setSmsUsage] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [pricingModal, setPricingModal] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    
    async function load() {
      try {
        const [overviewData, usersData, leadsData, apiData, smsData] = await Promise.all([
          getAdminOverview(30),
          getAdminUsers(),
          getLeadsBySite(30),
          getApiUsageBySite(30),
          getSmsUsageBySite(30),
        ]);
        setOverview(overviewData);
        setUsers(usersData.users || []);
        setLeadsBySite(leadsData.sites || []);
        setApiUsage(apiData.sites || []);
        setSmsUsage(smsData.sites || []);
      } catch (err) {
        console.error('Failed to load admin data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isAdmin]);

  async function handleSavePricing(userId, pricing) {
    try {
      await updateUserPricing(userId, pricing);
      setUsers(users.map(u => 
        u.id === userId ? { ...u, custom_pricing: pricing } : u
      ));
      setPricingModal(null);
    } catch (err) {
      alert('Failed to update pricing: ' + err.message);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading admin data...</p>
        <style jsx>{`
          .loading-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--muted);
          }
          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 12px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Overview</h1>
          <p className="page-subtitle">Complete platform analytics</p>
        </div>
      </div>

      <div className="tabs">
        {['overview', 'intelligence', 'routing', 'users', 'leads', 'usage'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && overview && (
        <>
          <div className="overview-grid">
            <StatCard title="Total Leads" value={overview.leads?.total || 0} subtitle={`${overview.leads?.last_7_days || 0} last 7 days`} />
            <StatCard title="Hot Leads" value={overview.leads?.hot || 0} highlight />
            <StatCard title="Conversations" value={overview.conversations?.total || 0} subtitle={`${overview.conversations?.conversion_rate || 0}% conversion`} />
            <StatCard title="Revenue (30d)" value={`$${(overview.payments?.last_30_days_revenue_cents || 0) / 100}`} />
            <StatCard title="MRR" value={`$${overview.payments?.mrr_dollars || 0}`} highlight />
            <StatCard title="Active Users" value={overview.users?.active || 0} subtitle={`${overview.users?.trialing || 0} trialing`} />
            <StatCard title="SMS Sent" value={overview.sms?.outbound || 0} subtitle={`${overview.sms?.inbound || 0} received`} />
            <StatCard title="Total Sites" value={overview.sites?.total || 0} />
          </div>
        </>
      )}

      {activeTab === 'intelligence' && (
        <div className="intelligence-section">
          <h2 className="section-title">Service Intelligence</h2>
          <p className="section-desc">AI-powered intake, classification, estimates, and analytics. Open a client from the Dashboard to use these features.</p>
          <div className="feature-cards">
            <FeatureCard
              title="Service Requests"
              description="Incoming customer requests, classification, and intake."
              href="/dashboard"
              linkLabel="Go to Dashboard →"
            />
            <FeatureCard
              title="Estimates & Quotes"
              description="Generate and approve preliminary estimates, send quotes."
              href="/dashboard"
              linkLabel="Go to Dashboard →"
            />
            <FeatureCard
              title="AI Analytics"
              description="Intent and classification analytics per site."
              href="/dashboard"
              linkLabel="Go to Dashboard →"
            />
            <FeatureCard
              title="Industries & Protocols"
              description="Configure job types and service protocols by industry."
              href="/dashboard"
              linkLabel="Go to Dashboard →"
            />
          </div>
        </div>
      )}

      {activeTab === 'routing' && (
        <RoutingQuoteSection />
      )}

      {activeTab === 'users' && (
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Sites</th>
                <th>Trial Ends</th>
                <th>Custom Pricing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    {user.email}
                    {user.is_admin && <span className="admin-badge">Admin</span>}
                  </td>
                  <td>
                    <span className={`status-badge status-${user.subscription_status}`}>
                      {user.subscription_status}
                    </span>
                  </td>
                  <td>{user.site_count || 0}</td>
                  <td>
                    {user.trial_ends_at 
                      ? new Date(user.trial_ends_at).toLocaleDateString() 
                      : '-'}
                  </td>
                  <td>
                    {user.custom_pricing && Object.keys(user.custom_pricing).length > 0
                      ? 'Custom'
                      : 'Default'}
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm"
                      onClick={() => setPricingModal(user)}
                    >
                      Edit Pricing
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Total Leads</th>
                <th>Hot</th>
                <th>Warm</th>
                <th>Cold</th>
              </tr>
            </thead>
            <tbody>
              {leadsBySite.map(site => (
                <tr key={site.site_id}>
                  <td>{site.company_name}</td>
                  <td>{site.lead_count}</td>
                  <td className="hot">{site.hot}</td>
                  <td className="warm">{site.warm}</td>
                  <td className="cold">{site.cold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'usage' && (
        <div className="usage-section">
          <h3>API Usage (Last 30 Days)</h3>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Chat Requests</th>
                  <th>Ingest Requests</th>
                  <th>Lead Submissions</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {apiUsage.map(site => (
                  <tr key={site.site_id}>
                    <td>{site.company_name}</td>
                    <td>{site.chat_requests}</td>
                    <td>{site.ingest_requests}</td>
                    <td>{site.lead_requests}</td>
                    <td><strong>{site.total_requests}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 32 }}>SMS Usage (Last 30 Days)</h3>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Outbound</th>
                  <th>Inbound</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {smsUsage.map(site => (
                  <tr key={site.site_id}>
                    <td>{site.company_name}</td>
                    <td>{site.outbound}</td>
                    <td>{site.inbound}</td>
                    <td><strong>{site.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pricingModal && (
        <PricingModal 
          user={pricingModal} 
          onClose={() => setPricingModal(null)}
          onSave={handleSavePricing}
        />
      )}

      <style jsx>{`
        .admin-page {
          max-width: 1200px;
        }
        
        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }
        
        .tab {
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          background: #fff;
          cursor: pointer;
          font-weight: 500;
          color: #475569;
          border-radius: 8px;
          transition: all 0.2s;
        }
        
        .tab:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }
        
        .tab.active {
          background: #4338ca;
          border-color: #4338ca;
          color: #fff;
        }
        
        .overview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        
        .users-table, .data-table {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th, td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        
        th {
          background: var(--bg);
          font-weight: 600;
          font-size: 13px;
          color: var(--muted);
        }
        
        tbody tr:hover {
          background: var(--bg);
        }
        
        .admin-badge {
          display: inline-block;
          background: var(--primary);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          margin-left: 8px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .status-active { background: #dcfce7; color: #166534; }
        .status-trialing { background: #dbeafe; color: #1e40af; }
        .status-lifetime { background: #fef3c7; color: #92400e; }
        .status-canceled { background: #fee2e2; color: #991b1b; }
        .status-past_due { background: #fee2e2; color: #991b1b; }
        
        .btn-sm {
          padding: 4px 12px;
          font-size: 12px;
        }
        
        .hot { color: #dc2626; font-weight: 600; }
        .warm { color: #f59e0b; font-weight: 600; }
        .cold { color: #6b7280; }
        
        .usage-section h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        
        .intelligence-section {
          margin-bottom: 32px;
        }
        
        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
        }
        
        .section-desc {
          font-size: 14px;
          color: #475569;
          margin-bottom: 20px;
        }
        
        .feature-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        
        .admin-page :global(.feature-card) {
          background: #fff;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          padding: 20px;
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        
        .admin-page :global(.feature-card:hover) {
          border-color: #6366f1;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.12);
        }
        
        .admin-page :global(.feature-card h3) {
          font-size: 15px;
          font-weight: 600;
          color: #4338ca;
          margin-bottom: 8px;
        }
        
        .admin-page :global(.feature-card p) {
          font-size: 13px;
          color: #475569;
          margin-bottom: 12px;
          line-height: 1.45;
        }
        
        .admin-page :global(.feature-card a) {
          font-size: 13px;
          font-weight: 600;
          color: #4338ca;
          text-decoration: none;
        }
        
        .admin-page :global(.feature-card a:hover) {
          text-decoration: underline;
        }
        
        .admin-page :global(.routing-section) {
          max-width: 640px;
        }
        
        .admin-page :global(.routing-section h2) {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }
        
        .admin-page :global(.routing-section .form-desc) {
          font-size: 14px;
          color: #475569;
          margin-bottom: 24px;
        }
        
        .admin-page :global(.routing-section .field) {
          margin-bottom: 18px;
        }
        
        .admin-page :global(.routing-section label) {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #4338ca;
          margin-bottom: 6px;
        }
        
        .admin-page :global(.routing-section .input),
        .admin-page :global(.routing-section .select),
        .admin-page :global(.routing-section .textarea) {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #e4e4e7;
          border-radius: 8px;
          font-size: 14px;
          color: #0f172a;
          background: #fff;
        }
        
        .admin-page :global(.routing-section .textarea) {
          min-height: 80px;
          resize: vertical;
        }
        
        .admin-page :global(.routing-actions) {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }
      `}</style>
    </div>
  );
}

function FeatureCard({ title, description, href, linkLabel }) {
  return (
    <div className="feature-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <a href={href}>{linkLabel}</a>
    </div>
  );
}

function RoutingQuoteSection() {
  const [form, setForm] = useState({
    material: '',
    squareFootage: '',
    part: '',
    laborType: 'standard',
    unit: 'per_sq_ft',
    notes: '',
  });
  const [saved, setSaved] = useState(false);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    // Persist to localStorage for now; can wire to API later
    try {
      localStorage.setItem('chattybot_routing_quote_config', JSON.stringify(form));
      setSaved(true);
    } catch (e) {
      console.warn('Could not save routing config', e);
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('chattybot_routing_quote_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        setForm((prev) => ({ ...prev, ...parsed }));
      }
    } catch (_) {}
  }, []);

  return (
    <div className="routing-section">
      <h2>Routing & quote config</h2>
      <p className="form-desc">Default fields for estimates and routing. Change material, square footage, part, and other parameters used in quoting.</p>
      <div className="field">
        <label>Material</label>
        <input
          type="text"
          className="input"
          placeholder="e.g. Shingles, HVAC unit, Pipe"
          value={form.material}
          onChange={(e) => handleChange('material', e.target.value)}
        />
      </div>
      <div className="field">
        <label>Square footage</label>
        <input
          type="text"
          className="input"
          placeholder="e.g. 1200 or range 1000–1500"
          value={form.squareFootage}
          onChange={(e) => handleChange('squareFootage', e.target.value)}
        />
      </div>
      <div className="field">
        <label>Part / category</label>
        <input
          type="text"
          className="input"
          placeholder="e.g. Roof section, Compressor, Main line"
          value={form.part}
          onChange={(e) => handleChange('part', e.target.value)}
        />
      </div>
      <div className="field">
        <label>Labor type</label>
        <select
          className="select"
          value={form.laborType}
          onChange={(e) => handleChange('laborType', e.target.value)}
        >
          <option value="standard">Standard</option>
          <option value="emergency">Emergency</option>
          <option value="after_hours">After hours</option>
          <option value="weekend">Weekend</option>
        </select>
      </div>
      <div className="field">
        <label>Pricing unit</label>
        <select
          className="select"
          value={form.unit}
          onChange={(e) => handleChange('unit', e.target.value)}
        >
          <option value="per_sq_ft">Per sq ft</option>
          <option value="per_job">Per job</option>
          <option value="per_hour">Per hour</option>
          <option value="lump_sum">Lump sum</option>
        </select>
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea
          className="textarea"
          placeholder="Default notes or disclaimers for quotes"
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
        />
      </div>
      <div className="routing-actions">
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          Save config
        </button>
        {saved && <span style={{ color: '#4338ca', fontSize: 14, fontWeight: 500 }}>Saved.</span>}
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, highlight }) {
  return (
    <div className={`stat-card ${highlight ? 'highlight' : ''}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      <style jsx>{`
        .stat-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
        }
        
        .stat-card.highlight {
          border-color: #4338ca;
          background: #eef2ff;
        }
        
        .stat-title {
          font-size: 13px;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 8px;
        }
        
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
        }
        
        .stat-subtitle {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }
      `}</style>
    </div>
  );
}

function PricingModal({ user, onClose, onSave }) {
  const [pricing, setPricing] = useState(user.custom_pricing || {});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave(user.id, pricing);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Edit Pricing for {user.email}</h2>
        <p className="modal-subtitle">Leave empty to use default pricing</p>
        
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Pro Price (cents)</label>
            <input
              type="number"
              className="input"
              value={pricing.pro_cents || ''}
              onChange={e => setPricing({ ...pricing, pro_cents: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="5000 = $50"
            />
          </div>
          
          <div className="field">
            <label>Plus Price (cents)</label>
            <input
              type="number"
              className="input"
              value={pricing.plus_cents || ''}
              onChange={e => setPricing({ ...pricing, plus_cents: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="15000 = $150"
            />
          </div>
          
          <div className="field">
            <label>Ultra Price (cents)</label>
            <input
              type="number"
              className="input"
              value={pricing.ultra_cents || ''}
              onChange={e => setPricing({ ...pricing, ultra_cents: e.target.value ? parseInt(e.target.value) : undefined })}
              placeholder="40000 = $400"
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
      
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .modal {
          background: var(--surface);
          border-radius: 16px;
          padding: 32px;
          max-width: 400px;
          width: 90%;
        }
        
        .modal h2 {
          font-size: 20px;
          margin-bottom: 4px;
        }
        
        .modal-subtitle {
          color: var(--muted);
          font-size: 14px;
          margin-bottom: 24px;
        }
        
        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
        }
      `}</style>
    </div>
  );
}
