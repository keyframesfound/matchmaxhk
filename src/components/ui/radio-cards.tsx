"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/*
 * Selectable option cards (Arc radio-cards pattern): one selection ring
 * springs from card to card via a shared layoutId — the same glide as the
 * tabs pill — while the group keeps native radio semantics (single tab
 * stop, arrow keys select, aria-checked per card). Resting cards stay
 * flat and border-delineated; the selected card gains a stronger ink
 * border and a wash, never a shadow.
 */

export type RadioCardOption = {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Short trailing text: a price, status, or qualifier. */
  meta?: React.ReactNode;
  disabled?: boolean;
};

type RadioCardsProps = React.HTMLAttributes<HTMLDivElement> & {
  options: RadioCardOption[];
  /** Controlled selected value; null means nothing selected. */
  value: string | null;
  defaultValue?: string | null;
  onValueChange: (value: string) => void;
  /** "grid" tiles in auto-fill columns; "list" stacks full-width rows. */
  layout?: "grid" | "list";
  name?: string;
  disabled?: boolean;
};

export function RadioCards({
  options,
  value,
  defaultValue,
  onValueChange,
  layout = "grid",
  name,
  disabled = false,
  className,
  onKeyDown,
  ...props
}: RadioCardsProps) {
  const layoutId = React.useId();
  const shouldReduceMotion = useReducedMotion();
  const [internal, setInternal] = React.useState<string | null>(defaultValue ?? null);
  const selected = value !== undefined ? value : internal;
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  const enabled = options.filter((option) => !option.disabled && !disabled);
  const firstEnabledIndex = options.findIndex((option) => !option.disabled && !disabled);

  const select = (next: string) => {
    const option = options.find((candidate) => candidate.value === next);
    if (!option || option.disabled || disabled) return;
    onValueChange(next);
    setInternal(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (enabled.length === 0) return;
    const currentIndex = Math.max(
      0,
      enabled.findIndex((option) => option.value === selected),
    );
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % enabled.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = enabled[nextIndex].value;
    select(next);
    const cardIndex = options.findIndex((option) => option.value === next);
    cardRefs.current[cardIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      onKeyDown={handleKeyDown}
      className={cn(
        layout === "grid"
          ? "grid grid-cols-[repeat(auto-fill,minmax(11.25rem,1fr))] gap-3"
          : "flex flex-col gap-2.5",
        className,
      )}
      {...props}
    >
      {name && selected !== null ? <input type="hidden" name={name} value={selected} /> : null}
      {options.map((option, index) => {
        const isSelected = option.value === selected;
        const isTabStop = isSelected || (selected === null && index === firstEnabledIndex);
        const isDisabled = option.disabled || disabled;
        return (
          <div
            key={option.value}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled || undefined}
            tabIndex={isTabStop ? 0 : -1}
            onClick={() => {
              select(option.value);
              cardRefs.current[index]?.focus();
            }}
            className={cn(
              "relative flex cursor-pointer items-start justify-between gap-3 rounded-md border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-4 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 motion-reduce:transition-none",
              isDisabled && "cursor-not-allowed opacity-50",
            )}
          >
            {isSelected ? (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-md border-2 border-[color:var(--ink)]/55 bg-[color:var(--ink)]/[0.04]"
                initial={false}
                layoutId={layoutId}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 32 }
                }
              />
            ) : null}
            <div className="relative min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="leading-relaxed text-[color:var(--ink)]">{option.label}</span>
                {option.meta ? (
                  <span className="shrink-0 font-medium text-[color:var(--ink)]">
                    {option.meta}
                  </span>
                ) : null}
              </div>
              {option.description ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {option.description}
                </p>
              ) : null}
            </div>
            <span
              aria-hidden="true"
              className="relative mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full"
            >
              <span className="absolute h-4 w-4 rounded-full border border-[color:var(--ink)]/25" />
              <motion.span
                className="h-2 w-2 rounded-full bg-[color:var(--ink)]"
                initial={false}
                animate={{ scale: isSelected ? 1 : 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 500, damping: 30 }
                }
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
