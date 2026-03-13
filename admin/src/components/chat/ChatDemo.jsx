'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Check } from 'lucide-react';
import { messageReveal } from '../../lib/motion-variants';

const DEMO_MESSAGES = [
  { role: 'user', text: 'Do you offer free estimates?' },
  { role: 'bot', text: 'Yes! What type of project?' },
  { role: 'user', text: 'Roof inspection' },
  { role: 'bot', text: "Great — let's schedule that." },
];

export default function ChatDemo({ className = '' }) {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);

  useEffect(() => {
    let i = 0;
    let timeoutId;

    const addNext = () => {
      if (i >= DEMO_MESSAGES.length) {
        setTyping(false);
        // Show "Lead captured" after last bot message
        timeoutId = setTimeout(() => setLeadCaptured(true), 600);
        return;
      }
      setTyping(true);
      setMessages((prev) => [...prev, DEMO_MESSAGES[i]]);
      i += 1;
      const delay = i === 1 ? 700 : 1000 + (i === 2 ? 400 : 0);
      timeoutId = setTimeout(addNext, delay);
    };

    timeoutId = setTimeout(addNext, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      style={{
        maxWidth: 360,
        margin: '0 auto',
      }}
    >
      <div
        className="rounded-t-[var(--radius-card)] border border-b-0 border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex items-center gap-3"
        style={{ minHeight: 56 }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: 'var(--ink)' }}
        >
          <MessageCircle className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">ChattyBot</p>
          <p className="text-xs text-[var(--ink-tertiary)]">Online</p>
        </div>
      </div>

      <div
        className="rounded-b-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-4 shadow-card"
        style={{ minHeight: 260 }}
      >
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <motion.div
                  key={i}
                  initial={messageReveal.hidden}
                  animate={messageReveal.visible}
                  transition={messageReveal.transition}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'ml-auto bg-[var(--ink)] text-white rounded-br-md'
                      : 'rounded-bl-md bg-[var(--brand-muted)] text-[var(--ink)]'
                  }`}
                >
                  {m.text}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {typing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex max-w-[85%] gap-1 rounded-2xl rounded-bl-md bg-[var(--brand-muted)] px-3.5 py-2.5"
            >
              {[0, 1, 2].map((j) => (
                <motion.span
                  key={j}
                  className="h-1.5 w-1.5 rounded-full bg-[var(--ink-tertiary)]"
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: j * 0.14,
                  }}
                />
              ))}
            </motion.div>
          )}

          <AnimatePresence>
            {leadCaptured && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--success)] bg-[#f0fdf4] px-3 py-2 text-sm text-[#166534]"
              >
                <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span className="font-medium">Lead captured</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
