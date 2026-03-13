'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Check } from 'lucide-react';
import { messageReveal } from '../../lib/motion-variants';

const DEMO_MESSAGES = [
  { role: 'bot', text: "Hi! I'm here to help. What can I do for you today?" },
  { role: 'user', text: 'Do you offer free estimates?' },
  { role: 'bot', text: 'Yes! What type of project are you thinking about?' },
  { role: 'user', text: 'Roof inspection for my home' },
  { role: 'bot', text: 'We do those all the time. Are you looking for a full inspection or just a quote?' },
  { role: 'user', text: 'Full inspection — we had some storm damage' },
  { role: 'bot', text: "Got it. I'll get you on the schedule for a free inspection. What's the best number to reach you?" },
  { role: 'user', text: '555-123-4567' },
  { role: 'bot', text: "Perfect. We'll call within 24 hours to confirm. Anything else I can help with?" },
  { role: 'user', text: 'That’s it, thanks!' },
  { role: 'bot', text: "You're welcome — talk soon!" },
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
        timeoutId = setTimeout(() => setLeadCaptured(true), 500);
        return;
      }
      setTyping(true);
      setMessages((prev) => [...prev, DEMO_MESSAGES[i]]);
      i += 1;
      // Vary delay: first message quick, then 800–1400ms so conversation feels natural
      const baseDelay = i === 1 ? 600 : 800 + Math.min(i * 80, 600);
      timeoutId = setTimeout(addNext, baseDelay);
    };

    timeoutId = setTimeout(addNext, 400);

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
        style={{ minHeight: 380 }}
      >
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages
              .filter((m) => m != null && typeof m.role === 'string')
              .map((m, i) => {
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
