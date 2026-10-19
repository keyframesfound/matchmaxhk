import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Section-level entrance: a one-time 12px rise + fade as the section enters
 * the viewport. Deliberately coarse-grained — wrap whole sections, never
 * individual cards, so the page reads as settling into place rather than
 * performing. Fully disabled under prefers-reduced-motion (renders a plain
 * div, mirroring the blur-highlight reveal's reduced-motion contract).
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Extra delay in seconds — stagger siblings sparingly (<= 0.12). */
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
