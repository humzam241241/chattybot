'use client';

import { motion } from 'framer-motion';
import { scaleIn, transitionNormal } from '../../lib/motion-variants';

export default function ScaleIn({ children, className = '', delay = 0, once = true }) {
  return (
    <motion.div
      className={className}
      variants={scaleIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-40px' }}
      transition={{ ...transitionNormal, delay }}
    >
      {children}
    </motion.div>
  );
}
