"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

export function AmountSlider({
  className,
  stops,
  onValueChange,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  stops?: number[];
}) {
  const sortedStops = React.useMemo(
    () => (stops && stops.length ? [...stops].sort((a, b) => a - b) : null),
    [stops],
  );
  const snap = (v: number) => {
    if (!sortedStops) return v;
    let best = sortedStops[0];
    for (const s of sortedStops) {
      if (Math.abs(s - v) < Math.abs(best - v)) best = s;
    }
    return best;
  };
  const handleValueChange = (vals: number[]) => {
    onValueChange?.(sortedStops ? vals.map(snap) : vals);
  };

  return (
    <SliderPrimitive.Root
      data-slot="amount-slider"
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      onValueChange={handleValueChange}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {(Array.isArray(props.value) ? props.value : props.defaultValue ?? [props.min ?? 0]).map(
        (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block size-4 shrink-0 rounded-full border-2 border-primary bg-background shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
        />
        ),
      )}
    </SliderPrimitive.Root>
  );
}

/**
 * The amount itself, one column per digit. A changed digit rolls to its new
 * value instead of cutting, so dragging the slider reads as a counter running
 * up or down. No dependency and no layout shift: every column is one character
 * wide with tabular figures, and reduced motion drops the roll, not the value.
 */
export function AmountReadout({
  value,
  prefix = "$",
  suffix,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: React.ReactNode;
  className?: string;
}) {
  const digits = String(Math.max(0, Math.round(value))).split("");

  return (
    <span
      className={cn(
        "inline-flex items-baseline font-semibold tabular-nums text-foreground",
        className,
      )}
      role="status"
      aria-label={`${prefix}${Math.max(0, Math.round(value))}`}
    >
      {prefix && <span aria-hidden="true">{prefix}</span>}
      {digits.map((digit, index) => (
        <RollingDigit
          // Keyed from the right so a place value keeps its column when the
          // number grows: 9 -> 10 must not re-mount the ones column.
          key={`${digits.length - index}`}
          digit={Number(digit)}
        />
      ))}
      {suffix}
    </span>
  );
}

function RollingDigit({ digit }: { digit: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-block h-[1em] w-[0.62em] overflow-hidden leading-none"
    >
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateY(-${digit}em)` }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((candidate) => (
          <span key={candidate} className="flex h-[1em] items-center justify-center">
            {candidate}
          </span>
        ))}
      </span>
    </span>
  );
}
