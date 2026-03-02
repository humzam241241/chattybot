import React, { useState, useRef, useEffect } from 'react';
import Message from './Message';
import LeadForm from './LeadForm';
import TypingIndicator from './TypingIndicator';

const WELCOME_MSG = {
  role: 'bot',
  content: "Hi! I'm here to help. Ask me anything about our products or services.",
  timestamp: new Date(),
};

export default function ChatWindow({ siteId, apiUrl, config, primaryColor, onClose }) {
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, showLeadForm]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isTyping) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    setIsTyping(true);

    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          user_message: text,
          current_page_url: window.location.href,
        }),
      });

      const data = await res.json();
      const answer = data.answer || "Sorry, I couldn't get a response. Please try again.";

      setMessages((prev) => [...prev, { role: 'bot', content: answer, timestamp: new Date() }]);

      // Show lead form if backend detected contact intent and not already captured
      if (data.should_capture_lead && !leadCaptured) {
        setShowLeadForm(true);
      }
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
      sendMessage();
    }
  }

  const initial = (config.company_name || 'S')[0].toUpperCase();

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
          onClick={sendMessage}
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
