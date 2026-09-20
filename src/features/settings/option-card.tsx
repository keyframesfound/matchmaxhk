import type { ReactNode } from "react";

import { ConsolePanel } from "@/components/ui/console-panel";
import { cn } from "@/lib/utils";

/**
 * Card with a fixed header band — the shared chrome for every settings
 * section card (title + description header, content below the divider).
 */
export function SettingsCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ConsolePanel padding="none" className={className}>
      <div className="border-b border-[color:var(--ink)]/10 px-6 py-5 sm:px-8">
        <h2 className="text-lg font-bold text-[color:var(--ink)]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[color:var(--ink)]/65">{description}</p>
        ) : null}
      </div>
      <div className="px-6 py-6 sm:px-8">{children}</div>
    </ConsolePanel>
  );
}

/**
 * Claude-style selectable option card: a bordered tile with a preview area
 * (icon, mockup, anything) plus label and description. Selection is a ring
 * border and ink wash — flat, no shadow.
 */
export function OptionCard({
  selected,
  onSelect,
  label,
  description,
  badge,
  preview,
  disabled,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
  badge?: ReactNode;
  preview?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-[color:var(--ring)] bg-[color:var(--ink)]/5"
          : "border-[color:var(--ink)]/10 hover:bg-[color:var(--ink)]/5",
        className,
      )}
    >
      {preview}
      <span className="flex items-center gap-2 text-sm font-bold text-[color:var(--ink)]">
        {label}
        {badge}
      </span>
      {description ? (
        <span className="text-xs leading-5 text-[color:var(--ink)]/60">{description}</span>
      ) : null}
    </button>
  );
}

/** Radiogroup wrapper laying option cards out on a responsive grid. */
export function OptionCardGroup({
  label,
  children,
  columns = 3,
  className,
}: {
  label: string;
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const columnsClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
        ? "grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-3";
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-3", columnsClass, className)}>
      {children}
    </div>
  );
}
