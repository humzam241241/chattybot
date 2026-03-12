'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getConversation } from '../../../../../lib/api';
import MessageMedia from '../../../../../components/MessageMedia';

export default function ConversationDetailPage() {
  const { id, conversation_id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getConversation(conversation_id)
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [conversation_id]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Conversation</h1>
          <p className="page-subtitle">{conversation_id}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/sites/${id}/conversations`} className="btn btn-secondary">← Back</Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="text-muted">Loading...</p>}

      {!loading && data && (
        <>
          <div className="card">
            <div className="card-title">Rolling Summary</div>
            <div className="card-meta" style={{ marginTop: 6 }}>
              {data.conversation.summary || '—'}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Transcript</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data.messages || []).map((m) => (
                <div key={m.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="badge">{m.role}</span>
                    <span className="text-muted">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  {m.content ? <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div> : null}
                  {m.media_url && (
                    <MessageMedia
                      conversationId={conversation_id}
                      messageId={m.id}
                      mediaContentType={m.media_content_type}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

