'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteLayout from '../../../../../../components/SiteLayout';
import { useAuth } from '../../../../../../contexts/AuthContext';
import { createJobFromEstimate } from '../../../../../../lib/api';

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

const EDITABLE_STATUSES = ['draft', 'pending_approval'];

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

function emptyLineItem() {
  return { label: '', description: '', quantity: 1, unit: 'ea', unit_price: 0, is_optional: false };
}

export default function EstimateDetailPage() {
  const { id: siteId, estimate_id: estimateId } = useParams();
  const { session } = useAuth();
  const [estimate, setEstimate] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [approveAndSending, setApproveAndSending] = useState(false);
  const [convertingToJob, setConvertingToJob] = useState(false);
  const router = useRouter();

  async function fetchEstimate() {
    const res = await fetch(`/api/estimates/${siteId}/${estimateId}`, {
      headers: { 'x-supabase-token': session.access_token },
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error('Estimate not found');
      throw new Error('Failed to load estimate');
    }
    const data = await res.json();
    setEstimate(data);
    setLineItems(
      (data.line_items || []).map((li) => ({
        label: li.label || '',
        description: li.description || '',
        quantity: Number(li.quantity) || 1,
        unit: li.unit || 'ea',
        unit_price: Number(li.unit_price) || 0,
        is_optional: Boolean(li.is_optional),
      }))
    );
    return data;
  }

  useEffect(() => {
    if (!session?.access_token || !siteId || !estimateId) return;

    fetchEstimate().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [session, siteId, estimateId]);

  const canEdit = estimate && EDITABLE_STATUSES.includes(estimate.status);

  async function handleConvertToJob() {
    try {
      setConvertingToJob(true);
      const job = await createJobFromEstimate(siteId, estimateId);
      router.push(`/dashboard/sites/${siteId}/jobs/${job.id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setConvertingToJob(false);
    }
  }

  function updateLineItem(index, field, value) {
    setLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  }

  function removeLineItem(index) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveLineItems() {
    if (!session?.access_token || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/estimates/${siteId}/${estimateId}`, {
        method: 'PATCH',
        headers: {
          'x-supabase-token': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ line_items: lineItems }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      await fetchEstimate();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!session?.access_token) return;
    setSending(true);
    try {
      const res = await fetch(`/api/estimates/${siteId}/${estimateId}/send`, {
        method: 'POST',
        headers: {
          'x-supabase-token': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: 'both' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send');
      }
      await fetchEstimate();
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleApproveAndSend() {
    if (!session?.access_token) return;
    setApproveAndSending(true);
    try {
      let res = await fetch(`/api/estimates/${siteId}/${estimateId}/approve`, {
        method: 'POST',
        headers: { 'x-supabase-token': session.access_token },
      });
      if (!res.ok) throw new Error('Failed to approve');
      res = await fetch(`/api/estimates/${siteId}/${estimateId}/send`, {
        method: 'POST',
        headers: {
          'x-supabase-token': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: 'both' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send');
      }
      await fetchEstimate();
    } catch (err) {
      alert(err.message);
    } finally {
      setApproveAndSending(false);
    }
  }

  function handleCopyForBilling() {
    if (lineItems.length === 0) {
      const priceRange =
        estimate.price_low === estimate.price_high
          ? formatCurrency(estimate.price_low)
          : `${formatCurrency(estimate.price_low)} - ${formatCurrency(estimate.price_high)}`;
      const text = `Estimate\nCustomer: ${estimate.customer_name || '—'}\nJob: ${estimate.job_type?.replace(/_/g, ' ')}\nTotal: ${priceRange}\n`;
      copyToClipboard(text);
      return;
    }
    const header = 'Label,Description,Qty,Unit,Unit Price,Amount\n';
    const rows = lineItems.map(
      (li) =>
        `"${(li.label || '').replace(/"/g, '""')}","${(li.description || '').replace(/"/g, '""')}",${li.quantity},${li.unit},${li.unit_price},${(Number(li.quantity) || 0) * (Number(li.unit_price) || 0)}`
    );
    const total = lineItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0);
    const text = header + rows.join('\n') + `\nTotal,"","","","",${total}`;
    copyToClipboard(text);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard.')).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      alert('Copied to clipboard.');
    } catch {
      alert('Could not copy. Select and copy manually.');
    }
    document.body.removeChild(ta);
  }

  if (loading) {
    return (
      <SiteLayout siteId={siteId}>
        <p className="text-muted">Loading estimate...</p>
      </SiteLayout>
    );
  }

  if (error || !estimate) {
    return (
      <SiteLayout siteId={siteId}>
        <div className="card">
          <div className="alert alert-error">{error || 'Estimate not found'}</div>
          <Link href={`/dashboard/sites/${siteId}/estimates`} className="btn btn-secondary">
            Back to Estimates
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const priceRange =
    estimate.price_low === estimate.price_high
      ? formatCurrency(estimate.price_low)
      : `${formatCurrency(estimate.price_low)} – ${formatCurrency(estimate.price_high)}`;

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <Link
            href={`/dashboard/sites/${siteId}/estimates`}
            className="text-muted"
            style={{ display: 'inline-block', marginBottom: 8, fontSize: 14 }}
          >
            ← Back to Estimates
          </Link>
          <h1 className="page-title">Estimate</h1>
          <p className="page-subtitle">
            {estimate.customer_name || 'Unknown'} · {estimate.job_type?.replace(/_/g, ' ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={handleConvertToJob} disabled={convertingToJob}>
            {convertingToJob ? 'Creating…' : 'Create Job'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Customer & request</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <strong>Customer</strong>: {estimate.customer_name || '—'}
          </div>
          <div>
            <strong>Contact</strong>: {estimate.email || estimate.phone || '—'}
          </div>
          {estimate.address && (
            <div>
              <strong>Address</strong>: {estimate.address}
            </div>
          )}
          {estimate.problem_description && (
            <div>
              <strong>Description</strong>: {estimate.problem_description}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Quote summary</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <strong>Job type</strong>: {estimate.job_type?.replace(/_/g, ' ')}
            {estimate.industry_name && (
              <span style={{ color: 'var(--muted-foreground)', marginLeft: 8 }}>
                ({estimate.industry_name})
              </span>
            )}
          </div>
          <div>
            <strong>Price range</strong>: {priceRange}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {estimate.price_source === 'historical' && estimate.historical_jobs_count != null
              ? `Based on ${estimate.historical_jobs_count} similar completed jobs`
              : 'Based on industry default—add past jobs to improve accuracy.'}
          </div>
          {estimate.confidence_reasoning && (
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
              {estimate.confidence_reasoning}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              className={`badge ${
                estimate.confidence_level === 'high'
                  ? 'bg-green-100 text-green-800'
                  : estimate.confidence_level === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              Confidence: {estimate.confidence_level}
            </span>
            <span className={`badge ${STATUS_COLORS[estimate.status] || ''}`}>
              {estimate.status?.replace(/_/g, ' ')}
            </span>
          </div>
          {(estimate.timeline_days_min != null || estimate.timeline_days_max != null) && (
            <div>
              <strong>Timeline</strong>:{' '}
              {estimate.timeline_days_min != null && estimate.timeline_days_max != null
                ? `${estimate.timeline_days_min}–${estimate.timeline_days_max} days`
                : estimate.timeline_days_min != null
                  ? `${estimate.timeline_days_min} days`
                  : `${estimate.timeline_days_max} days`}
            </div>
          )}
        </div>
      </div>

      {estimate.scope_of_work && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Scope of work</div>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{estimate.scope_of_work}</p>
        </div>
      )}

      {estimate.attachment_analyses?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Photo assessment</div>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 12 }}>
            AI analysis of attached photos used for this estimate.
          </p>
          {estimate.attachment_analyses.map((a, i) => (
            <div key={a.id || i} style={{ marginBottom: 12 }}>
              {a.severity_assessment && (
                <span className="badge bg-gray-100 text-gray-700" style={{ marginRight: 8 }}>
                  {a.severity_assessment}
                </span>
              )}
              {a.confidence != null && (
                <span className="badge bg-gray-100 text-gray-600">
                  Confidence: {(Number(a.confidence) * 100).toFixed(0)}%
                </span>
              )}
              {a.raw_analysis && (
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 8, marginBottom: 0 }}>{a.raw_analysis}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {(estimate.inclusions?.length > 0 || estimate.exclusions?.length > 0) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Inclusions & exclusions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {estimate.inclusions?.length > 0 && (
              <div>
                <strong>Included</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                  {estimate.inclusions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {estimate.exclusions?.length > 0 && (
              <div>
                <strong>Excluded</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                  {estimate.exclusions.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title">Line items</div>
          {canEdit && (
            <button type="button" onClick={addLineItem} className="btn btn-secondary btn-sm">
              + Add row
            </button>
          )}
        </div>
        {lineItems.length === 0 && !canEdit && (
          <p className="text-muted">No line items. Edit is only available for draft or pending approval.</p>
        )}
        {lineItems.length === 0 && canEdit && (
          <p className="text-muted">No line items yet. Add rows to build a detailed quote (e.g. Labor, Materials).</p>
        )}
        {lineItems.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                  {canEdit && <th style={{ width: 80 }}></th>}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li, i) => {
                  const qty = Number(li.quantity) || 0;
                  const up = Number(li.unit_price) || 0;
                  const amount = qty * up;
                  return (
                    <tr key={i}>
                      <td>
                        {canEdit ? (
                          <input
                            type="text"
                            className="input"
                            value={li.label}
                            onChange={(e) => updateLineItem(i, 'label', e.target.value)}
                            placeholder="e.g. Labor"
                          />
                        ) : (
                          li.label || '—'
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            type="text"
                            className="input"
                            value={li.description}
                            onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                            placeholder="Optional"
                          />
                        ) : (
                          li.description || '—'
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            type="number"
                            className="input"
                            style={{ width: 72 }}
                            min="0"
                            step="0.01"
                            value={li.quantity}
                            onChange={(e) => updateLineItem(i, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          />
                        ) : (
                          li.quantity
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            type="text"
                            className="input"
                            style={{ width: 56 }}
                            value={li.unit}
                            onChange={(e) => updateLineItem(i, 'unit', e.target.value)}
                          />
                        ) : (
                          li.unit
                        )}
                      </td>
                      <td>
                        {canEdit ? (
                          <input
                            type="number"
                            className="input"
                            style={{ width: 88 }}
                            min="0"
                            step="0.01"
                            value={li.unit_price}
                            onChange={(e) => updateLineItem(i, 'unit_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          />
                        ) : (
                          formatCurrency(li.unit_price)
                        )}
                      </td>
                      <td>{formatCurrency(amount)}</td>
                      {canEdit && (
                        <td>
                          <button
                            type="button"
                            onClick={() => removeLineItem(i)}
                            className="btn btn-secondary btn-sm"
                            title="Remove row"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {lineItems.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <strong>Total from line items: {formatCurrency(lineItems.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0))}</strong>
          </div>
        )}
        {canEdit && lineItems.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={handleSaveLineItems} className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save line items'}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href={`/dashboard/sites/${siteId}/estimates`} className="btn btn-secondary">
          Back to list
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={handleApproveAndSend}
            className="btn btn-primary"
            disabled={approveAndSending}
            title="Approve estimate and send to customer via Email + SMS"
          >
            {approveAndSending ? 'Sending...' : 'Approve & Send (Email + SMS)'}
          </button>
        )}
        {estimate.status === 'approved' && (
          <button
            type="button"
            onClick={handleSend}
            className="btn btn-primary"
            disabled={sending}
            title="Send to customer via Email + SMS"
          >
            {sending ? 'Sending...' : 'Send (Email + SMS)'}
          </button>
        )}
        {(lineItems.length > 0 || estimate.price_low != null) && (
          <button type="button" onClick={handleCopyForBilling} className="btn btn-secondary" title="Copy line items as CSV for billing">
            Copy for billing
          </button>
        )}
      </div>
    </SiteLayout>
  );
}
