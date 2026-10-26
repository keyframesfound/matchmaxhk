"use client";

import * as React from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  /** Current rating, 0–5. 0 means not rated. */
  value: number;
  onChange?: (v: number) => void;
  /** Accessible name: group label when interactive, image label when read-only. */
  label?: string;
  /** Star size in px. */
  size?: number;
  readOnly?: boolean;
  className?: string;
};

const STEPS = [1, 2, 3, 4, 5];

/** Shared star row for display and input: radio-group semantics, keyboard
 * steps, hover preview, and the same press-dip control language as the
 * checkbox/radio primitives. */
export function StarRating({
  value,
  onChange,
  label,
  size = 20,
  readOnly = false,
  className,
}: Props) {
  const [hover, setHover] = React.useState(0);
  const shown = Math.round(hover || value);
  const interactive = !readOnly && onChange !== undefined;
  const starRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  if (readOnly) {
    return (
      <span
        role="img"
        aria-label={label ?? `${Math.round(value)} / 5`}
        className={cn("inline-flex items-center gap-0.5", className)}
      >
        {STEPS.map((n) => (
          <Star
            key={n}
            style={{ width: size, height: size }}
            strokeWidth={1.5}
            aria-hidden="true"
            className={cn(
              "transition-colors duration-150 motion-reduce:transition-none",
              n <= Math.round(value)
                ? "fill-[color:var(--brand-link)] text-[color:var(--brand-link)]"
                : "text-border",
            )}
          />
        ))}
      </span>
    );
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!interactive) return;
    const current = Math.max(Math.round(value), 1);
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = Math.min(5, current + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = Math.max(1, current - 1);
        break;
      case "Home":
        next = 1;
        break;
      case "End":
        next = 5;
        break;
      default:
        if (/^[1-5]$/.test(event.key)) next = Number(event.key);
    }
    if (next === null) return;
    event.preventDefault();
    onChange?.(next);
    starRefs.current[next - 1]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5", className)}
      onKeyDown={handleKeyDown}
      onPointerLeave={() => setHover(0)}
    >
      {STEPS.map((n) => {
        const filled = n <= shown;
        const checked = Math.round(value) === n;
        const isTabStop = checked || (value === 0 && n === 1);
        return (
          <button
            key={n}
            ref={(el) => {
              starRefs.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={`${label ? `${label} ` : ""}${n} / 5`}
            tabIndex={isTabStop ? 0 : -1}
            onClick={() => onChange?.(n)}
            onPointerEnter={() => setHover(n)}
            className={cn(
              "cursor-pointer rounded-sm text-border transition-[color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100",
              filled && "text-[color:var(--brand-link)]",
            )}
          >
            <Star
              style={{ width: size, height: size }}
              strokeWidth={1.5}
              aria-hidden="true"
              className={cn(
                "transition-colors duration-150 motion-reduce:transition-none",
                filled && "fill-[color:var(--brand-link)]",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
