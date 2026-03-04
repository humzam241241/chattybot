'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { listConversations, getSite } from '../../../../lib/api';
import SiteLayout from '../../../../components/SiteLayout';

export default function SiteConversationsPage() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getSite(id), listConversations(id)])
      .then(([siteData, convoData]) => {
        setSite(siteData.site);
        setConversations(convoData.conversations || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <SiteLayout siteName={site?.company_name || 'Loading...'}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversations</h1>
          <p className="page-subtitle">Chat history and lead scores</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="text-muted">Loading...</p>}

      {!loading && (
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
                        <Link href={`/sites/${id}/conversations/${c.id}`} className="btn btn-secondary btn-sm">
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

