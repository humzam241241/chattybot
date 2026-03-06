'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSite } from '../../../../lib/api';
import SiteLayout from '../../../../components/SiteLayout';

export default function SiteConversationsPage() {
  const params = useParams();
  const siteId = params?.id;
  const [site, setSite] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!siteId) {
      setLoading(false);
      setError('Missing site ID');
      return;
    }

    let cancelled = false;

    async function loadConversations() {
      try {
        const res = await fetch(`/api/conversations/site/${siteId}`);
        if (!res.ok) {
          throw new Error('Failed to load conversations');
        }
        const data = await res.json();
        if (!cancelled) {
          setConversations(data?.conversations ?? []);
        }
      } catch (err) {
        console.error('Conversation load error:', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load conversations');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    getSite(siteId)
      .then((data) => setSite(data?.site ?? null))
      .catch(() => setSite(null));
  }, [siteId]);

  return (
    <SiteLayout siteName={site?.company_name || 'Loading...'}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversations</h1>
          <p className="page-subtitle">Chat history and lead scores</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <h2 style={{ margin: '0 0 8px 0', fontSize: 16 }}>Failed to load conversations</h2>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}
      {loading && <p className="text-muted">Loading...</p>}

      {!loading && !error && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Updated</th>
                  <th>Visitor</th>
                  <th>Messages</th>
                  <th>Lead Score</th>
                  <th>Summary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {conversations.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                      No conversations yet.
                    </td>
                  </tr>
                )}
                {conversations.map((c) => {
                  const leadRating = c.lead_rating || null;
                  const leadScore = c.lead_score || null;
                  
                  return (
                    <tr key={c.id}>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{new Date(c.updated_at).toLocaleString()}</td>
                      <td className="text-muted">{c.visitor_id || '—'}</td>
                      <td><span className="badge">{c.message_count}</span></td>
                      <td>
                        {leadRating ? (
                          <span
                            className="badge"
                            style={{
                              background:
                                leadRating === 'HOT'
                                  ? '#ef4444'
                                  : leadRating === 'WARM'
                                    ? '#f59e0b'
                                    : '#94a3b8',
                              color: '#fff',
                              fontWeight: 600,
                            }}
                          >
                            {leadRating} ({leadScore})
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-muted" style={{ maxWidth: 340 }}>
                        {c.summary ? (c.summary.length > 120 ? c.summary.slice(0, 120) + '…' : c.summary) : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Link href={`/sites/${siteId}/conversations/${c.id}`} className="btn btn-secondary btn-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}

