'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

export default function SpotlightCursor({ children, className = '', containerRef }) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [mounted, setMounted] = useState(false);
  const innerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const el = containerRef?.current ?? innerRef?.current;
    if (!el) return;
    const handleMove = (e) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPosition({ x, y });
    };
    if (el) {
      el.addEventListener('mousemove', handleMove);
      return () => el.removeEventListener('mousemove', handleMove);
    }
  }, [containerRef]);

  return (
    <div ref={innerRef} className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      {mounted && (
        <motion.div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${position.x}%`,
            top: `${position.y}%`,
            width: 400,
            height: 400,
            marginLeft: -200,
            marginTop: -200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 65%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
