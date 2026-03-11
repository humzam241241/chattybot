import React from 'react';

function RaffyAvatarIcon() {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cb-raffy-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#e2e8f0" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#cb-raffy-g)" />
      <circle cx="32" cy="34" r="16" fill="#fde68a" />
      <path d="M16 26c6-10 26-14 36 0 0-10-8-18-18-18S16 16 16 26z" fill="#0f172a" opacity="0.9" />
      <circle cx="26" cy="34" r="2.2" fill="#0f172a" />
      <circle cx="38" cy="34" r="2.2" fill="#0f172a" />
      <path d="M26 42c3 3 9 3 12 0" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function ChatBubble({ primaryColor, isOpen, onClick, label = 'Chat with Raffy' }) {
  return (
    <div className="cb-bubble-wrap">
      {!isOpen && (
        <button type="button" className="cb-bubble-label" onClick={onClick} aria-label={label}>
          {label}
        </button>
      )}

      <button
        type="button"
        className="cb-bubble"
        style={{ background: primaryColor }}
        onClick={onClick}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          // X icon
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          <span className="cb-raffy-avatar" aria-hidden="true">
            <RaffyAvatarIcon />
          </span>
        )}
      </button>
    </div>
  );
}
