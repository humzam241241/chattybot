"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { deleteConversation } from "@/lib/api";

export default function ConversationsPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params?.id;

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showMessages, setShowMessages] = useState(false);

  async function loadConversations() {
    try {
      const res = await fetch(`/api/conversations/site/${siteId}`);
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = await res.json();
      setConversations(data?.conversations ?? []);
    } catch (err) {
      console.error("Conversation load error:", err);
    }
  }

  useEffect(() => {
    if (!siteId) return;

    async function load() {
      await loadConversations();
      setLoading(false);
    }

    load();
  }, [siteId]);

  async function loadMessages(conversationId) {
    setMessagesLoading(true);
    setSelectedConversation(conversationId);
    setShowMessages(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setMessages(data?.messages ?? []);
    } catch (err) {
      console.error("Messages load error:", err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  function handleBack() {
    setShowMessages(false);
    setSelectedConversation(null);
  }

  async function handleDelete(conversationId, e) {
    e.stopPropagation();
    if (!confirm("Delete this conversation and all its messages?")) return;
    
    setDeleting(conversationId);
    try {
      await deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (selectedConversation === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete conversation");
    } finally {
      setDeleting(null);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    await loadConversations();
    setLoading(false);
  }

  if (loading) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  return (
    <>
    <style jsx global>{`
      @media (max-width: 768px) {
        .conversations-container {
          grid-template-columns: 1fr !important;
        }
        .conversations-list {
          display: ${showMessages ? 'none' : 'block'} !important;
        }
        .chat-panel {
          display: ${showMessages ? 'flex' : 'none'} !important;
        }
        .mobile-back-btn {
          display: flex !important;
        }
      }
    `}</style>
    <div style={styles.container} className="conversations-container">
      {/* Left Panel - Conversation List */}
      <div style={styles.conversationList} className="conversations-list">
        <div style={styles.panelHeader}>
          <h2 style={styles.panelTitle}>Conversations</h2>
          <button onClick={handleRefresh} style={styles.refreshBtn} disabled={loading}>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
        {conversations.length === 0 ? (
          <p style={styles.emptyState}>No conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              style={{
                ...styles.conversationItem,
                ...(selectedConversation === c.id ? styles.conversationItemSelected : {}),
              }}
              onClick={() => loadMessages(c.id)}
            >
              <div style={styles.itemHeader}>
                <div style={styles.visitorId}>{c.visitor_id}</div>
                <button
                  onClick={(e) => handleDelete(c.id, e)}
                  style={styles.deleteBtn}
                  disabled={deleting === c.id}
                  title="Delete conversation"
                >
                  {deleting === c.id ? "..." : "×"}
                </button>
              </div>
              <div style={styles.conversationMeta}>
                <span style={styles.messageCount}>
                  {c.message_count || 0} messages
                </span>
                <span style={styles.timestamp}>
                  {new Date(c.created_at).toLocaleString()}
                </span>
              </div>
              {c.summary && (
                <div style={styles.summary}>{c.summary}</div>
              )}
              {c.lead_rating && (
                <span style={{
                  ...styles.badge,
                  backgroundColor: c.lead_rating === 'HOT' ? '#dc2626' : 
                                   c.lead_rating === 'WARM' ? '#f59e0b' : '#6b7280'
                }}>
                  {c.lead_rating}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Right Panel - Chat Messages */}
      <div style={styles.chatPanel} className="chat-panel">
        {selectedConversation && (
          <button
            onClick={handleBack}
            className="mobile-back-btn"
            style={{
              display: 'none',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              background: '#fff',
              border: 'none',
              borderBottom: '1px solid #e5e7eb',
              cursor: 'pointer',
              fontSize: 14,
              color: '#3b82f6',
              fontWeight: 500,
            }}
          >
            ← Back to list
          </button>
        )}
        {!selectedConversation ? (
          <div style={styles.placeholder}>
            <p>Select a conversation to view messages</p>
          </div>
        ) : messagesLoading ? (
          <p style={{ padding: 20 }}>Loading messages...</p>
        ) : messages.length === 0 ? (
          <div style={styles.placeholder}>
            <p>No messages in this conversation</p>
          </div>
        ) : (
          <div style={styles.messageList}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  ...styles.message,
                  ...(m.role === 'user' ? styles.userMessage : styles.assistantMessage),
                }}
              >
                <div style={styles.messageRole}>
                  {m.role === 'user' ? 'USER' : 'BOT'}
                </div>
                <div style={styles.messageContent}>{m.content}</div>
                <div style={styles.messageTime}>
                  {new Date(m.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    height: 'calc(100vh - 60px)',
    backgroundColor: '#fff',
  },
  conversationList: {
    borderRight: '1px solid #e5e7eb',
    overflowY: 'auto',
    backgroundColor: '#f9fafb',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  panelTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
  },
  refreshBtn: {
    padding: '6px 12px',
    fontSize: 13,
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    cursor: 'pointer',
  },
  conversationItem: {
    padding: '14px 20px',
    borderBottom: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'background 0.15s',
    backgroundColor: '#fff',
  },
  conversationItemSelected: {
    backgroundColor: '#eff6ff',
    borderLeft: '3px solid #3b82f6',
  },
  itemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  visitorId: {
    fontSize: 13,
    fontWeight: 500,
    color: '#1f2937',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    flex: 1,
  },
  deleteBtn: {
    padding: '2px 8px',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    borderRadius: 4,
    marginLeft: 8,
    lineHeight: 1,
  },
  conversationMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#6b7280',
  },
  messageCount: {
    fontWeight: 500,
  },
  timestamp: {
    color: '#9ca3af',
  },
  summary: {
    marginTop: 8,
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 1.4,
  },
  badge: {
    display: 'inline-block',
    marginTop: 8,
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 600,
    color: '#fff',
  },
  emptyState: {
    padding: 20,
    color: '#6b7280',
    textAlign: 'center',
  },
  chatPanel: {
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    backgroundColor: '#f3f4f6',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
    fontSize: 14,
  },
  messageList: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  message: {
    maxWidth: '75%',
    padding: 14,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.5,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    color: '#fff',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    color: '#1f2937',
    borderBottomLeftRadius: 4,
    border: '1px solid #e5e7eb',
  },
  messageRole: {
    fontSize: 10,
    fontWeight: 600,
    marginBottom: 6,
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  messageTime: {
    marginTop: 8,
    fontSize: 10,
    opacity: 0.6,
    textAlign: 'right',
  },
};
