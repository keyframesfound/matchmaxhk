import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ToggleProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  size?: "sm" | "default";
};

const Toggle = React.forwardRef<React.ElementRef<typeof SwitchPrimitives.Root>, ToggleProps>(
  (
    { className, id, label, hint, size = "default", "aria-describedby": ariaDescribedBy, ...props },
    ref,
  ) => {
    const generatedId = React.useId();
    const toggleId = id ?? generatedId;
    const hintId = hint ? `${toggleId}-hint` : undefined;
    const describedBy = [ariaDescribedBy, hintId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        {label || hint ? (
          <div className="min-w-0 space-y-0.5">
            {label ? (
              <Label
                htmlFor={toggleId}
                className={cn(
                  "cursor-pointer font-bold text-foreground",
                  size === "sm" ? "text-xs" : "text-sm",
                )}
              >
                {label}
              </Label>
            ) : null}
            {hint ? (
              <p
                id={hintId}
                className={cn(
                  "leading-relaxed text-muted-foreground",
                  size === "sm" ? "text-[11px]" : "text-xs",
                )}
              >
                {hint}
              </p>
            ) : null}
          </div>
        ) : null}
        <SwitchPrimitives.Root
          {...props}
          id={toggleId}
          ref={ref}
          aria-describedby={describedBy}
          className={cn(
            "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
            size === "sm" ? "h-4 w-7" : "h-5 w-9",
          )}
        >
          <SwitchPrimitives.Thumb
            className={cn(
              "pointer-events-none block translate-x-0 rounded-full bg-background shadow-lg ring-0 transition-transform",
              size === "sm"
                ? "h-3 w-3 data-[state=checked]:translate-x-[12px]"
                : "h-4 w-4 data-[state=checked]:translate-x-4",
            )}
          />
        </SwitchPrimitives.Root>
      </div>
    );
  },
);
Toggle.displayName = "Toggle";

export { Toggle };
