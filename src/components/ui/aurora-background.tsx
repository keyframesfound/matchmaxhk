"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type AuroraBackgroundProps = {
  children?: ReactNode;
  className?: string;
  layerClassName?: string;
};

const AURORA_LIGHT =
  "repeating-linear-gradient(100deg, rgba(29,155,240,0.16) 10%, rgba(142,205,248,0.22) 20%, rgba(185,229,255,0.18) 30%, rgba(227,236,246,0.16) 40%, rgba(29,155,240,0.16) 50%)";
const AURORA_DARK =
  "repeating-linear-gradient(100deg, color-mix(in oklab, #1d9bf0 30%, #000000) 10%, rgba(29,155,240,0.34) 20%, rgba(142,205,248,0.22) 30%, rgba(6,22,34,0.9) 40%, color-mix(in oklab, #1d9bf0 30%, #000000) 50%)";

export function AuroraBackground({ children, className, layerClassName }: AuroraBackgroundProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <motion.div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 z-0 h-full w-full scale-[2] transform-gpu [background-image:var(--aurora)] [background-size:200%_200%] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_78%)] dark:hidden",
          layerClassName,
        )}
        style={
          {
            "--aurora": AURORA_LIGHT,
          } as React.CSSProperties
        }
        initial={reducedMotion ? false : { backgroundPosition: "0% 50%" }}
        animate={
          reducedMotion ? undefined : { backgroundPosition: ["0% 50%", "200% 50%", "0% 50%"] }
        }
        transition={
          reducedMotion
            ? undefined
            : { duration: 18, ease: "linear", repeat: Infinity, repeatType: "mirror" }
        }
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 hidden dark:block"
        style={{ ["--aurora" as string]: AURORA_DARK }}
      >
        <motion.div
          className="absolute inset-0 h-full w-full scale-[2] transform-gpu [background-image:var(--aurora)] [background-size:200%_200%] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_78%)]"
          initial={reducedMotion ? false : { backgroundPosition: "0% 50%" }}
          animate={
            reducedMotion ? undefined : { backgroundPosition: ["0% 50%", "200% 50%", "0% 50%"] }
          }
          transition={
            reducedMotion
              ? undefined
              : { duration: 18, ease: "linear", repeat: Infinity, repeatType: "mirror" }
          }
        />
      </div>
      {children}
    </div>
  );
}
