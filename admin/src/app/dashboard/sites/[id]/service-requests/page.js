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
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({ problemDescription: '', customerName: '', email: '', phone: '' });

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

  async function handleExtractFromChats() {
    try {
      setExtracting(true);
      setExtractResult(null);
      const res = await fetch(`/api/service-requests/${siteId}/extract-from-chats`, {
        method: 'POST',
        headers: {
          'x-supabase-token': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extract failed');
      setExtractResult(data);
      // Refresh list
      const listRes = await fetch(`/api/service-requests/${siteId}`, {
        headers: { 'x-supabase-token': session.access_token },
      });
      if (listRes.ok) setRequests(await listRes.json());
    } catch (err) {
      setExtractResult({ error: err.message });
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmitRequestEstimate(e) {
    e.preventDefault();
    if (!formData.problemDescription?.trim()) return;
    try {
      setFormSubmitting(true);
      const res = await fetch(`/api/service-requests/${siteId}`, {
        method: 'POST',
        headers: {
          'x-supabase-token': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemDescription: formData.problemDescription.trim(),
          customerName: formData.customerName.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          source: 'manual',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create request');
      }
      setFormData({ problemDescription: '', customerName: '', email: '', phone: '' });
      setShowRequestForm(false);
      const listRes = await fetch(`/api/service-requests/${siteId}`, {
        headers: { 'x-supabase-token': session.access_token },
      });
      if (listRes.ok) setRequests(await listRes.json());
    } catch (err) {
      alert(err.message);
    } finally {
      setFormSubmitting(false);
    }
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Requests</h1>
          <p className="page-subtitle">Incoming service requests from customers</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleExtractFromChats}
            disabled={extracting}
            className="btn btn-primary"
          >
            {extracting ? 'Extracting…' : 'Extract from chats'}
          </button>
          <button
            type="button"
            onClick={() => setShowRequestForm(!showRequestForm)}
            className="btn btn-secondary"
          >
            {showRequestForm ? 'Cancel' : 'Request estimate (manual)'}
          </button>
        </div>
      </div>

      {extractResult && (
        <div className={`card ${extractResult.error ? 'alert alert-error' : ''}`} style={{ marginBottom: 16 }}>
          {extractResult.error ? (
            <p>{extractResult.error}</p>
          ) : (
            <p>
              Created <strong>{extractResult.created}</strong> service request(s), skipped {extractResult.skipped}, errors: {extractResult.errors}.
              {extractResult.created > 0 && ' List refreshed.'}
            </p>
          )}
        </div>
      )}

      {showRequestForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>New estimate request</h3>
          <form onSubmit={handleSubmitRequestEstimate}>
            <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
              <div>
                <label htmlFor="problemDescription" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Problem / description *</label>
                <textarea
                  id="problemDescription"
                  value={formData.problemDescription}
                  onChange={(e) => setFormData((d) => ({ ...d, problemDescription: e.target.value }))}
                  rows={3}
                  required
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="e.g. Leak under kitchen sink, need repair"
                />
              </div>
              <div>
                <label htmlFor="customerName" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Customer name</label>
                <input
                  id="customerName"
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData((d) => ({ ...d, customerName: e.target.value }))}
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="email" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Email</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="phone" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Phone</label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="Optional"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                {formSubmitting ? 'Creating…' : 'Create service request'}
              </button>
            </div>
          </form>
        </div>
      )}

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
