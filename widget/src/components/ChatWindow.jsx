import React, { useState, useRef, useEffect } from 'react';
import Message from './Message';
import LeadForm from './LeadForm';
import TypingIndicator from './TypingIndicator';

const DEFAULT_INTRO = "Hi! I'm here to help. Ask me anything about our products or services.";

export default function ChatWindow({ siteId, apiUrl, config, primaryColor, onClose }) {
  const [messages, setMessages] = useState(() => [
    {
      role: 'bot',
      content: config?.intro_message || DEFAULT_INTRO,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [bookingUrl, setBookingUrl] = useState(null);
  const [visitorId, setVisitorId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, showLeadForm]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // When site config changes (or window opens), refresh the intro message once.
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [{ role: 'bot', content: config?.intro_message || DEFAULT_INTRO, timestamp: new Date() }];
    });
  }, [config?.intro_message]);

  useEffect(() => {
    // Stable anonymous visitor id for analytics/logs (no PII)
    const key = 'chattybot_visitor_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(key, id);
    }
    setVisitorId(id);

    const convKey = `chattybot_conversation_${siteId}`;
    const existing = localStorage.getItem(convKey);
    if (existing) setConversationId(existing);
  }, [siteId]);

  function upsertConversation(id) {
    if (id && id !== conversationId) {
      setConversationId(id);
      localStorage.setItem(`chattybot_conversation_${siteId}`, id);
    }
  }

  async function sendMessageText(rawText) {
    const text = String(rawText || '').trim();
    if (!text || isTyping) return;

    setInput('');
    setBookingUrl(null);
    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    setIsTyping(true);

    try {
      // Try SSE streaming first; fallback to non-streaming /chat.
      const streamRes = await fetch(`${apiUrl}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          user_message: text,
          current_page_url: window.location.href,
          visitor_id: visitorId,
          conversation_id: conversationId || undefined,
        }),
      });

      if (streamRes.ok && streamRes.body) {
        const startedAt = new Date();
        setMessages((prev) => [...prev, { role: 'bot', content: '', timestamp: startedAt }]);

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const appendToken = (token) => {
          if (!token) return;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (!last || last.role !== 'bot') return next;
            next[next.length - 1] = { ...last, content: (last.content || '') + token };
            return next;
          });
        };

        const handleDone = (payload) => {
          if (payload?.should_capture_lead && !leadCaptured) setShowLeadForm(true);
          if (payload?.should_offer_booking && payload?.booking_url) setBookingUrl(payload.booking_url);
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n').filter(Boolean);
            let event = 'message';
            let dataLine = '';
            for (const line of lines) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              if (line.startsWith('data:')) dataLine += line.slice(5).trim();
            }
            if (!dataLine) continue;

            let payload = null;
            try { payload = JSON.parse(dataLine); } catch { payload = null; }

            if (event === 'meta' && payload?.conversation_id) upsertConversation(payload.conversation_id);
            if (event === 'token') appendToken(payload?.token || dataLine);
            if (event === 'done') handleDone(payload);
          }
        }

        return;
      }

      // Fallback: non-streaming JSON response
      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          user_message: text,
          current_page_url: window.location.href,
          visitor_id: visitorId,
          conversation_id: conversationId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error('[ChattyBot] Chat error:', data);
        throw new Error(data.error || 'Chat request failed');
      }

      const answer = data.answer || "Sorry, I couldn't get a response. Please try again.";
      setMessages((prev) => [...prev, { role: 'bot', content: answer, timestamp: new Date() }]);
      if (data.conversation_id) upsertConversation(data.conversation_id);
      if (data.should_capture_lead && !leadCaptured) setShowLeadForm(true);
      if (data.should_offer_booking && data.booking_url) setBookingUrl(data.booking_url);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: 'Connection error. Please try again.', timestamp: new Date() },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageText(input);
    }
  }

  const initial = (config.company_name || 'S')[0].toUpperCase();
  const suggested = Array.isArray(config?.suggested_questions) ? config.suggested_questions : [];
  const showChips = messages.length <= 1 && suggested.length > 0 && !showLeadForm;

  return (
    <div className="cb-window" style={{ '--cb-primary': primaryColor }}>
      {/* Header */}
      <div className="cb-header" style={{ background: primaryColor }}>
        <div className="cb-header-info">
          <div className="cb-avatar">{initial}</div>
          <div>
            <div className="cb-company">{config.company_name}</div>
            <div className="cb-status">● Online</div>
          </div>
        </div>
        <button className="cb-close" onClick={onClose} aria-label="Close">&times;</button>
      </div>

      {/* Messages */}
      <div className="cb-messages">
        {messages.map((msg, i) => (
          <Message
            key={i}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
            primaryColor={primaryColor}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies */}
      {showChips && (
        <div className="cb-chips" aria-label="Suggested questions">
          {suggested.slice(0, 6).map((q, idx) => (
            <button
              key={idx}
              type="button"
              className="cb-chip"
              onClick={() => sendMessageText(q)}
              disabled={isTyping}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Booking CTA */}
      {bookingUrl && (
        <div className="cb-cta-row">
          <button
            type="button"
            className="cb-cta"
            onClick={() => window.open(bookingUrl, '_blank', 'noopener,noreferrer')}
          >
            Book a call
          </button>
        </div>
      )}

      {/* Lead capture form — shown inline above input when triggered */}
      {showLeadForm && !leadCaptured && (
        <LeadForm
          siteId={siteId}
          apiUrl={apiUrl}
          primaryColor={primaryColor}
          onDismiss={() => setShowLeadForm(false)}
          onSuccess={() => {
            setLeadCaptured(true);
            setShowLeadForm(false);
            setMessages((prev) => [
              ...prev,
              {
                role: 'bot',
                content: "Thanks! A team member will reach out to you shortly.",
                timestamp: new Date(),
              },
            ]);
          }}
        />
      )}

      {/* Input */}
      <div className="cb-input-row">
        <textarea
          ref={inputRef}
          className="cb-input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isTyping}
        />
        <button
          className="cb-send"
          style={{ background: primaryColor }}
          onClick={() => sendMessageText(input)}
          disabled={!input.trim() || isTyping}
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
      </div>

      <div className="cb-powered">Powered by ChattyBot</div>
    </div>
  );
}
