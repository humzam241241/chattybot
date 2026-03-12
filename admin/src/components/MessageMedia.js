'use client';

import { useEffect, useState } from 'react';
import { getAccessToken } from '../lib/supabase';

function isImageType(contentType) {
  if (!contentType) return true;
  return String(contentType).toLowerCase().startsWith('image/');
}

export default function MessageMedia({ conversationId, messageId, mediaContentType }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    async function load() {
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `/api/conversations/${conversationId}/messages/${messageId}/media`,
          { headers: token ? { 'X-Supabase-Token': token } : {} }
        );
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversationId, messageId]);

  if (error) return <span className="text-muted">Failed to load media</span>;
  if (!src) return <span className="text-muted">Loading photo…</span>;

  if (isImageType(mediaContentType)) {
    return (
      <div style={{ marginTop: 8 }}>
        <img
          src={src}
          alt="Attachment"
          style={{
            maxWidth: '100%',
            maxHeight: 280,
            borderRadius: 8,
            objectFit: 'contain',
            border: '1px solid var(--border)',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <a href={src} download target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
        View attachment
      </a>
    </div>
  );
}
