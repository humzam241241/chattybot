'use client';

import { motion } from 'framer-motion';
import { Button } from '../ui';
import ChatDemo from '../chat/ChatDemo';
import {
  fadeInUp,
  staggerContainer,
  staggerItem,
  transitionNormal,
} from '../../lib/motion-variants';

const containerVariants = staggerContainer(0.1, 0.15);

export default function Hero() {
  return (
    <section className="relative px-4 pt-16 pb-24 md:pt-24 md:pb-30">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1fr,360px] md:gap-16 md:items-start">
        <motion.div
          className="max-w-xl"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          transition={transitionNormal}
        >
          <motion.h1
            variants={staggerItem}
            className="text-display-sm font-semibold tracking-tight text-[var(--ink)] md:text-display"
          >
            AI Chatbots That Convert{' '}
            <span className="block text-[var(--ink-secondary)]">
              Visitors Into Leads
            </span>
          </motion.h1>
          <motion.p
            variants={staggerItem}
            className="mt-5 text-body-lg text-[var(--ink-secondary)]"
          >
            Install an AI employee on your website. It answers questions, captures
            leads, and notifies you by SMS or email — so contractors and local
            businesses never miss an opportunity.
          </motion.p>
          <motion.div variants={staggerItem} className="mt-8 flex flex-wrap gap-3">
            <Button href="/sign-up" variant="primary" size="lg">
              Start free trial
            </Button>
            <Button href="/pricing" variant="secondary" size="lg">
              View pricing
            </Button>
          </motion.div>
          <motion.p
            variants={staggerItem}
            className="mt-5 text-caption text-[var(--ink-tertiary)]"
          >
            14-day free trial. No credit card required.
          </motion.p>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          transition={{ ...transitionNormal, delay: 0.25 }}
          className="flex justify-center md:justify-end"
        >
          <ChatDemo />
        </motion.div>
      </div>
    </section>
  );
}
