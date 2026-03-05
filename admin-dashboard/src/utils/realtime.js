/**
 * Real-time Dashboard Updates (Optional Enhancement)
 * 
 * This file demonstrates how to add Supabase real-time subscriptions
 * to the React dashboard for live conversation updates.
 * 
 * To enable:
 * 1. npm install @supabase/supabase-js
 * 2. Import this file in your React components
 * 3. Call useRealtimeConversations() hook
 */

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

/**
 * Real-time conversation updates
 * 
 * Usage:
 * const conversations = useRealtimeConversations(siteId);
 */
export function useRealtimeConversations(siteId, onUpdate) {
  useEffect(() => {
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: siteId ? `site_id=eq.${siteId}` : undefined,
        },
        (payload) => {
          console.log('[Realtime] Conversation updated:', payload);
          if (onUpdate) onUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [siteId, onUpdate]);
}

/**
 * Real-time message updates
 */
export function useRealtimeMessages(conversationId, onMessage) {
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[Realtime] New message:', payload);
          if (onMessage) onMessage(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, onMessage]);
}

/**
 * Example integration in ConversationsPage.js:
 * 
 * import { useRealtimeConversations } from '../utils/realtime';
 * 
 * function ConversationsPage({ siteFilter }) {
 *   const [conversations, setConversations] = useState([]);
 * 
 *   useRealtimeConversations(siteFilter, (payload) => {
 *     if (payload.eventType === 'INSERT') {
 *       setConversations(prev => [payload.new, ...prev]);
 *     } else if (payload.eventType === 'UPDATE') {
 *       setConversations(prev => 
 *         prev.map(c => c.id === payload.new.id ? payload.new : c)
 *       );
 *     }
 *   });
 * 
 *   return <div>...</div>;
 * }
 */
