import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

import { cn } from "@/lib/utils";

type NumberTickerProps = {
  target: number;
  from?: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

export function NumberTicker({
  target,
  from = 0,
  duration = 2,
  delay = 0,
  prefix,
  suffix,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reducedMotion = useReducedMotion();
  const count = useMotionValue(target);
  const display = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  useEffect(() => {
    if (reducedMotion || !inView) return;
    const controls = animate(count, target, {
      from,
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [count, delay, duration, from, inView, reducedMotion, target]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}
