import React, { useState } from 'react';

export default function LeadForm({ siteId, apiUrl, primaryColor, onDismiss, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, name, email }),
      });

      if (!res.ok) throw new Error('Failed');
      onSuccess();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="cb-lead-form" onSubmit={handleSubmit}>
      <p className="cb-lead-title">Connect with our team</p>
      <input
        className="cb-lead-field"
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="cb-lead-field"
        type="email"
        placeholder="Email address *"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {error && <p style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
      <button
        className="cb-lead-submit"
        type="submit"
        disabled={loading}
        style={{ background: primaryColor }}
      >
        {loading ? 'Sending...' : 'Send'}
      </button>
      <button type="button" className="cb-lead-dismiss" onClick={onDismiss}>
        No thanks
      </button>
    </form>
  );
}
