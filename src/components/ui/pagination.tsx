"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/*
 * Arc pagination pattern: prev/next around a fixed five-page window, with
 * the current-page mark springing to its button via a shared layoutId (the
 * same glide as the tabs pill). Fully controlled; label props default to
 * English and can be overridden for translated surfaces.
 */

type PaginationProps = Omit<React.HTMLAttributes<HTMLElement>, "onAnimationStart"> & {
  /** Current page, 1-based. Clamped to the range. */
  page: number;
  /** Total pages. Fewer than 1 renders nothing. */
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Accessible name for the nav landmark. */
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  pageLabel?: (page: number) => string;
};

export function Pagination({
  page,
  pageCount,
  onPageChange,
  label = "Pagination",
  previousLabel = "Previous page",
  nextLabel = "Next page",
  pageLabel = (n: number) => `Page ${n}`,
  className,
  ...props
}: PaginationProps) {
  const layoutId = React.useId();
  const shouldReduceMotion = useReducedMotion();

  if (pageCount < 1) return null;
  const current = Math.min(Math.max(1, Math.round(page)), pageCount);
  const start = Math.min(Math.max(1, current - 2), Math.max(1, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav
      role="navigation"
      aria-label={label}
      className={cn("flex w-full flex-wrap items-center justify-center gap-1", className)}
      {...props}
    >
      <button
        type="button"
        onClick={() => onPageChange(current - 1)}
        disabled={current <= 1}
        aria-label={previousLabel}
        className="grid h-9 w-9 cursor-pointer place-items-center rounded-md text-[color:var(--ink)] outline-none transition-colors duration-150 hover:bg-[color:var(--foreground)]/[0.06] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      {pages.map((n) => {
        const isCurrent = n === current;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            aria-label={pageLabel(n)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "relative grid h-9 min-w-9 cursor-pointer place-items-center rounded-md px-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 motion-reduce:transition-none",
              isCurrent
                ? "font-medium text-[color:var(--surface-invert-fg)]"
                : "text-[color:var(--ink)] hover:bg-[color:var(--foreground)]/[0.06]",
            )}
          >
            {isCurrent ? (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-md bg-[color:var(--surface-invert)]"
                initial={false}
                layoutId={layoutId}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 32 }
                }
              />
            ) : null}
            <span className="relative">{n}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onPageChange(current + 1)}
        disabled={current >= pageCount}
        aria-label={nextLabel}
        className="grid h-9 w-9 cursor-pointer place-items-center rounded-md text-[color:var(--ink)] outline-none transition-colors duration-150 hover:bg-[color:var(--foreground)]/[0.06] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
