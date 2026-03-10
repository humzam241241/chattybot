'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSite, updateSite, triggerIngest, getIngestStatus } from '../../../../lib/api';
import SiteLayout from '../../../../components/SiteLayout';

export default function EditSitePage() {
  const { id } = useParams();
  const router = useRouter();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [ingestResult, setIngestResult] = useState(null);

  const widgetUrl = process.env.NEXT_PUBLIC_WIDGET_URL || '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

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

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

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
      setSuccessMsg('Saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleIngest() {
    if (!confirm('This will crawl the site and re-embed all content. Continue?')) return;
    setIngesting(true);
    setIngestResult(null);
    setError('');
    const MAX_POLL_MINUTES = 5;
    const pollIntervalMs = 5000;
    const maxPolls = (MAX_POLL_MINUTES * 60 * 1000) / pollIntervalMs;
    let pollCount = 0;

    try {
      await triggerIngest(id);
      const poll = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          clearInterval(poll);
          setError('Ingestion timed out after ' + MAX_POLL_MINUTES + ' minutes. Check Render logs.');
          setIngesting(false);
          return;
        }
        try {
          const status = await getIngestStatus(id);
          if (status.status === 'done') {
            clearInterval(poll);
            setIngestResult({
              pages_crawled: status.result?.pagesCrawled || 0,
              chunks_stored: status.result?.chunksStored || status.chunk_count || 0,
            });
            setIngesting(false);
          } else if (status.status === 'error') {
            clearInterval(poll);
            setError('Ingestion failed: ' + (status.result?.error || 'Unknown error'));
            setIngesting(false);
          } else if (status.status === 'idle' && pollCount > 2) {
            clearInterval(poll);
            setIngesting(false);
          }
        } catch {
          // Ignore transient poll errors
        }
      }, pollIntervalMs);
    } catch (err) {
      setError('Ingestion failed to start: ' + err.message);
      setIngesting(false);
    }
  }

  if (loading) return <SiteLayout siteName="Loading..."><p className="text-muted">Loading...</p></SiteLayout>;
  if (!form) return <SiteLayout siteName="Error"><div className="alert alert-error">{error}</div></SiteLayout>;

  const embedCode = `<script src="${widgetUrl}" data-site-id="${id}" data-api-url="${apiUrl}"></script>`;

  return (
    <SiteLayout siteName={form.company_name}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Site Configuration</h1>
          <p className="page-subtitle">Basic settings and widget embed code</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}

      <div className="card">
        <form className="form" onSubmit={handleSave}>
          <div className="field">
            <label>Company Name</label>
            <input className="input" name="company_name" value={form.company_name} onChange={handleChange} required />
          </div>
          <div className="field">
            <label>Domain</label>
            <input className="input" name="domain" value={form.domain || ''} onChange={handleChange} placeholder="https://acme.com" />
          </div>
          <div className="field">
            <label>Primary Color</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={form.primary_color || '#6366f1'}
                onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                style={{ width: 48, height: 38, border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2 }}
              />
              <input className="input" name="primary_color" value={form.primary_color || ''} onChange={handleChange} style={{ maxWidth: 140 }} />
            </div>
          </div>
          <div className="field">
            <label>Tone</label>
            <input className="input" name="tone" value={form.tone || ''} onChange={handleChange} placeholder="friendly and professional" />
          </div>
          <div className="field">
            <label>System Prompt</label>
            <textarea className="textarea" name="system_prompt" value={form.system_prompt || ''} onChange={handleChange} rows={5} />
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginTop: 18, marginBottom: 10 }} />
          <div className="field">
            <label>Widget Intro Message</label>
            <textarea
              className="textarea"
              value={getOverride('ui.intro_message', '')}
              onChange={(e) =>
                setOverride((ro) => ({ ...ro, ui: { ...(ro.ui || {}), intro_message: e.target.value } }))
              }
              rows={3}
              placeholder="Shown as the first message in the widget"
            />
          </div>
          <div className="field">
            <label>Suggested Questions (one per line)</label>
            <textarea
              className="textarea"
              value={(getOverride('ui.suggested_questions', []) || []).join('\n')}
              onChange={(e) => {
                const arr = e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .slice(0, 8);
                setOverride((ro) => ({ ...ro, ui: { ...(ro.ui || {}), suggested_questions: arr } }));
              }}
              rows={4}
              placeholder="Example:\nWhat services do you offer?\nHow does pricing work?\nHow do I book a call?"
            />
          </div>
          <div className="field">
            <label>Booking Link URL</label>
            <input
              className="input"
              value={getOverride('booking.url', '')}
              onChange={(e) =>
                setOverride((ro) => ({ ...ro, booking: { ...(ro.booking || {}), url: e.target.value } }))
              }
              placeholder="https://cal.com/your-team/intro"
            />
          </div>
          <div className="field">
            <label>Open Booking Inline (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={Boolean(getOverride('booking.embed', false))}
                onChange={(e) =>
                  setOverride((ro) => ({ ...ro, booking: { ...(ro.booking || {}), embed: e.target.checked } }))
                }
              />
              <span style={{ fontSize: 13 }}>Open scheduling inside the widget instead of a new tab</span>
            </div>
          </div>
          <div className="field">
            <label>Booking Button Text (optional)</label>
            <input
              className="input"
              value={getOverride('booking.button_text', '')}
              onChange={(e) =>
                setOverride((ro) => ({ ...ro, booking: { ...(ro.booking || {}), button_text: e.target.value } }))
              }
              placeholder="Book a call"
            />
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginTop: 18, marginBottom: 10 }} />

          <div className="field">
            <label>Owner / Report Email</label>
            <input
              className="input"
              name="report_email"
              value={form.report_email || ''}
              onChange={handleChange}
              placeholder="owner@yourcompany.com"
            />
            <small>Used for lead alerts, missed-lead alerts, and weekly reports (falls back to backend LEAD_NOTIFICATION_EMAIL if blank).</small>
          </div>

          <div className="field">
            <label>Owner SMS Alert To (optional)</label>
            <input
              className="input"
              value={getOverride('notifications.lead_sms_to', '')}
              onChange={(e) =>
                setOverride((ro) => ({ ...ro, notifications: { ...(ro.notifications || {}), lead_sms_to: e.target.value } }))
              }
              placeholder="+15551234567"
            />
            <small>If set, HOT/WARM lead alerts will also be sent by SMS.</small>
          </div>

          <div className="field">
            <label>Owner WhatsApp Alert To (optional)</label>
            <input
              className="input"
              value={getOverride('notifications.lead_whatsapp_to', '')}
              onChange={(e) =>
                setOverride((ro) => ({ ...ro, notifications: { ...(ro.notifications || {}), lead_whatsapp_to: e.target.value } }))
              }
              placeholder="+15551234567"
            />
            <small>If set, HOT/WARM lead alerts will also be sent by WhatsApp.</small>
          </div>

          <div className="field">
            <label>Twilio SMS Number (site routing + outbound from)</label>
            <input
              className="input"
              name="twilio_phone"
              value={form.twilio_phone || ''}
              onChange={handleChange}
              placeholder="+15551234567"
            />
            <small>Inbound SMS to this number routes to this site. Proactive SMS will send from this number when set.</small>
          </div>

          <div className="field">
            <label>Twilio WhatsApp Number (site routing + outbound from)</label>
            <input
              className="input"
              name="twilio_whatsapp"
              value={form.twilio_whatsapp || ''}
              onChange={handleChange}
              placeholder="+15551234567"
            />
            <small>Inbound WhatsApp to this number routes to this site. Proactive WhatsApp will send from this number when set.</small>
          </div>

          <div className="field">
            <label>Lead Form Notification Email</label>
            <input
              className="input"
              value={getOverride('notifications.lead_email', '')}
              onChange={(e) =>
                setOverride((ro) => ({ ...ro, notifications: { ...(ro.notifications || {}), lead_email: e.target.value } }))
              }
              placeholder="leads@yourcompany.com"
            />
            <small>Used when a visitor submits the lead form. Requires backend email env vars; otherwise leads still save to the dashboard.</small>
          </div>

          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Content Ingestion */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-title">Content Ingestion</div>
            <div className="card-meta">Crawl your site and embed content for RAG responses.</div>
          </div>
          <button className="btn btn-primary" onClick={handleIngest} disabled={ingesting}>
            {ingesting ? '⏳ Ingesting...' : '🔄 Re-ingest Site'}
          </button>
        </div>
        {ingesting && (
          <div className="alert alert-info mt-4">
            Crawling and embedding your site. This may take 1-3 minutes...
          </div>
        )}
        {ingestResult && (
          <div className="alert alert-success mt-4">
            ✅ Done! Crawled {ingestResult.pages_crawled} pages → {ingestResult.chunks_stored} chunks stored.
          </div>
        )}
      </div>

      {/* Embed Code */}
      <div className="card">
        <div className="card-title">Embed Code</div>
        <div className="card-meta" style={{ marginBottom: 8 }}>
          Copy and paste this before the &lt;/body&gt; tag on your website.
        </div>
        <div className="embed-code">{embedCode}</div>
      </div>
    </SiteLayout>
  );
}
