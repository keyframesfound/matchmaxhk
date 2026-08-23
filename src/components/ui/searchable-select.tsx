/** MatchMax selector system: searchable, anchored overlays with concise motion and visible selection confirmation. */
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchableOption = { value: string; label?: string };

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
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  disabled = false,
  allowCustom = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized: SearchableOption[] = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value },
  );
  const selected = normalized.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value || placeholder);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            className,
            "group h-11 w-full justify-between rounded-xl border-[#041344]/15 bg-white/95 px-3.5 text-left font-semibold text-[#041344] shadow-[0_1px_2px_rgba(4,19,68,0.04)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[#0A245F]/35 hover:bg-white focus-visible:border-[#1FA8B6] focus-visible:ring-4 focus-visible:ring-[#77E8EE]/35",
            !value && "text-[#041344]/50",
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            className={cn(
              "ml-2 h-4 w-4 shrink-0 text-[#041344]/55 transition-transform duration-200",
              open && "rotate-180 text-[#0A245F]",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] overflow-hidden rounded-xl border border-[#041344]/10 bg-white/[0.96] p-0 text-[#041344] shadow-[0_20px_45px_-18px_rgba(4,19,68,0.28)] backdrop-blur-xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
        align="start"
        sideOffset={4}
        collisionPadding={8}
      >
        <Command shouldFilter className="bg-transparent text-[#041344]">
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList className="max-h-64 overflow-y-auto p-1.5">
            <CommandEmpty>
              {allowCustom && query.trim() ? (
                <button
                  type="button"
                  className="m-1 w-[calc(100%-0.5rem)] rounded-lg bg-[#F7FBFC] px-3 py-2.5 text-left text-sm font-medium text-[#041344] transition-colors hover:bg-[#77E8EE]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FA8B6]"
                  onClick={() => {
                    onChange(query.trim());
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  Use “{query.trim()}”
                </button>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              {normalized.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check
                    className={cn(
                      "ml-auto order-2 h-5 w-5 rounded-full bg-[#0A245F] p-1 text-white transition-opacity",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
