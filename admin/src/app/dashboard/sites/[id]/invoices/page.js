'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';
import { getInvoices } from '../../../../../lib/api';

export default function InvoicesPage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  function loadInvoices() {
    if (!siteId) return;
    setLoading(true);
    getInvoices(siteId, statusFilter ? { status: statusFilter } : {})
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    loadInvoices();
  }, [session, siteId, statusFilter]);

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Create from a job, or manage drafts</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadInvoices} disabled={loading}>{loading ? '...' : 'Refresh'}</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['', 'draft', 'sent', 'paid', 'overdue'].map((s) => (
            <button key={s || 'all'} type="button" className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-muted">Loading invoices...</p>}
      {!loading && list.length === 0 && <div className="card"><p className="text-muted">No invoices. Create one from a job.</p></div>}
      {!loading && list.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table style={{ minWidth: 500 }}>
              <thead>
                <tr><th>Customer</th><th>Status</th><th>Total</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.customer_name}</td>
                    <td><span className="badge">{inv.status}</span></td>
                    <td>${Number(inv.total_amount || 0).toFixed(2)}</td>
                    <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td><Link href={`/dashboard/sites/${siteId}/invoices/${inv.id}`} className="btn btn-secondary btn-sm">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
