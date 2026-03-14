'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import SiteLayout from '../../../../../components/SiteLayout';
import { useAuth } from '../../../../../contexts/AuthContext';

export default function IndustriesPage() {
  const { id: siteId } = useParams();
  const { session } = useAuth();
  const [industries, setIndustries] = useState([]);
  const [siteConfigs, setSiteConfigs] = useState([]);
  const [protocolsByIndustry, setProtocolsByIndustry] = useState({});
  const [selectedIndustryId, setSelectedIndustryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (!session?.access_token || !siteId) return;

    async function load() {
      try {
        const [indRes, configRes] = await Promise.all([
          fetch('/api/industries', { cache: 'no-store' }),
          fetch(`/api/industries/site/${siteId}/config`, {
            headers: { 'x-supabase-token': session.access_token },
          }),
        ]);
        if (!indRes.ok) throw new Error('Failed to load industries');
        if (!configRes.ok) throw new Error('Failed to load site config');
        const indData = await indRes.json();
        const configData = await configRes.json();
        setIndustries(Array.isArray(indData) ? indData : []);
        setSiteConfigs(Array.isArray(configData) ? configData : []);
        if (indData.length > 0 && !selectedIndustryId) {
          setSelectedIndustryId(indData[0].id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [session, siteId]);

  useEffect(() => {
    if (!selectedIndustryId) return;

    async function loadProtocols() {
      try {
        const res = await fetch(`/api/industries/${selectedIndustryId}/protocols`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setProtocolsByIndustry((prev) => ({ ...prev, [selectedIndustryId]: Array.isArray(data) ? data : [] }));
      } catch {
        setProtocolsByIndustry((prev) => ({ ...prev, [selectedIndustryId]: [] }));
      }
    }

    loadProtocols();
  }, [selectedIndustryId]);

  useEffect(() => {
    const config = siteConfigs.find((c) => c.industry_id === selectedIndustryId);
    if (config) {
      setForm({
        laborRatePerHour: config.labor_rate_per_hour ?? '',
        markupPercentage: config.markup_percentage ?? '',
        minimumJobPrice: config.minimum_job_price ?? '',
      });
    } else {
      setForm({ laborRatePerHour: '', markupPercentage: '', minimumJobPrice: '' });
    }
  }, [selectedIndustryId, siteConfigs]);

  async function handleSave(e) {
    e.preventDefault();
    if (!session?.access_token || !selectedIndustryId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/industries/site/${siteId}/config`, {
        method: 'POST',
        headers: {
          'x-supabase-token': session.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          industryId: selectedIndustryId,
          laborRatePerHour: form.laborRatePerHour === '' ? null : parseFloat(form.laborRatePerHour),
          markupPercentage: form.markupPercentage === '' ? null : parseFloat(form.markupPercentage),
          minimumJobPrice: form.minimumJobPrice === '' ? null : parseFloat(form.minimumJobPrice),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const updated = await res.json();
      setSiteConfigs((prev) => {
        const rest = prev.filter((c) => c.industry_id !== selectedIndustryId);
        return [...rest, { ...updated, industry_id: selectedIndustryId }];
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const protocols = protocolsByIndustry[selectedIndustryId] || [];
  const selectedIndustry = industries.find((i) => i.id === selectedIndustryId);

  if (loading) {
    return (
      <SiteLayout siteId={siteId}>
        <p className="text-muted">Loading...</p>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout siteId={siteId}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Industries & Protocols</h1>
          <p className="page-subtitle">
            Configure job types and pricing for your trade. Any contractor can set labor rate, markup, and minimum job price per industry.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Industry</div>
        <p style={{ marginBottom: 12, fontSize: 14, color: 'var(--muted-foreground)' }}>
          Select an industry to view job types and set your custom pricing (labor rate, markup, minimum job price).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {industries.map((ind) => (
            <button
              key={ind.id}
              type="button"
              onClick={() => setSelectedIndustryId(ind.id)}
              className={`btn ${selectedIndustryId === ind.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            >
              {ind.icon && <span style={{ marginRight: 4 }}>{ind.icon}</span>}
              {ind.name}
            </button>
          ))}
        </div>
      </div>

      {selectedIndustryId && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Job types ({selectedIndustry?.name})</div>
            {protocols.length === 0 ? (
              <p className="text-muted">No job types defined for this industry yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Job type</th>
                      <th>Typical price range</th>
                      <th>Labor hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {protocols.map((p) => (
                      <tr key={p.id}>
                        <td>{p.job_type?.replace(/_/g, ' ')}</td>
                        <td>
                          {p.typical_price_min != null && p.typical_price_max != null
                            ? `$${Number(p.typical_price_min).toLocaleString()} – $${Number(p.typical_price_max).toLocaleString()}`
                            : '—'}
                        </td>
                        <td>
                          {p.typical_labor_hours_min != null && p.typical_labor_hours_max != null
                            ? `${p.typical_labor_hours_min}–${p.typical_labor_hours_max} hrs`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">Your settings for {selectedIndustry?.name}</div>
            <form onSubmit={handleSave} className="form">
              <div style={{ display: 'grid', gap: 16, maxWidth: 400 }}>
                <div className="field">
                  <label>Labor rate per hour ($)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="0.01"
                    value={form.laborRatePerHour}
                    onChange={(e) => setForm((f) => ({ ...f, laborRatePerHour: e.target.value }))}
                    placeholder="e.g. 75"
                  />
                  <small>Overrides protocol default when calculating estimates</small>
                </div>
                <div className="field">
                  <label>Markup (%)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="0.01"
                    value={form.markupPercentage}
                    onChange={(e) => setForm((f) => ({ ...f, markupPercentage: e.target.value }))}
                    placeholder="e.g. 15"
                  />
                  <small>Applied on top of labor + materials</small>
                </div>
                <div className="field">
                  <label>Minimum job price ($)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="0.01"
                    value={form.minimumJobPrice}
                    onChange={(e) => setForm((f) => ({ ...f, minimumJobPrice: e.target.value }))}
                    placeholder="e.g. 150"
                  />
                  <small>No estimate will go below this for this industry</small>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 16 }}>
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </form>
          </div>
        </>
      )}
    </SiteLayout>
  );
}
