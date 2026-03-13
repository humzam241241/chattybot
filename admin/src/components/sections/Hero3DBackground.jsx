'use client';

import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const HologramBot = dynamic(
  () => import('../ui/hologram-bot'),
  { ssr: false }
);

export default function Hero3DBackground({ visible = true }) {
  return (
    <motion.div
      className="absolute inset-0 z-0"
      initial={{ opacity: 1 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 1.4, ease: [0.25, 0.4, 0.25, 1] }}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-[var(--background)]/50 via-[var(--background)]/25 to-[var(--background)]"
        style={{ pointerEvents: 'none' }}
      />
      <div className="absolute inset-0">
        <HologramBot />
      </div>
    </motion.div>
  );
}
