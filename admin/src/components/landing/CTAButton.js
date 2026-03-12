'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function CTAButton({
  href,
  children,
  primary = true,
  className = '',
  size = 'lg',
}) {
  const baseClass = primary ? 'btn btn-primary' : 'btn btn-secondary';
  const sizeClass = size === 'lg' ? 'btn-lg' : '';
  const combined = `${baseClass} ${sizeClass} ${className}`.trim();

  return (
    <motion.span
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <Link
        href={href}
        className={combined}
        style={{
          position: 'relative',
          display: 'inline-block',
          boxShadow: primary ? '0 0 20px rgba(99, 102, 241, 0.35)' : undefined,
        }}
        onMouseEnter={(e) => {
          if (primary) {
            e.currentTarget.style.boxShadow = '0 0 28px rgba(99, 102, 241, 0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (primary) {
            e.currentTarget.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.35)';
          }
        }}
      >
        {children}
      </Link>
    </motion.span>
  );
}
