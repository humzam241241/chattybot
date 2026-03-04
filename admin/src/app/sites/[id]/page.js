'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSite, updateSite, triggerIngest } from '../../../lib/api';
import Link from 'next/link';

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

  const widgetUrl = process.env.NEXT_PUBLIC_WIDGET_URL || 'https://your-widget-cdn.vercel.app/widget.js';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://chattybot-backend.onrender.com';

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
    try {
      const result = await triggerIngest(id);
      setIngestResult(result);
    } catch (err) {
      setError('Ingestion failed: ' + err.message);
    } finally {
      setIngesting(false);
    }
  }

  if (loading) return <p className="text-muted">Loading...</p>;
  if (!form) return <div className="alert alert-error">{error}</div>;

  const embedCode = `<script src="${widgetUrl}" data-site-id="${id}" data-api-url="${apiUrl}"></script>`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{form.company_name}</h1>
          <p className="page-subtitle">Edit site configuration</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/sites/${id}/leads`} className="btn btn-secondary">
            View Leads
          </Link>
          <Link href={`/sites/${id}/files`} className="btn btn-secondary">
            Files
          </Link>
          <Link href={`/sites/${id}/conversations`} className="btn btn-secondary">
            Conversations
          </Link>
          <Link href="/sites" className="btn btn-secondary">← Back</Link>
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
            <label>Lead Notification Email</label>
            <input
              className="input"
              value={getOverride('notifications.lead_email', '')}
              onChange={(e) =>
                setOverride((ro) => ({ ...ro, notifications: { ...(ro.notifications || {}), lead_email: e.target.value } }))
              }
              placeholder="leads@yourcompany.com"
            />
            <small>Requires backend SMTP env vars; otherwise leads still save to the dashboard.</small>
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
    </div>
  );
}
