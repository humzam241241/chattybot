'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { listConversations, getSite } from '../../../../lib/api';

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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversations</h1>
          <p className="page-subtitle">{site?.company_name || id}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/sites/${id}`} className="btn btn-secondary">← Back</Link>
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
                  <th>Summary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {conversations.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                      No conversations yet.
                    </td>
                  </tr>
                )}
                {conversations.map((c) => (
                  <tr key={c.id}>
                    <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{new Date(c.updated_at).toLocaleString()}</td>
                    <td className="text-muted">{c.visitor_id || '—'}</td>
                    <td><span className="badge">{c.message_count}</span></td>
                    <td className="text-muted" style={{ maxWidth: 340 }}>
                      {c.summary ? (c.summary.length > 120 ? c.summary.slice(0, 120) + '…' : c.summary) : '—'}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Link href={`/sites/${id}/conversations/${c.id}`} className="btn btn-secondary btn-sm">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

