'use client';

import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function HeroContent({ children, className = '' }) {
  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function HeroTitle({ children, className = '' }) {
  return (
    <motion.h1 className={className} variants={item} transition={{ duration: 0.5 }}>
      {children}
    </motion.h1>
  );
}

export function HeroSubtitle({ children, className = '' }) {
  return (
    <motion.p className={className} variants={item} transition={{ duration: 0.5 }}>
      {children}
    </motion.p>
  );
}

export function HeroCTA({ children, className = '' }) {
  return (
    <motion.div className={className} variants={item} transition={{ duration: 0.4 }}>
      {children}
    </motion.div>
  );
}

export function HeroNote({ children, className = '' }) {
  return (
    <motion.p className={className} variants={item} transition={{ duration: 0.4 }}>
      {children}
    </motion.p>
  );
}
