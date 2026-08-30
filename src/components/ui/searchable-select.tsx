import { Check, ChevronDown, Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SearchableOption = { value: string; label?: string; description?: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: (string | SearchableOption)[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Allow the user's typed input as a free-form value (for "Other"). */
  allowCustom?: boolean;
  className?: string;
  popoverClassName?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches found.",
  disabled = false,
  allowCustom = false,
  className,
  popoverClassName,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState<number>(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const normalized = React.useMemo<SearchableOption[]>(
    () =>
      options.map((option) =>
        typeof option === "string"
          ? { value: option, label: option }
          : {
              value: option.value,
              label: option.label !== undefined ? option.label : option.value,
              description: option.description,
            },
      ),
    [options],
  );

  const selected = normalized.find((option) => option.value === value);
  const displayLabel = selected?.label ?? (value || placeholder);

  const trimmedQuery = query.trim().toLowerCase();
  const filteredOptions = React.useMemo(() => {
    if (!trimmedQuery) return normalized;
    return normalized.filter((opt) => {
      const label = (opt.label ?? "").toLowerCase();
      const val = (opt.value ?? "").toLowerCase();
      const desc = (opt.description ?? "").toLowerCase();
      return label.includes(trimmedQuery) || val.includes(trimmedQuery) || desc.includes(trimmedQuery);
    });
  }, [normalized, trimmedQuery]);

  const hasExactMatch = normalized.some(
    (opt) =>
      opt.value.toLowerCase() === trimmedQuery ||
      (opt.label && opt.label.toLowerCase() === trimmedQuery),
  );
  const canUseCustom = allowCustom && trimmedQuery.length > 0 && !hasExactMatch;

  // Reset highlight on search change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [trimmedQuery]);

  // Focus input when popover opens
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length ? (prev + 1) % filteredOptions.length : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length ? (prev - 1 + filteredOptions.length) % filteredOptions.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length > 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (canUseCustom) {
        handleSelect(query.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            "group flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--ink)]/15 bg-[color:var(--surface)] px-3.5 py-2 text-left text-sm font-medium text-[color:var(--ink)] shadow-[0_1px_2px_rgba(4,19,68,0.04)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[color:var(--ink)]/30 hover:bg-[color:var(--surface)] focus-visible:border-[#1FA8B6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#77E8EE]/35 disabled:cursor-not-allowed disabled:opacity-50",
            !value && !selected?.label && "text-[color:var(--ink)]/50",
            className,
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[color:var(--ink)]/50 transition-transform duration-200",
              open && "rotate-180 text-[color:var(--ink)]",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-(--radix-popover-trigger-width) min-w-[220px] p-0 shadow-[0_20px_45px_-18px_rgba(4,19,68,0.25)] backdrop-blur-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] text-[color:var(--ink)] z-[9999]",
          popoverClassName,
        )}
      >
        <div className="p-2 border-b border-[color:var(--ink)]/10">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-4 w-4 text-[color:var(--ink)]/40 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 w-full rounded-md border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] pl-8 pr-8 text-xs font-medium text-[color:var(--ink)] placeholder:text-[color:var(--ink)]/40 outline-none focus:border-[#1FA8B6] focus:bg-[color:var(--surface)] focus:ring-2 focus:ring-[#77E8EE]/20 transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 p-0.5 rounded text-[color:var(--ink)]/40 hover:text-[color:var(--ink)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div ref={listRef} className="max-h-60 overflow-y-auto p-1 text-sm">
          {filteredOptions.length === 0 && !canUseCustom && (
            <div className="py-4 text-center text-xs text-muted-foreground">{emptyText}</div>
          )}

          {filteredOptions.map((option, idx) => {
            const isSelected = value === option.value;
            const isHighlighted = highlightedIndex === idx;
            return (
              <button
                key={`${option.value}-${idx}`}
                type="button"
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-xs font-medium text-[color:var(--ink)] transition-colors",
                  isHighlighted ? "bg-[#77E8EE]/20" : "hover:bg-[color:var(--surface-subtle)]",
                  isSelected && "font-semibold text-[#156B73]",
                )}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="truncate">{option.label || "(Empty)"}</span>
                  {option.description ? (
                    <span className="truncate text-[11px] text-muted-foreground font-normal">
                      {option.description}
                    </span>
                  ) : null}
                </div>
                {isSelected && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-[#1FA8B6]" strokeWidth={2.5} />
                )}
              </button>
            );
          })}

          {canUseCustom && (
            <div className="border-t border-[color:var(--ink)]/10 mt-1 pt-1">
              <button
                type="button"
                onClick={() => handleSelect(query.trim())}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold text-[#1FA8B6] hover:bg-[#77E8EE]/20 text-left"
              >
                <span>Add &ldquo;{query.trim()}&rdquo;</span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Custom</span>
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
