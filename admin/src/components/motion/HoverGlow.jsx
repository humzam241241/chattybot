'use client';

import { motion } from 'framer-motion';
import { hoverGlow } from '../../lib/motion-variants';

export default function HoverGlow({ children, className = '', as: Component = 'div' }) {
  const MotionComponent = motion[Component] ?? motion.div;
  return (
    <MotionComponent
      className={className}
      initial="rest"
      whileHover="hover"
      variants={hoverGlow}
    >
      {children}
    </MotionComponent>
  );
}
