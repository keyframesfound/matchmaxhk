import { Plus, Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type TagOption = {
  value: string;
  label?: string;
  category?: string;
};

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: (string | TagOption)[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowCustom?: boolean;
  maxTags?: number;
  className?: string;
  disabled?: boolean;
}

export function TagInput({
  value = [],
  onChange,
  suggestions = [],
  placeholder = "Add tags…",
  searchPlaceholder = "Type to search or add…",
  emptyText = "No matching suggestions.",
  allowCustom = true,
  maxTags,
  className,
  disabled = false,
}: TagInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const normalizedSuggestions = React.useMemo<TagOption[]>(
    () =>
      suggestions.map((item) =>
        typeof item === "string"
          ? { value: item, label: item }
          : { value: item.value, label: item.label ?? item.value, category: item.category },
      ),
    [suggestions],
  );

  const availableSuggestions = React.useMemo(
    () => normalizedSuggestions.filter((item) => !value.includes(item.value)),
    [normalizedSuggestions, value],
  );

  const filteredSuggestions = React.useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return availableSuggestions;
    return availableSuggestions.filter(
      (opt) =>
        (opt.label ?? "").toLowerCase().includes(q) ||
        (opt.value ?? "").toLowerCase().includes(q) ||
        (opt.category ?? "").toLowerCase().includes(q),
    );
  }, [availableSuggestions, inputValue]);

  const addTag = React.useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      if (maxTags && value.length >= maxTags) return;
      if (value.includes(trimmed)) {
        setInputValue("");
        return;
      }
      onChange([...value, trimmed]);
      setInputValue("");
    },
    [maxTags, onChange, value],
  );

  const removeTag = React.useCallback(
    (tagToRemove: string) => {
      onChange(value.filter((tag) => tag !== tagToRemove));
    },
    [onChange, value],
  );

  const trimmedInput = inputValue.trim();
  const canAddCustom =
    allowCustom &&
    trimmedInput.length > 0 &&
    !value.includes(trimmedInput) &&
    !normalizedSuggestions.some(
      (opt) =>
        opt.value.toLowerCase() === trimmedInput.toLowerCase() ||
        (opt.label && opt.label.toLowerCase() === trimmedInput.toLowerCase()),
    );

  const isAtMax = Boolean(maxTags && value.length >= maxTags);

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open && !disabled && !isAtMax} onOpenChange={setOpen}>
        <div
          onClick={() => {
            if (!disabled && !isAtMax) {
              setOpen(true);
              inputRef.current?.focus();
            }
          }}
          className={cn(
            "flex min-h-[44px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-[color:var(--ink)]/15 bg-[color:var(--surface)] p-1.5 text-sm transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[#1FA8B6] focus-within:ring-4 focus-within:ring-[#77E8EE]/35",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {value.map((tag) => {
            const match = normalizedSuggestions.find((s) => s.value === tag);
            const label = match?.label ?? tag;
            return (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-[color:var(--ink)]/[0.07] px-2.5 py-1 text-xs font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--ink)]/[0.12]"
              >
                <span>{label}</span>
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(tag);
                    }}
                    className="rounded-full p-0.5 text-[color:var(--ink)]/50 hover:bg-[color:var(--ink)]/15 hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })}

          {!isAtMax && (
            <PopoverTrigger asChild>
              <input
                ref={inputRef}
                type="text"
                disabled={disabled}
                placeholder={value.length === 0 ? placeholder : "Add more…"}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (!open) setOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && trimmedInput) {
                    e.preventDefault();
                    addTag(trimmedInput);
                  } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
                    removeTag(value[value.length - 1]);
                  }
                }}
                className="min-w-[120px] flex-1 bg-transparent px-2 py-1 text-sm font-medium text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink)]/40"
              />
            </PopoverTrigger>
          )}
        </div>

        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-[240px] p-0 shadow-[0_20px_45px_-18px_rgba(4,19,68,0.25)] backdrop-blur-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] text-[color:var(--ink)] z-[9999]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="max-h-56 overflow-y-auto p-1 text-xs">
            {filteredSuggestions.length === 0 && !canAddCustom && (
              <div className="py-3 text-center text-xs text-muted-foreground">{emptyText}</div>
            )}

            {filteredSuggestions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  addTag(option.value);
                }}
                className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium text-[color:var(--ink)] transition-colors hover:bg-[#77E8EE]/20 text-left"
              >
                <span>{option.label}</span>
                {option.category && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {option.category}
                  </span>
                )}
              </button>
            ))}

            {canAddCustom && (
              <div className="border-t border-[color:var(--ink)]/10 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    addTag(trimmedInput);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#1FA8B6] hover:bg-[#77E8EE]/20 text-left"
                >
                  <span>Add &ldquo;{trimmedInput}&rdquo;</span>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
