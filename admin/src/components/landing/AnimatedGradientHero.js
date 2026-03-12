'use client';

import { motion } from 'framer-motion';

export default function AnimatedGradientHero({ children, className = '' }) {
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 50% 30% at 20% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
            linear-gradient(180deg, var(--background) 0%, var(--muted) 100%)
          `,
        }}
        animate={{
          opacity: [0.8, 1, 0.8],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(139, 92, 246, 0.04) 50%, transparent 100%)',
        }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
