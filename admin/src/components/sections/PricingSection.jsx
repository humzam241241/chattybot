'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Check } from 'lucide-react';
import { Button } from '../ui';
import { ScaleIn, HoverGlow } from '../motion';
import { Card, CardContent, CardHeader } from '../ui';

const PLANS = [
  {
    title: 'Pro',
    price: '$50',
    period: '/month',
    description: '5,000 messages / month',
    features: ['Unlimited chatbots', 'Lead capture & scoring', 'Analytics dashboard'],
    ctaText: 'View plans',
    ctaHref: '/pricing',
  },
  {
    title: 'Plus',
    price: '$150',
    period: '/month',
    description: '10,000 messages / month',
    features: ['Everything in Pro', 'Priority support', 'Early access to features'],
    ctaText: 'View plans',
    ctaHref: '/pricing',
    popular: true,
  },
  {
    title: 'Ultra',
    price: '$400',
    period: '/month',
    description: '20,000 messages / month',
    features: ['Everything in Plus', 'White-label option', 'Dedicated support'],
    ctaText: 'View plans',
    ctaHref: '/pricing',
  },
];

export default function PricingSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section className="px-4 py-20 md:py-28" ref={ref}>
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h2 className="text-display-sm font-semibold tracking-tight text-[var(--ink)] md:text-display">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-body text-[var(--ink-secondary)]">
            Choose a plan that fits your business. All plans include a 14-day free trial.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <ScaleIn key={plan.title} delay={plan.popular ? 0.1 : 0}>
              <HoverGlow className="h-full">
                <Card
                  className={`relative h-full ${
                    plan.popular
                      ? 'border-[var(--ink)] border-2 shadow-card-hover'
                      : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-semibold text-white">
                      Most popular
                    </div>
                  )}
                  <CardHeader className="pb-4 border-b border-[var(--border)]">
                    <h3 className="text-lg font-semibold text-[var(--ink)]">
                      {plan.title}
                    </h3>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight text-[var(--ink)]">
                        {plan.price}
                      </span>
                      <span className="text-sm text-[var(--ink-tertiary)]">
                        {plan.period}
                      </span>
                    </div>
                    {plan.description && (
                      <p className="mt-2 text-sm text-[var(--ink-secondary)]">
                        {plan.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-5">
                    <ul className="space-y-2.5">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-center gap-2 text-sm text-[var(--ink-secondary)]"
                        >
                          <Check
                            className="h-4 w-4 shrink-0 text-[var(--ink)]"
                            strokeWidth={2.5}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6">
                      <Button
                        href={plan.ctaHref}
                        variant={plan.popular ? 'primary' : 'secondary'}
                        size="md"
                        className="w-full"
                      >
                        {plan.ctaText}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </HoverGlow>
            </ScaleIn>
          ))}
        </div>
      </div>
    </section>
  );
}
