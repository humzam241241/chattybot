/**
 * Shared animation variants — Minimal Intelligence.
 * All animations communicate value; avoid decorative motion.
 * Respect prefers-reduced-motion via Framer's reducedMotion.
 */

const easeSmooth = [0.25, 0.4, 0.25, 1];
const durationFast = 0.22;
const durationNormal = 0.35;
const durationSlow = 0.5;

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

export const slideUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
};

export const slideUpStiff = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0.12) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export const transitionFast = {
  duration: durationFast,
  ease: easeSmooth,
};

export const transitionNormal = {
  duration: durationNormal,
  ease: easeSmooth,
};

export const transitionSlow = {
  duration: durationSlow,
  ease: easeSmooth,
};

export const transitionSpring = {
  type: 'spring',
  stiffness: 400,
  damping: 28,
};

export const hoverGlow = {
  rest: { boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)' },
  hover: {
    boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)',
    transition: transitionNormal,
  },
};

export const hoverLift = {
  rest: { y: 0 },
  hover: { y: -2 },
};

export const messageReveal = {
  hidden: { opacity: 0, y: 6, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.28, ease: easeSmooth },
};

export const typingDots = {
  animate: (i) => ({
    y: [0, -5, 0],
    transition: {
      duration: 0.5,
      repeat: Infinity,
      delay: i * 0.14,
    },
  }),
};
