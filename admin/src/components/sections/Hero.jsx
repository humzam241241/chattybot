'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui';
import ChatDemo from '../chat/ChatDemo';
import Hero3DBackground from './Hero3DBackground';
import { transitionNormal } from '../../lib/motion-variants';

// Text flies in from the left
const flyInFromLeft = {
  hidden: { opacity: 0, x: -80 },
  visible: { opacity: 1, x: 0 },
};

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 1.25, // robot on screen 1.25s, then text slides in as robot fades
    },
  },
};

const ROBOT_FADE_DELAY = 1250; // robot on screen 1.25s, then slowly fades as text slides in

export default function Hero() {
  const [robotVisible, setRobotVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setRobotVisible(false), ROBOT_FADE_DELAY);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative min-h-[90vh] overflow-hidden bg-[var(--background)] px-4 pt-20 pb-24 md:min-h-[88vh] md:pt-28 md:pb-30">
      <Hero3DBackground visible={robotVisible} />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-12 pt-4 md:grid-cols-[1fr,360px] md:gap-16 md:items-start md:pt-8">
        <motion.div
          className="max-w-xl"
          variants={container}
          initial="hidden"
          animate="visible"
          transition={transitionNormal}
        >
          <motion.h1
            variants={flyInFromLeft}
            transition={{ duration: 0.75, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-display-sm font-semibold tracking-tight text-[var(--ink)] md:text-display"
          >
            AI Chatbots That Convert{' '}
            <span className="block text-[var(--ink-secondary)]">
              Visitors Into Leads
            </span>
          </motion.h1>
          <motion.p
            variants={flyInFromLeft}
            transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-5 text-body-lg text-[var(--ink-secondary)]"
          >
            Install an AI employee on your website. It answers questions, captures
            leads, and notifies you by SMS or email — so contractors and local
            businesses never miss an opportunity.
          </motion.p>
          <motion.div
            variants={flyInFromLeft}
            transition={{ duration: 0.65, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Button href="/sign-up" variant="primary" size="lg">
              Start free trial
            </Button>
            <Button href="/pricing" variant="secondary" size="lg">
              View pricing
            </Button>
          </motion.div>
          <motion.p
            variants={flyInFromLeft}
            transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
            className="mt-5 text-caption text-[var(--ink-tertiary)]"
          >
            14-day free trial. No credit card required.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -56 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.85, delay: 1.45, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex justify-center md:justify-end"
        >
          <ChatDemo />
        </motion.div>
      </div>
    </section>
  );
}
