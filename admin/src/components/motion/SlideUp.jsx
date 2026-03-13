'use client';

import { motion } from 'framer-motion';
import { slideUp, transitionNormal } from '../../lib/motion-variants';

export default function SlideUp({ children, className = '', delay = 0, once = true }) {
  return (
    <motion.div
      className={className}
      variants={slideUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-50px' }}
      transition={{ ...transitionNormal, delay }}
    >
      {children}
    </motion.div>
  );
}
