'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from '../ui';

export default function CTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      ref={ref}
      className="border-t border-[var(--border)] bg-[var(--brand-muted)] px-4 py-20 md:py-28"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-xl text-center"
      >
        <h2 className="text-display-sm font-semibold tracking-tight text-[var(--ink)]">
          Ready to get started?
        </h2>
        <p className="mt-4 text-body text-[var(--ink-secondary)]">
          Join businesses using ChattyBot to capture more leads.
        </p>
        <div className="mt-8">
          <Button href="/sign-up" variant="primary" size="lg">
            Start your free trial
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
