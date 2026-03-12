'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const DEMO_MESSAGES = [
  { role: 'bot', text: "Hi! I'm here to help. What can I do for you today?" },
  { role: 'user', text: 'Do you offer free estimates?' },
  { role: 'bot', text: "Yes! We'd be happy to provide a free estimate. What type of project do you have in mind?" },
  { role: 'user', text: 'Roof inspection for my home' },
  { role: 'bot', text: "I'll connect you with our team to schedule your free roof inspection. One moment please..." },
];

export default function ChatDemo({ className = '' }) {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let i = 0;
    const addNext = () => {
      if (i >= DEMO_MESSAGES.length) {
        setTyping(false);
        return;
      }
      setTyping(true);
      setMessages((prev) => [...prev, DEMO_MESSAGES[i]]);
      i += 1;
      const delay = i === 1 ? 800 : 1200 + Math.random() * 400;
      const t = setTimeout(addNext, delay);
      return () => clearTimeout(t);
    };
    const t = setTimeout(addNext, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(99, 102, 241, 0.08)',
        maxWidth: 360,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-accent), #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 16,
          }}
        >
          ✓
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>ChattyBot</div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Online</div>
        </div>
      </div>
      <div style={{ padding: 16, minHeight: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AnimatePresence initial={false}>
          {messages
            .filter((m) => m != null && typeof m.role === 'string')
            .map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: 14,
                    fontSize: 13,
                    lineHeight: 1.45,
                    background: isUser ? 'var(--primary-accent)' : 'var(--muted)',
                    color: isUser ? '#fff' : 'var(--foreground)',
                    borderBottomRightRadius: isUser ? 4 : 14,
                    borderBottomLeftRadius: isUser ? 14 : 4,
                  }}
                >
                  {m.text ?? ''}
                </motion.div>
              );
            })}
        </AnimatePresence>
        {typing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              alignSelf: 'flex-start',
              padding: '10px 14px',
              borderRadius: 14,
              borderBottomLeftRadius: 4,
              background: 'var(--muted)',
              display: 'flex',
              gap: 4,
            }}
          >
            {[0, 1, 2].map((j) => (
              <motion.span
                key={j}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--muted-foreground)',
                }}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: j * 0.15 }}
              />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
