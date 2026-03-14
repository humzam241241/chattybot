'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../../components/SiteLayout';
import { useAuth } from '../../../../../../contexts/AuthContext';
import { createJobFromRequest } from '../../../../../../lib/api';

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

export default function ServiceRequestDetailPage() {
  const { id: siteId, request_id: requestId } = useParams();
  const { session } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [convertingToJob, setConvertingToJob] = useState(false);
  const router = useRouter();

  async function fetchRequest() {
    const res = await fetch(`/api/service-requests/${siteId}/${requestId}`, {
      headers: { 'x-supabase-token': session.access_token },
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error('Service request not found');
      throw new Error('Failed to load service request');
    }
    return res.json();
  }

  useEffect(() => {
    if (!session?.access_token || !siteId || !requestId) return;
    fetchRequest()
      .then(setRequest)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, siteId, requestId]);

  async function handleClassify() {
    try {
      setClassifying(true);
      const res = await fetch(`/api/service-requests/${siteId}/${requestId}/classify`, {
        method: 'POST',
        headers: { 'x-supabase-token': session.access_token },
      });
      if (!res.ok) throw new Error('Failed to classify');
      const updated = await fetchRequest();
      setRequest(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setClassifying(false);
    }
  }

  async function handleConvertToJob() {
    try {
      setConvertingToJob(true);
      const job = await createJobFromRequest(siteId, request.id);
      router.push(`/dashboard/sites/${siteId}/jobs/${job.id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setConvertingToJob(false);
    }
  }

  async function handleGenerateEstimate() {
    try {
      setGenerating(true);
      const res = await fetch(`/api/estimates/${siteId}`, {
        method: 'POST',
        headers: {
          'x-supabase-token': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) throw new Error('Failed to generate estimate');
      const updated = await fetchRequest();
      setRequest(updated);
      alert('Estimate generated! Check the Estimates page.');
    } catch (err) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <SiteLayout siteId={siteId}>
        <p className="text-muted">Loading service request...</p>
      </SiteLayout>
    );
  }

  if (error || !request) {
    return (
      <SiteLayout siteId={siteId}>
        <div className="card">
          <div className="alert alert-error">{error || 'Service request not found'}</div>
          <Link href={`/dashboard/sites/${siteId}/service-requests`} className="btn btn-secondary">
            Back to Service Requests
          </Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <Link
            href={`/dashboard/sites/${siteId}/service-requests`}
            className="text-muted"
            style={{ display: 'inline-block', marginBottom: 8, fontSize: 14 }}
          >
            ← Back to Service Requests
          </Link>
          <h1 className="page-title">Service Request</h1>
          <p className="page-subtitle">
            {request.customer_name || 'Unknown'} · {request.status?.replace(/_/g, ' ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {request.status === 'new' && (
            <button
              type="button"
              onClick={handleClassify}
              disabled={classifying}
              className="btn btn-primary"
            >
              {classifying ? 'Classifying…' : 'Classify'}
            </button>
          )}
          {request.status === 'classified' && (
            <button
              type="button"
              onClick={handleGenerateEstimate}
              disabled={generating}
              className="btn btn-primary"
            >
              {generating ? 'Generating…' : 'Generate Estimate'}
            </button>
          )}
          {request.conversation_id && (
            <Link
              href={`/dashboard/sites/${siteId}/conversations/${request.conversation_id}`}
              className="btn btn-secondary"
            >
              View Conversation
            </Link>
          )}
          <Link
            href={`/dashboard/sites/${siteId}/estimates${request.lead_id ? `?lead_id=${request.lead_id}` : ''}`}
            className="btn btn-secondary"
          >
            Quotes
          </Link>
          <button
            type="button"
            onClick={handleConvertToJob}
            disabled={convertingToJob}
            className="btn btn-secondary"
          >
            {convertingToJob ? 'Creating…' : 'Convert to Job'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Customer & problem</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <strong>Customer</strong>: {request.customer_name || '—'}
          </div>
          <div>
            <strong>Contact</strong>: {request.email || request.phone || '—'}
          </div>
          <div>
            <strong>Problem / description</strong>:
            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{request.problem_description || '—'}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Classification & status</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={`badge ${URGENCY_COLORS[request.urgency_level] || ''}`}>
            {request.urgency_level || '—'}
          </span>
          <span className={`badge ${STATUS_COLORS[request.status] || ''}`}>
            {request.status?.replace(/_/g, ' ')}
          </span>
          {request.classified_job_type && (
            <span>
              {request.classified_job_type.replace(/_/g, ' ')}
              {request.industry_name && (
                <span style={{ color: 'var(--muted-foreground)', marginLeft: 6 }}>
                  ({request.industry_name} {Math.round((request.classification_confidence || 0) * 100)}%)
                </span>
              )}
            </span>
          )}
          {!request.classified_job_type && <span className="text-muted">Not classified</span>}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted-foreground)' }}>
          Created {new Date(request.created_at).toLocaleString()}
        </div>
      </div>
    </SiteLayout>
  );
}
