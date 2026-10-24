import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/*
 * Check and dash marks share three points, so one path covers both states:
 * the mark draws in on toggle and morphs in place for indeterminate (Arc
 * checkbox pattern) on a snappy, near-critically-damped spring.
 */
const CHECK_PATH = "M4.25 9.25 L7.25 12.25 L13.75 5.75";
const DASH_PATH = "M4.25 9 L9 9 L13.75 9";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, checked, ...props }, ref) => {
  const shouldReduceMotion = useReducedMotion();
  const markPath = checked === "indeterminate" ? DASH_PATH : CHECK_PATH;

  return (
    <CheckboxPrimitive.Root
      ref={ref}
      checked={checked}
      className={cn(
        "peer grid h-4 w-4 shrink-0 place-content-center cursor-pointer rounded-[5px] border border-[color:var(--ink)]/25 bg-transparent transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40 focus-visible:ring-offset-2 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground motion-reduce:transition-none motion-reduce:active:scale-100",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center text-current">
        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 18 18">
          <motion.path
            animate={{ d: markPath, opacity: 1, pathLength: 1 }}
            initial={
              shouldReduceMotion
                ? { d: markPath, opacity: 1, pathLength: 1 }
                : { d: markPath, opacity: 0, pathLength: 0 }
            }
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            transition={
              shouldReduceMotion ? { duration: 0 } : { damping: 30, stiffness: 500, type: "spring" }
            }
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
