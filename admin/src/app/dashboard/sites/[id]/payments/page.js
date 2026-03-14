'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';
import { getPayments } from '../../../../../lib/api';

export default function PaymentsPage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadPayments() {
    if (!siteId) return;
    setLoading(true);
    getPayments(siteId).then(setList).catch(() => setList([])).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!session?.access_token || !siteId) return;
    loadPayments();
  }, [session, siteId]);

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Payment history (invoice payments)</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadPayments} disabled={loading}>{loading ? '...' : 'Refresh'}</button>
      </div>

      {loading && <p className="text-muted">Loading payments...</p>}
      {!loading && list.length === 0 && <div className="card"><p className="text-muted">No payments recorded.</p></div>}
      {!loading && list.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table style={{ minWidth: 400 }}>
              <thead>
                <tr><th>Amount</th><th>Method</th><th>Paid at</th><th>Invoice</th></tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>${Number(p.amount).toFixed(2)}</td>
                    <td>{p.payment_method || '—'}</td>
                    <td>{new Date(p.paid_at).toLocaleString()}</td>
                    <td>{p.invoice_id ? <Link href={`/dashboard/sites/${siteId}/invoices/${p.invoice_id}`}>Invoice</Link> : '—'}</td>
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
