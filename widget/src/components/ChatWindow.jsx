import React, { useState, useRef, useEffect } from 'react';
import Message from './Message';
import LeadForm from './LeadForm';
import TypingIndicator from './TypingIndicator';

const DEFAULT_INTRO = "Hi! I'm here to help. Ask me anything about our products or services.";

export default function ChatWindow({ siteId, apiUrl, config, primaryColor, pricingUrl, onClose }) {
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
  const [bookingOpen, setBookingOpen] = useState(false);
  const [visitorId, setVisitorId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [attachedImage, setAttachedImage] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

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
    // If booking CTA disappears, also close any open booking modal.
    if (!bookingUrl) setBookingOpen(false);
  }, [bookingUrl]);

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

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      if (base64) setAttachedImage({ dataUrl, base64, contentType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function sendMessageText(rawText) {
    const text = String(rawText || '').trim();
    const hasImage = attachedImage && attachedImage.base64;
    if ((!text && !hasImage) || isTyping) return;

    setInput('');
    setAttachedImage(null);
    setBookingUrl(null);
    const userMsg = { role: 'user', content: text || 'Photo', timestamp: new Date() };
    if (hasImage) userMsg.imageUrl = attachedImage.dataUrl;
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const payload = {
      site_id: siteId,
      user_message: text || '',
      current_page_url: window.location.href,
      visitor_id: visitorId,
      conversation_id: conversationId || undefined,
    };
    if (hasImage) {
      payload.user_image_base64 = attachedImage.base64;
      payload.user_image_content_type = attachedImage.contentType;
    }

    try {
      if (text) {
        const bookingTrigger = /\b(book|schedule|inspection)\b/i.test(text);
        const configuredBookingUrl = config?.booking_url ? String(config.booking_url) : '';
        if (bookingTrigger && configuredBookingUrl) {
          setBookingUrl(configuredBookingUrl);
          setBookingOpen(true);
        }
      }

      const streamRes = await fetch(`${apiUrl}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        body: JSON.stringify(payload),
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
  const bookingEmbed = Boolean(config?.booking_embed);
  const bookingButtonText = (config?.booking_button_text || 'Book a call').trim() || 'Book a call';
  const configuredBookingUrl = config?.booking_url ? String(config.booking_url) : '';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {configuredBookingUrl ? (
            <button
              type="button"
              className="cb-close"
              aria-label="Book"
              title={bookingButtonText}
              onClick={() => {
                setBookingUrl(configuredBookingUrl);
                setBookingOpen(true);
              }}
              style={{ fontSize: 16, width: 30, height: 30, display: 'grid', placeItems: 'center' }}
            >
              📅
            </button>
          ) : null}
          <button className="cb-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
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
            imageUrl={msg.imageUrl}
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
            onClick={() => {
              setBookingOpen(true);
            }}
          >
            {bookingButtonText}
          </button>
        </div>
      )}

      {/* Inline booking modal */}
      {bookingUrl && bookingOpen && (
        <div className="cb-modal-backdrop" role="dialog" aria-label="Booking">
          <div className="cb-modal">
            <div className="cb-modal-header">
              <div className="cb-modal-title">{bookingButtonText}</div>
              <button
                type="button"
                className="cb-modal-close"
                aria-label="Close booking"
                onClick={() => setBookingOpen(false)}
              >
                &times;
              </button>
            </div>
            <iframe
              className="cb-modal-frame"
              title="Booking"
              src={bookingUrl}
              loading="lazy"
              referrerPolicy="no-referrer"
              allow="clipboard-write; fullscreen"
            />
          </div>
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
      {attachedImage && (
        <div className="cb-attach-preview">
          <img src={attachedImage.dataUrl} alt="Attach" />
          <span>Photo attached</span>
          <button type="button" className="cb-attach-remove" onClick={() => setAttachedImage(null)} aria-label="Remove">×</button>
        </div>
      )}
      <div className="cb-input-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <button
          type="button"
          className="cb-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isTyping}
          aria-label="Upload photo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
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
          disabled={(!input.trim() && !attachedImage) || isTyping}
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
      </div>

      <div className="cb-powered">
        <span>Powered by Chattybot</span>
        {pricingUrl ? (
          <a href={pricingUrl} target="_blank" rel="noopener noreferrer">
            Pricing
          </a>
        ) : null}
      </div>
    </div>
  );
}
