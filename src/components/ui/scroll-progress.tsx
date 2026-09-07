import { motion, useScroll, useSpring } from "motion/react";

import { cn } from "@/lib/utils";

export function ScrollProgressRail({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 50,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-[#1d9bf0]",
        className,
      )}
      style={{ scaleX }}
    />
  );
}
