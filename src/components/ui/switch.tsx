import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-[color:var(--ink)]/15 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:bg-primary data-[state=unchecked]:bg-input motion-reduce:transition-none",
      className,
    )}
    {...props}
    ref={ref}
  >
    {/*
     * Thumb fill uses explicit surface tokens, the raw `bg-background`
     * utility is forced transparent by styles.css, which rendered the knob
     * invisible. Press feedback stretches the knob (scale-x) the way a
     * physical switch gives before it commits.
     */}
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full bg-[color:var(--surface)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0 active:scale-x-110 dark:bg-[color:var(--surface-invert)] motion-reduce:transition-none motion-reduce:active:scale-x-100",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
