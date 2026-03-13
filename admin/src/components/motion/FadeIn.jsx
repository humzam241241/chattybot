'use client';

import { motion } from 'framer-motion';
import { fadeIn, transitionNormal } from '../../lib/motion-variants';

export default function FadeIn({ children, className = '', delay = 0, once = true }) {
  return (
    <motion.div
      className={className}
      variants={fadeIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-40px' }}
      transition={{ ...transitionNormal, delay }}
    >
      {children}
    </motion.div>
  );
}
