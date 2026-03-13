'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-700',
  sent: 'bg-purple-100 text-purple-800',
  viewed: 'bg-indigo-100 text-indigo-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
};

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function EstimatesPage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!session?.access_token || !siteId) return;

    async function fetchEstimates() {
      try {
        const url = filter === 'all'
          ? `/api/estimates/${siteId}`
          : `/api/estimates/${siteId}?status=${filter}`;

        const res = await fetch(url, {
          headers: { 'x-supabase-token': session.access_token },
        });
        if (!res.ok) throw new Error('Failed to fetch estimates');
        const data = await res.json();
        setEstimates(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEstimates();
  }, [session, siteId, filter]);

  async function handleAction(estimateId, action, body = {}) {
    try {
      const res = await fetch(`/api/estimates/${siteId}/${estimateId}/${action}`, {
        method: 'POST',
        headers: {
          'x-supabase-token': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Failed to ${action} estimate`);

      // Refresh list
      const listRes = await fetch(`/api/estimates/${siteId}`, {
        headers: { 'x-supabase-token': session.access_token },
      });
      if (listRes.ok) {
        setEstimates(await listRes.json());
      }
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Estimates</h1>
          <p className="page-subtitle">Manage and approve customer estimates</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'pending_approval', 'approved', 'sent', 'accepted'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`btn ${filter === status ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            >
              {status === 'all' ? 'All' : status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-muted">Loading estimates...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && estimates.length === 0 && (
        <div className="card">
          <p className="text-muted">No estimates found.</p>
        </div>
      )}

      {estimates.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Job Type</th>
                  <th>Price Range</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {estimates.map((est) => (
                  <tr key={est.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{est.customer_name || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {est.email || est.phone || '—'}
                      </div>
                    </td>
                    <td>
                      <div>{est.job_type?.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {est.industry_name}
                      </div>
                    </td>
                    <td>
                      {formatCurrency(est.price_low)} - {formatCurrency(est.price_high)}
                    </td>
                    <td>
                      <span className={`badge ${
                        est.confidence_level === 'high' ? 'bg-green-100 text-green-800' :
                        est.confidence_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {est.confidence_level}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[est.status] || ''}`}>
                        {est.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {new Date(est.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {est.status === 'draft' && (
                          <button
                            onClick={() => handleAction(est.id, 'approve')}
                            className="btn btn-primary btn-sm"
                          >
                            Approve
                          </button>
                        )}
                        {est.status === 'pending_approval' && (
                          <>
                            <button
                              onClick={() => handleAction(est.id, 'approve')}
                              className="btn btn-primary btn-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Rejection reason:');
                                if (reason) handleAction(est.id, 'reject', { reason });
                              }}
                              className="btn btn-secondary btn-sm"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {est.status === 'approved' && (
                          <button
                            onClick={() => handleAction(est.id, 'send', { channel: 'email' })}
                            className="btn btn-primary btn-sm"
                          >
                            Send
                          </button>
                        )}
                        <Link
                          href={`/dashboard/sites/${siteId}/estimates/${est.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          View
                        </Link>
                      </div>
                    </td>
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
