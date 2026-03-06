'use client';

import { useEffect, useState } from 'react';
import { getSites, deleteSite, triggerReconciliation } from '../lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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
      await triggerReconciliation();
      alert('Data reconciliation started. Check backend logs for results. Refresh in a minute to see recovered leads.');
    } catch (err) {
      alert(`Failed to start reconciliation: ${err.message}`);
    } finally {
      setReconciling(false);
    }
  }

  async function handleDelete(e, id, name) {
    e.preventDefault();
    e.stopPropagation();
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

  const totalLeads = sites.reduce((sum, s) => sum + (s.lead_count || 0), 0);
  const totalChats = sites.reduce((sum, s) => sum + (s.conversation_count || 0), 0);

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Manage your chatbot clients</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleReconcile} 
            disabled={reconciling}
            title="Scan database to recover missed lead data"
          >
            {reconciling ? 'Scanning...' : '🔄 Recover Data'}
          </button>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={loading}>
            {loading ? '...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && sites.length > 0 && (
        <div className="summary-row">
          <div className="summary-stat">
            <span className="stat-num">{sites.length}</span>
            <span className="stat-label">Clients</span>
          </div>
          <div className="summary-stat">
            <span className="stat-num">{totalLeads}</span>
            <span className="stat-label">Total Leads</span>
          </div>
          <div className="summary-stat">
            <span className="stat-num">{totalChats}</span>
            <span className="stat-label">Total Chats</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading clients...</p>
        </div>
      )}

      {!loading && (
        <div className="client-grid">
          {/* Add Client Card */}
          <Link href="/sites/new" className="client-card add-card">
            <div className="add-icon">+</div>
            <div className="add-text">Add New Client</div>
          </Link>

          {/* Client Cards */}
          {sites.map((site) => (
            <Link 
              key={site.id} 
              href={`/sites/${site.id}/leads`} 
              className="client-card"
            >
              <div className="client-header">
                <div
                  className="client-color"
                  style={{ background: site.primary_color || '#6366f1' }}
                >
                  <span className="color-icon">💬</span>
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => handleDelete(e, site.id, site.company_name)}
                  disabled={deletingId === site.id}
                  title="Delete client"
                >
                  {deletingId === site.id ? '...' : '×'}
                </button>
              </div>
              
              <div className="client-name">{site.company_name}</div>
              <div className="client-domain">{site.domain || 'No domain set'}</div>
              
              <div className="client-stats">
                <div className="mini-stat">
                  <span className="mini-num">{site.lead_count || 0}</span>
                  <span className="mini-label">Leads</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-num">{site.conversation_count || 0}</span>
                  <span className="mini-label">Chats</span>
                </div>
              </div>
              
              <div className="client-footer">
                <span className="client-date">
                  Created {new Date(site.created_at).toLocaleDateString()}
                </span>
                <span className="action-hint">Manage →</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && sites.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🚀</div>
          <h3>Welcome to ChattyBot!</h3>
          <p>Create your first client to get started with AI-powered chat.</p>
          <Link href="/sites/new" className="btn btn-primary" style={{ marginTop: 16 }}>
            + Create Client
          </Link>
        </div>
      )}

      <style jsx>{`
        .dashboard-page {
          max-width: 1100px;
        }
        
        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .summary-row {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        
        .summary-stat {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .stat-num {
          font-size: 28px;
          font-weight: 700;
          color: var(--primary);
        }
        
        .stat-label {
          font-size: 13px;
          color: var(--muted);
          font-weight: 500;
        }
        
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
        
        .client-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        
        .client-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          text-decoration: none;
          color: var(--text);
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
        }
        
        .client-card:hover {
          border-color: var(--primary);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.12);
          transform: translateY(-3px);
        }
        
        .add-card {
          border: 2px dashed var(--border);
          align-items: center;
          justify-content: center;
          background: transparent;
          min-height: 200px;
        }
        
        .add-card:hover {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.03);
        }
        
        .add-icon {
          font-size: 48px;
          color: var(--primary);
          font-weight: 300;
          line-height: 1;
          margin-bottom: 8px;
        }
        
        .add-text {
          font-weight: 600;
          color: var(--primary);
          font-size: 15px;
        }
        
        .client-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        
        .client-color {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .color-icon {
          font-size: 24px;
          filter: grayscale(1) brightness(10);
        }
        
        .delete-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.15s;
        }
        
        .client-card:hover .delete-btn {
          opacity: 1;
        }
        
        .delete-btn:hover {
          background: var(--danger);
          border-color: var(--danger);
          color: white;
        }
        
        .client-name {
          font-weight: 700;
          font-size: 18px;
          margin-bottom: 4px;
          color: var(--text);
        }
        
        .client-domain {
          color: var(--muted);
          font-size: 13px;
          margin-bottom: 16px;
        }
        
        .client-stats {
          display: flex;
          gap: 16px;
          padding: 16px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          margin-bottom: 16px;
        }
        
        .mini-stat {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .mini-num {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
        }
        
        .mini-label {
          font-size: 12px;
          color: var(--muted);
        }
        
        .client-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .client-date {
          color: var(--muted);
          font-size: 12px;
        }
        
        .action-hint {
          font-size: 13px;
          color: var(--primary);
          font-weight: 600;
        }
        
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: var(--surface);
          border-radius: 16px;
          border: 1px solid var(--border);
        }
        
        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .empty-state h3 {
          margin-bottom: 8px;
          color: var(--text);
        }
        
        .empty-state p {
          color: var(--muted);
        }
        
        @media (max-width: 768px) {
          .client-grid {
            grid-template-columns: 1fr;
          }
          
          .header-actions {
            width: 100%;
          }
          
          .header-actions .btn {
            flex: 1;
            justify-content: center;
          }
          
          .summary-row {
            flex-direction: column;
          }
          
          .summary-stat {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
