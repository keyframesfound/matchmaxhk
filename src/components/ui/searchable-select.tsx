import { Check, ChevronDown, Search, X } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
  invalid?: boolean;
  className?: string;
  popoverClassName?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText,
  disabled = false,
  allowCustom = false,
  invalid = false,
  className,
  popoverClassName,
}: Props) {
  const { t } = useTranslation();
  const emptyLabel = emptyText ?? t("search_panel.no_matches");
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
      return (
        label.includes(trimmedQuery) || val.includes(trimmedQuery) || desc.includes(trimmedQuery)
      );
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
          aria-invalid={invalid || undefined}
          className={cn(
            "group flex h-11 w-full items-center justify-between gap-2 rounded-md border border-[color:var(--ink)]/15 bg-[color:var(--surface)] px-3.5 py-2 text-left text-sm font-medium text-[color:var(--ink)] shadow-[0_1px_2px_rgba(4,19,68,0.04)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[color:var(--ink)]/30 hover:bg-[color:var(--surface)] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
            invalid &&
              "border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
            !value && "text-[color:var(--ink)]/50",
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
          "z-[9999] w-(--radix-popover-trigger-width) min-w-[220px] border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-0 text-[color:var(--ink)] shadow-[0_20px_45px_-18px_rgba(4,19,68,0.25)]",
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
              aria-label={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 w-full rounded-md border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] pl-8 pr-8 text-base font-medium text-[color:var(--ink)] placeholder:text-muted-foreground transition-[border-color,background-color,box-shadow] focus:border-ring focus:bg-[color:var(--surface)] focus:outline-none focus:ring-2 focus:ring-ring/40 sm:text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("search_panel.clear_search")}
                className="absolute right-2 p-0.5 rounded text-[color:var(--ink)]/40 hover:text-[color:var(--ink)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div ref={listRef} className="max-h-60 overflow-y-auto p-1 text-sm">
          {filteredOptions.length === 0 && !canUseCustom && (
            <div className="py-4 text-center text-xs text-muted-foreground">{emptyLabel}</div>
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
                  "flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-[color:var(--ink)] transition-colors",
                  isHighlighted
                    ? "bg-[color:var(--ring)]/[0.08]"
                    : "hover:bg-[color:var(--surface-subtle)]",
                  isSelected && "font-semibold",
                )}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="truncate">{option.label || "(Empty)"}</span>
                  {option.description ? (
                    <span className="truncate text-xs text-muted-foreground font-normal">
                      {option.description}
                    </span>
                  ) : null}
                </div>
                {isSelected && (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-[color:var(--ring)]"
                    strokeWidth={2.5}
                  />
                )}
              </button>
            );
          })}

          {canUseCustom && (
            <div className="border-t border-[color:var(--ink)]/10 mt-1 pt-1">
              <button
                type="button"
                onClick={() => handleSelect(query.trim())}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold text-[color:var(--brand-link)] hover:bg-[color:var(--foreground)]/[0.06] text-left"
              >
                <span>Add &ldquo;{query.trim()}&rdquo;</span>
                <span className="text-xs uppercase font-bold text-muted-foreground">Custom</span>
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
