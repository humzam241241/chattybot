'use client';

import { motion } from 'framer-motion';
import {
  staggerContainer,
  staggerItem,
  transitionNormal,
} from '../../lib/motion-variants';

export default function StaggerChildren({
  children,
  className = '',
  staggerChildren = 0.08,
  delayChildren = 0.1,
  once = true,
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer(staggerChildren, delayChildren)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-60px' }}
      transition={transitionNormal}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '' }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
