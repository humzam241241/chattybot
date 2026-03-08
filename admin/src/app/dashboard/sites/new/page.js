'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSite } from '../../../../lib/api';
import Link from 'next/link';

const DEFAULT_PROMPT =
  `You are the AI assistant for {{company_name}}. ` +
  `Only answer using the provided company information. ` +
  `If the answer is not found in the context, say: ` +
  `"I'm not sure about that. Would you like me to connect you with the team?"`;

export default function NewSitePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    company_name: '',
    domain: '',
    primary_color: '#6366f1',
    tone: '',
    system_prompt: DEFAULT_PROMPT,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await createSite(form);
      router.push(`/dashboard/sites/${data.site.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Site</h1>
          <p className="page-subtitle">Set up a new chatbot integration</p>
        </div>
        <Link href="/dashboard" className="btn btn-secondary">← Back</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Company Name *</label>
            <input
              className="input"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              placeholder="Acme Corp"
              required
            />
          </div>

          <div className="field">
            <label>Website Domain *</label>
            <input
              className="input"
              name="domain"
              value={form.domain}
              onChange={handleChange}
              placeholder="https://acme.com"
              required
            />
            <small>The domain the widget will be embedded on. Used for origin verification.</small>
          </div>

          <div className="field">
            <label>Primary Color</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
                style={{ width: 48, height: 38, border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', padding: 2 }}
              />
              <input
                className="input"
                name="primary_color"
                value={form.primary_color}
                onChange={handleChange}
                placeholder="#6366f1"
                style={{ maxWidth: 140 }}
              />
            </div>
          </div>

          <div className="field">
            <label>Tone</label>
            <input
              className="input"
              name="tone"
              value={form.tone}
              onChange={handleChange}
              placeholder="e.g. friendly and professional"
            />
          </div>

          <div className="field">
            <label>System Prompt</label>
            <textarea
              className="textarea"
              name="system_prompt"
              value={form.system_prompt}
              onChange={handleChange}
              rows={5}
            />
            <small>
              Customize how the bot introduces itself. Use the default to prevent hallucination.
            </small>
          </div>

          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Site'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
