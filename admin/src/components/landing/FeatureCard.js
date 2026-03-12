'use client';

import Tilt from 'react-parallax-tilt';
import { motion } from 'framer-motion';
import ScrollReveal from './ScrollReveal';

export default function FeatureCard({ icon, title, description, style = {} }) {
  return (
    <ScrollReveal delay={0} className="feature-card-wrapper">
      <Tilt
        tiltMaxAngleX={8}
        tiltMaxAngleY={8}
        perspective={800}
        glareEnable
        glareMaxOpacity={0.12}
        glareColor="#6366f1"
        glarePosition="all"
        glareBorderRadius="12px"
        scale={1.01}
        transitionSpeed={1500}
      >
        <motion.div
          className="feature-card"
          style={{
            ...style,
            position: 'relative',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 28,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
          whileHover={{
            boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.25), 0 8px 32px rgba(99, 102, 241, 0.12)',
            borderColor: 'rgba(99, 102, 241, 0.4)',
          }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="feature-icon"
            style={{ fontSize: 28, marginBottom: 14 }}
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {icon}
          </motion.div>
          <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: 'var(--foreground)' }}>{title}</h3>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>{description}</p>
        </motion.div>
      </Tilt>
    </ScrollReveal>
  );
}
