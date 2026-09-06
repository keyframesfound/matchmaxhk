import * as React from "react";
import { Info } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  tooltip?: React.ReactNode;
  isRequired?: boolean;
  isInvalid?: boolean;
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      id,
      label,
      hint,
      tooltip,
      isRequired,
      isInvalid,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const describedBy = [ariaDescribedBy, hintId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="grid gap-1.5">
        {label ? (
          <div className="flex items-center gap-1.5">
            <Label htmlFor={inputId} className="font-semibold text-foreground">
              {label}
              {isRequired ? <span className="ml-1 text-destructive">*</span> : null}
            </Label>
            {tooltip ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`More information about ${String(label)}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
        ) : null}
        <input
          {...props}
          id={inputId}
          ref={ref}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          aria-required={isRequired || undefined}
          className={cn(
            "flex h-11 w-full rounded-[var(--radius-control)] border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-[border-color,box-shadow] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
            isInvalid &&
              "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40",
            className,
          )}
        />
        {hint ? (
          <p
            id={hintId}
            className={cn(
              "text-xs leading-relaxed",
              isInvalid ? "font-medium text-destructive" : "italic text-muted-foreground",
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
