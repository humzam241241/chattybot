'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-800',
  classified: 'bg-purple-100 text-purple-800',
  needs_assessment: 'bg-yellow-100 text-yellow-800',
  estimated: 'bg-indigo-100 text-indigo-800',
  awaiting_approval: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  sent: 'bg-teal-100 text-teal-800',
  booked: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-700',
  closed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

const URGENCY_COLORS = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-800',
  emergency: 'bg-red-100 text-red-800',
};

export default function ServiceRequestsPage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!session?.access_token || !siteId) return;

    async function fetchRequests() {
      try {
        const url = filter === 'all'
          ? `/api/service-requests/${siteId}`
          : `/api/service-requests/${siteId}?status=${filter}`;

        const res = await fetch(url, {
          headers: { 'x-supabase-token': session.access_token },
        });
        if (!res.ok) throw new Error('Failed to fetch service requests');
        const data = await res.json();
        setRequests(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, [session, siteId, filter]);

  async function handleClassify(requestId) {
    try {
      const res = await fetch(`/api/service-requests/${siteId}/${requestId}/classify`, {
        method: 'POST',
        headers: { 'x-supabase-token': session.access_token },
      });

      if (!res.ok) throw new Error('Failed to classify request');

      // Refresh list
      const listRes = await fetch(`/api/service-requests/${siteId}`, {
        headers: { 'x-supabase-token': session.access_token },
      });
      if (listRes.ok) {
        setRequests(await listRes.json());
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleGenerateEstimate(requestId) {
    try {
      const res = await fetch(`/api/estimates/${siteId}`, {
        method: 'POST',
        headers: {
          'x-supabase-token': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId }),
      });

      if (!res.ok) throw new Error('Failed to generate estimate');

      alert('Estimate generated! Check the Estimates page.');

      // Refresh list
      const listRes = await fetch(`/api/service-requests/${siteId}`, {
        headers: { 'x-supabase-token': session.access_token },
      });
      if (listRes.ok) {
        setRequests(await listRes.json());
      }
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Requests</h1>
          <p className="page-subtitle">Incoming service requests from customers</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'new', 'classified', 'needs_assessment', 'estimated'].map((status) => (
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

      {loading && <p className="text-muted">Loading service requests...</p>}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && requests.length === 0 && (
        <div className="card">
          <p className="text-muted">No service requests found.</p>
        </div>
      )}

      {requests.length > 0 && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Problem</th>
                  <th>Classification</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{req.customer_name || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {req.email || req.phone || '—'}
                      </div>
                    </td>
                    <td style={{ maxWidth: 250 }}>
                      <div style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {req.problem_description}
                      </div>
                    </td>
                    <td>
                      {req.classified_job_type ? (
                        <div>
                          <div>{req.classified_job_type.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                            {req.industry_name} ({Math.round((req.classification_confidence || 0) * 100)}%)
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted">Not classified</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${URGENCY_COLORS[req.urgency_level] || ''}`}>
                        {req.urgency_level}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[req.status] || ''}`}>
                        {req.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {req.status === 'new' && (
                          <button
                            onClick={() => handleClassify(req.id)}
                            className="btn btn-primary btn-sm"
                          >
                            Classify
                          </button>
                        )}
                        {req.status === 'classified' && (
                          <button
                            onClick={() => handleGenerateEstimate(req.id)}
                            className="btn btn-primary btn-sm"
                          >
                            Generate Estimate
                          </button>
                        )}
                        <Link
                          href={`/dashboard/sites/${siteId}/service-requests/${req.id}`}
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
