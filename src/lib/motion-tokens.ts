import type { Transition } from "motion/react";

/**
 * #713 §2.1 — the single motion vocabulary, taken from DESIGN.md → Motion.
 *
 * React motion (`motion/react`) imports this module. CSS transitions cannot
 * express spring bounce, so `src/styles.css` mirrors the same table as custom
 * properties (`:root`), and Tailwind/CSS consumers read those variables:
 *
 *   spring.smooth  0.40s bounce 0     -> --motion-duration-smooth / --motion-ease-smooth
 *   spring.snappy  0.26s bounce 0.12  -> --motion-duration-snappy / --motion-ease-snappy
 *   spring.morph   0.42s bounce 0.16  -> --motion-duration-morph  / --motion-ease-morph
 *   duration ladder .12/.16/.18/.24/.48s -> --motion-duration-xs|sm|md|lg|xl
 *   colour / opacity fades             -> --motion-ease-fade
 *
 * ONE SOURCE OF TRUTH PER CONSUMER: React motion reads this file, CSS reads the
 * variables. The numbers appear in both places because CSS cannot import
 * TypeScript; `tests/motion/motion-tokens.test.ts` fails if they drift, so a
 * change to the DESIGN.md table lands in BOTH files (module + styles.css).
 *
 * Only compositor-friendly properties (`transform`, `opacity`, `filter`) are
 * animated. Never `width` / `height` / `margin`, and no `filter: blur()` on a
 * large surface (mobile Safari).
 */

/** Springs, for `motion` / `AnimatePresence` transitions. */
export const spring = {
  /** Panels, height, drawers, progress, layout shifts. Never overshoots. */
  smooth: { type: "spring", duration: 0.4, bounce: 0 },
  /** Press feedback, small indicators, icon swaps. */
  snappy: { type: "spring", duration: 0.26, bounce: 0.12 },
  /** Shared highlights (`layoutId`), width that follows new content, shape morphs. */
  morph: { type: "spring", duration: 0.42, bounce: 0.16 },
} as const satisfies Record<string, Transition>;

/**
 * Duration ladder, in seconds (the unit `motion` wants). CSS mirrors these as
 * `--motion-duration-*` in milliseconds. Colour, opacity, and small fades.
 * Exits are faster than entrances: pick a shorter step on the way out.
 */
export const duration = {
  xs: 0.12,
  sm: 0.16,
  md: 0.18,
  lg: 0.24,
  xl: 0.48,
} as const;

/** Cubic-bezier tuple, usable as a `motion` `ease` value or as CSS. */
export type Bezier = [number, number, number, number];

/**
 * One settle curve per spring, for the CSS half of the vocabulary (CSS has no
 * bounce). `smooth` never overshoots — anything that reports a state lands
 * flat; `snappy` / `morph` carry the documented DESIGN.md bounce. `fade` is the
 * neutral curve for colour and opacity.
 */
export const easing: { smooth: Bezier; snappy: Bezier; morph: Bezier; fade: Bezier } = {
  smooth: [0.22, 1, 0.36, 1],
  snappy: [0.34, 1.2, 0.64, 1],
  morph: [0.34, 1.56, 0.64, 1],
  fade: [0.4, 0, 0.2, 1],
};

/**
 * `prefers-reduced-motion: reduce` → land on the final state immediately
 * (no movement, no scale). Feedback, focus, and final state are preserved.
 */
export function withReducedMotion(
  prefersReduced: boolean | null | undefined,
  transition: Transition,
): Transition {
  return prefersReduced ? { duration: 0 } : transition;
}
