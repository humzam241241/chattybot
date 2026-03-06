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

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Manage your chatbot clients</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
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
                <span
                  className="client-color"
                  style={{ background: site.primary_color || '#6366f1' }}
                />
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
              <div className="client-date">
                Created {new Date(site.created_at).toLocaleDateString()}
              </div>
              <div className="client-actions">
                <span className="action-hint">Click to manage →</span>
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
        </div>
      )}

      <style jsx>{`
        .dashboard-page {
          max-width: 1200px;
        }
        
        .header-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
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
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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
          min-height: 180px;
        }
        
        .client-card:hover {
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
          transform: translateY(-2px);
        }
        
        .add-card {
          border: 2px dashed var(--border);
          align-items: center;
          justify-content: center;
          background: transparent;
        }
        
        .add-card:hover {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.05);
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
        }
        
        .client-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .client-color {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .delete-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: transparent;
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
          color: white;
        }
        
        .client-name {
          font-weight: 700;
          font-size: 18px;
          margin-bottom: 4px;
        }
        
        .client-domain {
          color: var(--muted);
          font-size: 14px;
          margin-bottom: 8px;
        }
        
        .client-date {
          color: var(--muted);
          font-size: 12px;
          margin-top: auto;
        }
        
        .client-actions {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        
        .action-hint {
          font-size: 13px;
          color: var(--primary);
          font-weight: 500;
        }
        
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: var(--surface);
          border-radius: 16px;
          border: 1px solid var(--border);
          margin-top: 20px;
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
        }
      `}</style>
    </div>
  );
}
