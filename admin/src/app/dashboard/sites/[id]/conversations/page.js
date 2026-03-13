"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { deleteConversation, getConversation, getSite, listConversations } from '../../../../../lib/api';
import SiteLayout from '../../../../../components/SiteLayout';
import MessageMedia from '../../../../../components/MessageMedia';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

export default function ConversationsPage() {
  const params = useParams();
  const siteId = params?.id;

  const [site, setSite] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showMessages, setShowMessages] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const [channel, setChannel] = useState(''); // '' | 'sms' | 'whatsapp'

  const loadData = useCallback(async () => {
    if (!siteId) return;
    try {
      const offset = (currentPage - 1) * pageSize;
      const [siteRes, convRes] = await Promise.all([
        getSite(siteId),
        listConversations(siteId, { limit: pageSize, offset, channel: channel || undefined })
      ]);
      setSite(siteRes.site);
      setConversations(convRes?.conversations ?? []);
      setPagination(convRes?.pagination ?? { total: 0, limit: pageSize, offset: 0 });
    } catch (err) {
      console.error("Load error:", err);
    }
  }, [siteId, currentPage, pageSize, channel]);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [siteId, loadData]);

  async function loadMessages(conversationId) {
    setMessagesLoading(true);
    setSelectedConversation(conversationId);
    setShowMessages(true);
    try {
      const data = await getConversation(conversationId);
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
    await loadData();
    setLoading(false);
  }

  const totalPages = Math.max(1, Math.ceil((pagination?.total ?? 0) / pageSize));
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  function goToPage(page) {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
  }

  function handlePageSizeChange(e) {
    const value = Number(e.target.value);
    setPageSize(value);
    setCurrentPage(1);
  }

  function handleChannelChange(ch) {
    setChannel(ch);
    setCurrentPage(1);
  }

  return (
    <SiteLayout siteName={site?.company_name || 'Loading...'}>
      <style jsx global>{`
        @media (max-width: 900px) {
          .conv-container {
            grid-template-columns: 1fr !important;
            height: auto !important;
            min-height: calc(100vh - 120px);
          }
          .conv-list {
            display: ${showMessages ? 'none' : 'block'} !important;
            max-height: none !important;
          }
          .conv-chat {
            display: ${showMessages ? 'flex' : 'none'} !important;
            min-height: 60vh;
          }
          .mobile-back {
            display: flex !important;
          }
        }
      `}</style>
      
      <div className="conv-container" style={styles.container}>
        {/* Left Panel - Conversation List */}
        <div className="conv-list" style={styles.conversationList}>
          <div style={styles.panelHeader}>
            <h2 style={styles.panelTitle}>Chats</h2>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {['', 'sms', 'whatsapp'].map((ch) => (
                <button
                  key={ch || 'all'}
                  type="button"
                  onClick={() => handleChannelChange(ch)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: channel === ch ? '#4338ca' : 'transparent',
                    color: channel === ch ? '#fff' : 'inherit',
                  }}
                >
                  {ch === '' ? 'All' : ch === 'sms' ? 'SMS' : 'WhatsApp'}
                </button>
              ))}
            </div>
            <div style={styles.headerControls}>
              <label style={styles.pageSizeLabel}>
                Per page:
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  style={styles.pageSizeSelect}
                  disabled={loading}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <button onClick={handleRefresh} style={styles.refreshBtn} disabled={loading} title="Refresh list">
                {loading ? "..." : "↻ Refresh"}
              </button>
            </div>
          </div>
          <div style={styles.paginationBar}>
            <span style={styles.paginationSummary}>
              {pagination?.total != null
                ? `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, pagination.total)} of ${pagination.total}`
                : "—"}
            </span>
            <div style={styles.paginationButtons}>
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={!canPrev || loading}
                style={{ ...styles.pageBtn, ...((!canPrev || loading) ? styles.pageBtnDisabled : {}) }}
              >
                Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p;
                if (totalPages <= 5) p = i + 1;
                else if (currentPage <= 3) p = i + 1;
                else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
                else p = currentPage - 2 + i;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    disabled={loading}
                    style={{
                      ...styles.pageBtn,
                      ...(p === currentPage ? styles.pageBtnActive : {}),
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={!canNext || loading}
                style={{ ...styles.pageBtn, ...((!canNext || loading) ? styles.pageBtnDisabled : {}) }}
              >
                Next
              </button>
            </div>
          </div>
          
          {loading ? (
            <p style={styles.emptyState}>Loading...</p>
          ) : conversations.length === 0 ? (
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
        <div className="conv-chat" style={styles.chatPanel}>
          {selectedConversation && (
            <button
              onClick={handleBack}
              className="mobile-back"
              style={styles.mobileBackBtn}
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
              {messages
                .filter((m) => m != null && typeof m.role === 'string')
                .map((m) => {
                  const isUser = m.role === 'user';
                return (
                <div
                  key={m.id}
                  style={{
                    ...styles.message,
                    ...(isUser ? styles.userMessage : styles.assistantMessage),
                  }}
                >
                  <div style={styles.messageRole}>
                    {isUser ? 'VISITOR' : 'BOT'}
                  </div>
                  <div style={styles.messageContent}>
                    {m?.media_url && (
                      <MessageMedia
                        conversationId={selectedConversation}
                        messageId={m.id}
                        mediaContentType={m.media_content_type}
                      />
                    )}
                    {m?.content && !/^\[User sent (a )?(roof )?photo\]$/i.test(String(m.content).trim()) ? (
                      <span style={{ display: 'block', marginTop: m?.media_url ? 8 : 0 }}>{m.content}</span>
                    ) : m?.content && !m?.media_url ? (
                      <span>{m.content}</span>
                    ) : null}
                    {!m?.content && !m?.media_url ? '—' : null}
                  </div>
                  <div style={styles.messageTime}>
                    {m?.created_at ? new Date(m.created_at).toLocaleTimeString() : ''}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: '360px 1fr',
    height: 'calc(100vh - 100px)',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
  },
  conversationList: {
    borderRight: '1px solid #e5e7eb',
    overflowY: 'auto',
    backgroundColor: '#f9fafb',
  },
  panelHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '14px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  panelTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#111827',
  },
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pageSizeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#4b5563',
  },
  pageSizeSelect: {
    padding: '4px 8px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    backgroundColor: '#fff',
    color: '#111827',
    cursor: 'pointer',
  },
  refreshBtn: {
    padding: '6px 12px',
    fontSize: 13,
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    cursor: 'pointer',
    color: '#374151',
  },
  paginationBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
    flexWrap: 'wrap',
    gap: 8,
  },
  paginationSummary: {
    fontSize: 12,
    color: '#6b7280',
  },
  paginationButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  pageBtn: {
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    backgroundColor: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  pageBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
    color: '#fff',
  },
  pageBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  conversationItem: {
    padding: '12px 16px',
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
    marginBottom: 4,
  },
  visitorId: {
    fontSize: 12,
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
    fontSize: 11,
    color: '#6b7280',
  },
  messageCount: {
    fontWeight: 500,
  },
  timestamp: {
    color: '#9ca3af',
  },
  summary: {
    marginTop: 6,
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 1.4,
  },
  badge: {
    display: 'inline-block',
    marginTop: 6,
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
  mobileBackBtn: {
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
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  message: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
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
    fontSize: 9,
    fontWeight: 600,
    marginBottom: 4,
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  messageTime: {
    marginTop: 6,
    fontSize: 9,
    opacity: 0.6,
    textAlign: 'right',
  },
};
