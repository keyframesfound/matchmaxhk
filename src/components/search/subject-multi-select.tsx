import { Check, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Issue #187: multi-select subject panel for the tutor search. Same anatomy
 * as SearchableOptionsPanel (search box + check-marked option rows), but rows
 * toggle instead of closing the panel — picks AND together (a tutor must
 * teach every selected subject).
 */
export function SubjectMultiSelect({
  options,
  selected,
  onToggle,
  onClear,
  clearLabel,
  searchPlaceholder,
  emptyText,
  className,
}: {
  options: string[];
  selected: string[];
  onToggle: (subject: string) => void;
  onClear: () => void;
  clearLabel: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalized ? options.filter((option) => option.toLowerCase().includes(normalized)) : options,
    [options, normalized],
  );

  return (
    <div className={cn("space-y-2", className)}>
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
      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {emptyText ?? "No matches found."}
          </div>
        ) : (
          <div className="space-y-0.5 text-sm">
            {filtered.map((option) => {
              const isSelected = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => onToggle(option)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--foreground)]/[0.05]",
                    isSelected && "font-semibold",
                  )}
                >
                  <span className="block truncate text-[15px] font-medium text-[color:var(--ink)]">
                    {option}
                  </span>
                  {isSelected ? (
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
        )}
      </div>
      {selected.length > 0 ? (
        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--ink)]/[0.07] pt-2">
          <span className="truncate text-xs font-semibold text-[color:var(--ink)]/70">
            {selected.join(" + ")}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-[color:var(--ink)]/30 hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            {clearLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
