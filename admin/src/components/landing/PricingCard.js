'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import ScrollReveal from './ScrollReveal';

export default function PricingCard({
  title,
  price,
  period,
  description,
  features,
  ctaText,
  ctaHref,
  popular = false,
  delay = 0,
}) {
  return (
    <ScrollReveal delay={delay}>
      <motion.div
        style={{
          position: 'relative',
          background: 'var(--card)',
          border: `1px solid ${popular ? 'var(--primary-accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 28,
          boxShadow: popular ? '0 0 0 1px var(--primary-accent), 0 8px 24px var(--primary-glow)' : '0 1px 2px rgba(0,0,0,0.05)',
        }}
        whileHover={{
          y: -6,
          scale: 1.02,
          boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.4), 0 12px 40px rgba(99, 102, 241, 0.15)',
          transition: { duration: 0.25 },
        }}
      >
        {popular && (
          <span
            style={{
              position: 'absolute',
              top: -10,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--primary-accent)',
              color: '#fff',
              padding: '4px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Most Popular
          </span>
        )}
        <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: 'var(--foreground)' }}>{title}</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 40, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
              {price}
            </span>
            <span style={{ fontSize: 15, color: 'var(--muted-foreground)' }}>{period}</span>
          </div>
          {description && (
            <p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted-foreground)' }}>{description}</p>
          )}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
          {features.map((f, i) => (
            <li
              key={i}
              style={{
                padding: '6px 0',
                color: 'var(--muted-foreground)',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: 'var(--primary-accent)', fontWeight: 600 }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
        <Link
          href={ctaHref}
          className={popular ? 'btn btn-primary btn-full' : 'btn btn-secondary btn-full'}
          style={{
            display: 'block',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          {ctaText}
        </Link>
      </motion.div>
    </ScrollReveal>
  );
}
