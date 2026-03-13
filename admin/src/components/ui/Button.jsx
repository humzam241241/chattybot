'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { transitionSpring } from '../../lib/motion-variants';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60';

const variants = {
  primary:
    'bg-[var(--ink)] text-white hover:bg-[var(--brand-hover)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]',
  secondary:
    'border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--brand-muted)]',
  ghost: 'text-[var(--ink-secondary)] hover:bg-[var(--brand-muted)] hover:text-[var(--ink)]',
};

const sizes = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
};

export default function Button({
  href,
  children,
  variant = 'primary',
  size = 'lg',
  className = '',
  ...props
}) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();

  if (href) {
    return (
      <motion.span
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={transitionSpring}
      >
        <Link href={href} className={classes} {...props}>
          {children}
        </Link>
      </motion.span>
    );
  }

  return (
    <motion.button
      type="button"
      className={classes}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={transitionSpring}
      {...props}
    >
      {children}
    </motion.button>
  );
}
