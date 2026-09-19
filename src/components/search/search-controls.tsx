import { Check, Search, X } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type OptionRow = {
  value: string;
  label: string;
  description?: string;
};

/**
 * Airbnb-style "Type of place" segmented control. Flat pill track with a solid
 * ink thumb for the active option — elevation comes from contrast, not shadows.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "grid auto-cols-fr grid-flow-col rounded-full border border-border bg-card p-1",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-2 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-3.5",
              active
                ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                : "text-[color:var(--ink)]/65 hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]",
            )}
          >
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Large rounded search input used inside panels and the mobile overlay. */
export function SearchBigInput({
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  onEnter,
  autoFocus = false,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      if (!onEnter) return;
      event.preventDefault();
      onEnter();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-13 w-full rounded-2xl border border-[color:var(--ink)]/20 bg-transparent pl-11 pr-10 text-base font-medium text-[color:var(--ink)] placeholder:font-normal placeholder:text-muted-foreground transition-[border-color,background-color] focus:border-ring focus:bg-[color:var(--surface)] focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => onValueChange("")}
          className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--foreground)]/[0.08] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/15"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/** Check-marked option rows shared by pill panels and selects. */
export function OptionRowsList({
  options,
  value,
  onSelect,
  emptyText,
  className,
}: {
  options: OptionRow[];
  value?: string;
  onSelect: (value: string) => void;
  emptyText?: string;
  className?: string;
}) {
  if (options.length === 0) {
    return (
      <div className={cn("py-4 text-center text-xs text-muted-foreground", className)}>
        {emptyText ?? "No matches found."}
      </div>
    );
  }
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--foreground)]/[0.05]",
              selected && "font-semibold",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium text-[color:var(--ink)]">
                {option.label}
              </span>
              {option.description ? (
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </span>
            {selected ? (
              <Check
                className="h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Airbnb "suggested destinations" row: letter tile + title + hint. */
export function SuggestedRow({
  title,
  hint,
  onClick,
  className,
}: {
  title: string;
  hint?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl p-2 text-left transition-colors hover:bg-[color:var(--foreground)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-[color:var(--surface-subtle)] text-base font-bold text-[color:var(--ink)]">
        {title.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold text-[color:var(--ink)]">
          {title}
        </span>
        {hint ? (
          <span className="block truncate text-sm font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </button>
  );
}

/** Panel section heading, Airbnb "Suggested destinations" style. */
export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm font-bold text-[color:var(--ink)]", className)}>{children}</p>;
}

/** Options panel with an optional search field, shared by pill segments. */
export function SearchableOptionsPanel({
  options,
  currentValue,
  onSelect,
  searchPlaceholder,
  emptyText,
  showAnyOption = true,
  anyLabel = "Any",
  className,
}: {
  options: OptionRow[];
  currentValue?: string;
  onSelect: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  showAnyOption?: boolean;
  anyLabel?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = options.filter(
    (option) =>
      !normalized ||
      option.label.toLowerCase().includes(normalized) ||
      (option.description ?? "").toLowerCase().includes(normalized),
  );
  const rows: OptionRow[] = showAnyOption
    ? [{ value: "", label: anyLabel }, ...filtered]
    : filtered;

  return (
    <div className={className}>
      {searchPlaceholder ? (
        <div className="relative mb-2 flex items-center">
          <Search
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-11 w-full rounded-2xl border border-[color:var(--ink)]/15 bg-[color:var(--surface-subtle)] pl-10 pr-3 text-sm font-medium text-[color:var(--ink)] placeholder:font-normal placeholder:text-muted-foreground transition-[border-color,background-color] focus:border-ring focus:bg-[color:var(--surface)] focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
      ) : null}
      <OptionRowsList
        options={rows}
        value={currentValue ?? ""}
        onSelect={onSelect}
        emptyText={emptyText}
        className="max-h-64 overflow-y-auto"
      />
    </div>
  );
}
