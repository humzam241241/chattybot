import React from 'react';

export default function ChatBubble({ primaryColor, isOpen, onClick }) {
  return (
    <button
      className="cb-bubble"
      style={{ background: primaryColor }}
      onClick={onClick}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {isOpen ? (
        // X icon
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      ) : (
        // Chat bubble icon
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z" />
        </svg>
      )}
    </button>
  );
}
