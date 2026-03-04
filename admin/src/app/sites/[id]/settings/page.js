'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSite, updateSite } from '../../../../lib/api';
import SiteLayout from '../../../../components/SiteLayout';

export default function SiteSettingsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    getSite(id)
      .then((data) => {
        const site = data.site;
        if (site && typeof site.raffy_overrides === 'string') {
          try { site.raffy_overrides = JSON.parse(site.raffy_overrides); } catch {}
        }
        if (site && (!site.raffy_overrides || typeof site.raffy_overrides !== 'object')) {
          site.raffy_overrides = {};
        }
        setForm(site);
      })
      .catch(() => setError('Site not found'))
      .finally(() => setLoading(false));
  }, [id]);

  function setOverride(updater) {
    setForm((prev) => {
      const ro = prev?.raffy_overrides && typeof prev.raffy_overrides === 'object' ? { ...prev.raffy_overrides } : {};
      const nextOverrides = updater(ro) || ro;
      return { ...prev, raffy_overrides: nextOverrides };
    });
  }

  function getOverride(path, fallback = '') {
    const ro = form?.raffy_overrides && typeof form.raffy_overrides === 'object' ? form.raffy_overrides : {};
    const parts = path.split('.');
    let cur = ro;
    for (const p of parts) {
      if (!cur || typeof cur !== 'object') return fallback;
      cur = cur[p];
    }
    return cur ?? fallback;
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await updateSite(id, form);
      setSuccessMsg('Settings saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SiteLayout siteName="Loading..."><p className="text-muted">Loading...</p></SiteLayout>;
  if (!form) return <SiteLayout siteName="Error"><div className="alert alert-error">{error}</div></SiteLayout>;

  return (
    <SiteLayout siteName={form.company_name}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Raffy Settings</h1>
          <p className="page-subtitle">Personality, guardrails, and behavior</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <form className="form" onSubmit={handleSave}>
        {/* Identity */}
        <div className="card">
          <div className="card-title">Identity</div>
          <div className="field">
            <label>Bot Name</label>
            <input
              className="input"
              value={getOverride('name', 'Raffy')}
              onChange={(e) => setOverride((ro) => ({ ...ro, name: e.target.value }))}
              placeholder="Raffy"
            />
          </div>
          <div className="field">
            <label>Role</label>
            <input
              className="input"
              value={getOverride('role', 'AI assistant')}
              onChange={(e) => setOverride((ro) => ({ ...ro, role: e.target.value }))}
              placeholder="AI assistant"
            />
          </div>
          <div className="field">
            <label>Tone</label>
            <input
              className="input"
              value={getOverride('tone', 'friendly, confident, never cocky')}
              onChange={(e) => setOverride((ro) => ({ ...ro, tone: e.target.value }))}
              placeholder="friendly, confident, never cocky"
            />
          </div>
        </div>

        {/* Guardrails */}
        <div className="card">
          <div className="card-title">Guardrails</div>
          <div className="field">
            <label>What Raffy Won't Say (one per line)</label>
            <textarea
              className="textarea"
              value={(getOverride('guardrails.wont_say', []) || []).join('\n')}
              onChange={(e) => {
                const arr = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
                setOverride((ro) => ({
                  ...ro,
                  guardrails: { ...(ro.guardrails || {}), wont_say: arr },
                }));
              }}
              rows={5}
              placeholder="Do not claim you are a human.\nDo not invent pricing."
            />
          </div>
        </div>

        {/* Escalation */}
        <div className="card">
          <div className="card-title">Escalation Triggers</div>
          <div className="field">
            <label>Keywords (one per line)</label>
            <textarea
              className="textarea"
              value={(getOverride('escalation_triggers.keywords', []) || []).join('\n')}
              onChange={(e) => {
                const arr = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
                setOverride((ro) => ({
                  ...ro,
                  escalation_triggers: { ...(ro.escalation_triggers || {}), keywords: arr },
                }));
              }}
              rows={4}
              placeholder="human\nagent\nrepresentative"
            />
            <small>When these keywords appear, offer lead capture form</small>
          </div>
        </div>

        {/* Emergency */}
        <div className="card">
          <div className="card-title">Emergency Response</div>
          <div className="field">
            <label>Emergency Keywords (one per line)</label>
            <textarea
              className="textarea"
              value={(getOverride('emergency.keywords', []) || []).join('\n')}
              onChange={(e) => {
                const arr = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
                setOverride((ro) => ({
                  ...ro,
                  emergency: { ...(ro.emergency || {}), keywords: arr },
                }));
              }}
              rows={3}
              placeholder="emergency\nsuicide\n911"
            />
          </div>
          <div className="field">
            <label>Emergency Response Message</label>
            <textarea
              className="textarea"
              value={getOverride('emergency.response', '')}
              onChange={(e) =>
                setOverride((ro) => ({
                  ...ro,
                  emergency: { ...(ro.emergency || {}), response: e.target.value },
                }))
              }
              rows={3}
              placeholder="If this is an emergency, please call 911 immediately."
            />
          </div>
        </div>

        {/* Sales & Personality */}
        <div className="card">
          <div className="card-title">Sales & Personality</div>
          <div className="field">
            <label>Sales CTA</label>
            <input
              className="input"
              value={getOverride('sales_prompts.cta', '')}
              onChange={(e) =>
                setOverride((ro) => ({
                  ...ro,
                  sales_prompts: { ...(ro.sales_prompts || {}), cta: e.target.value },
                }))
              }
              placeholder="Would you like to schedule a free consultation?"
            />
          </div>
          <div className="field">
            <label>Enable Humor</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={getOverride('humor.enabled', false)}
                onChange={(e) =>
                  setOverride((ro) => ({
                    ...ro,
                    humor: { ...(ro.humor || {}), enabled: e.target.checked },
                  }))
                }
              />
              <span style={{ fontSize: 13 }}>Allow light, professional humor</span>
            </div>
          </div>
          {getOverride('humor.enabled', false) && (
            <div className="field">
              <label>Humor Guidelines</label>
              <textarea
                className="textarea"
                value={getOverride('humor.guidelines', '')}
                onChange={(e) =>
                  setOverride((ro) => ({
                    ...ro,
                    humor: { ...(ro.humor || {}), guidelines: e.target.value },
                  }))
                }
                rows={2}
                placeholder="Light, professional humor only. Avoid controversial topics."
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </SiteLayout>
  );
}
