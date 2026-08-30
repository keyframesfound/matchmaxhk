import { Check, ChevronDown, Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

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

  const normalized = React.useMemo<SearchableOption[]>(
    () =>
      options.map((option) =>
        typeof option === "string"
          ? { value: option, label: option }
          : { value: option.value, label: option.label ?? option.value, description: option.description },
      ),
    [options],
  );

  const selected = normalized.find((option) => option.value === value);
  const displayLabel = selected?.label ?? (value || placeholder);

  const trimmedQuery = query.trim();
  const hasExactMatch = normalized.some(
    (opt) =>
      opt.value.toLowerCase() === trimmedQuery.toLowerCase() ||
      (opt.label && opt.label.toLowerCase() === trimmedQuery.toLowerCase()),
  );
  const canUseCustom = allowCustom && trimmedQuery.length > 0 && !hasExactMatch;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            "group flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--ink)]/15 bg-[color:var(--surface)] px-3.5 py-2 text-left text-sm font-medium text-[color:var(--ink)] shadow-[0_1px_2px_rgba(4,19,68,0.04)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[color:var(--ink)]/30 hover:bg-[color:var(--surface)] focus-visible:border-[#1FA8B6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#77E8EE]/35 disabled:cursor-not-allowed disabled:opacity-50",
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
          "w-(--radix-popover-trigger-width) min-w-[220px] p-0 shadow-[0_20px_45px_-18px_rgba(4,19,68,0.25)] backdrop-blur-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] text-[color:var(--ink)] z-[9999]",
          popoverClassName,
        )}
      >
        <Command
          className="w-full"
          shouldFilter={true}
          filter={(itemValue, search) => {
            if (!search) return 1;
            const searchLower = search.toLowerCase();
            const option = normalized.find((o) => o.value === itemValue);
            if (!option) {
              return itemValue.toLowerCase().includes(searchLower) ? 1 : 0;
            }
            const matchString = `${option.label ?? ""} ${option.value} ${option.description ?? ""}`.toLowerCase();
            return matchString.includes(searchLower) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
            className="h-10 text-sm"
          />
          <CommandList className="max-h-60 overflow-y-auto p-1">
            <CommandEmpty className="py-4 text-center text-sm text-[color:var(--ink)]/60">
              {canUseCustom ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange(trimmedQuery);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1FA8B6] hover:underline"
                >
                  Use &ldquo;{trimmedQuery}&rdquo;
                </button>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              {normalized.map((option) => {
                const isSelected = value === option.value;
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-[color:var(--ink)] transition-colors hover:bg-[#77E8EE]/20 aria-selected:bg-[#77E8EE]/25",
                      isSelected && "font-semibold text-[color:var(--ink)]",
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate">{option.label}</span>
                      {option.description ? (
                        <span className="truncate text-xs text-[color:var(--ink)]/55 font-normal">
                          {option.description}
                        </span>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-[#1FA8B6]" strokeWidth={2.5} />
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {canUseCustom && (
              <div className="border-t border-[color:var(--ink)]/10 pt-1 pb-0.5 px-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange(trimmedQuery);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold text-[#1FA8B6] hover:bg-[#77E8EE]/20 text-left"
                >
                  <span>Custom: &ldquo;{trimmedQuery}&rdquo;</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Add</span>
                </button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
