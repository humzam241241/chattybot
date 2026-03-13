'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  MessageSquare,
  UserPlus,
  Smartphone,
  BarChart3,
  Palette,
  Code,
} from 'lucide-react';
import { StaggerChildren, StaggerItem, HoverGlow } from '../motion';
import { Card, CardContent } from '../ui';

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Smart AI conversations',
    description:
      'Understands context and gives accurate, helpful answers so visitors get the right information.',
  },
  {
    icon: UserPlus,
    title: 'Lead capture & scoring',
    description:
      'Automatically capture leads and score them Hot, Warm, or Cold from conversation intent.',
  },
  {
    icon: Smartphone,
    title: 'SMS & email notifications',
    description:
      'Get notified instantly. Same AI, multiple channels — never miss a high-intent lead.',
  },
  {
    icon: BarChart3,
    title: 'Analytics dashboard',
    description:
      'Track conversations, leads, conversion rates, and more with clear, actionable analytics.',
  },
  {
    icon: Palette,
    title: 'Fully customizable',
    description:
      'Match your brand with custom colors, personality, and guardrails.',
  },
  {
    icon: Code,
    title: 'Easy integration',
    description:
      'Add to any website with one script tag. Works with WordPress, Shopify, and more.',
  },
];

export default function FeaturesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section className="border-t border-[var(--border)] bg-[var(--brand-muted)] px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h2 className="text-display-sm font-semibold tracking-tight text-[var(--ink)] md:text-display">
            Everything you need
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-body text-[var(--ink-secondary)]">
            One AI employee on your site: answers questions, captures leads, and
            keeps you in the loop.
          </p>
        </motion.div>

        <StaggerChildren
          className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          staggerChildren={0.06}
          delayChildren={0.1}
        >
          {FEATURES.map((feature) => (
            <StaggerItem key={feature.title}>
              <HoverGlow className="h-full">
                <Card className="h-full transition-shadow duration-200">
                  <CardContent className="p-6">
                    <feature.icon
                      className="h-6 w-6 text-[var(--ink)]"
                      strokeWidth={1.75}
                    />
                    <h3 className="mt-4 text-base font-semibold text-[var(--ink)]">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </HoverGlow>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
