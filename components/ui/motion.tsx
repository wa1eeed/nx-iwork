'use client';

import { animate, motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatNumber } from '@/lib/format';

// Tasteful, spring-based motion primitives. Used across the dashboard so it feels
// alive and premium without being distracting. All respect prefers-reduced-motion
// (Framer Motion reads it automatically).

const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const;

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggers its direct children on mount (each child should be a <MotionItem>).
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      transition={SPRING}
    >
      {children}
    </motion.div>
  );
}

// Lifts gently on hover — wrap interactive cards/tiles for a tactile feel.
export function HoverLift({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
    >
      {children}
    </motion.div>
  );
}

// Page-level entrance for dashboard content.
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Counts up to `value` the first time it scrolls into view. Locale-aware.
export function AnimatedCounter({
  value,
  className,
  locale = 'en',
}: {
  value: number;
  className?: string;
  locale?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref} className={className}>
      {formatNumber(display, locale)}
    </span>
  );
}
