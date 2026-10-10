import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Issue #187: multi-select subject chips for the tutor search. Selected
 * subjects are AND-ed by the directory (a tutor must teach every pick), so
 * this is a plain toggle-chip list rather than a single-value select.
 */
export function SubjectMultiSelect({
  options,
  selected,
  onToggle,
  onClear,
  clearLabel,
  className,
}: {
  options: string[];
  selected: string[];
  onToggle: (subject: string) => void;
  onClear: () => void;
  clearLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {options.map((subject) => {
          const isSelected = selected.includes(subject);
          return (
            <button
              key={subject}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => onToggle(subject)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40",
                isSelected
                  ? "border-[color:var(--brand-royal)] bg-[color:var(--brand-royal)]/10 font-semibold text-[color:var(--ink)]"
                  : "border-border bg-card text-muted-foreground hover:border-[color:var(--brand-royal)]/50 hover:text-[color:var(--ink)]",
              )}
            >
              {subject}
            </button>
          );
        })}
      </div>
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--ink)]/[0.07] pt-2">
          <span className="text-xs font-semibold text-[color:var(--ink)]/70">
            {selected.join(" + ")}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-[color:var(--ink)]/30 hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            {clearLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
