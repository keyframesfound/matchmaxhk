import { Search } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchBigInput, SearchableOptionsPanel, type OptionRow } from "./search-controls";

export type PillSegment = {
  id: string;
  /** Small bold label above the value ("Where", "Who"…). */
  label: string;
  /** Big panel heading; omitted panels open straight into content. */
  title?: string;
  /** Value shown in the bar; muted when not filled. */
  display: string;
  filled?: boolean;
  /** Tailwind flex sizing class; defaults to flex-1. */
  grow?: string;
  panelClassName?: string;
  /** Current selection (drives the check mark in options panels). */
  currentValue?: string;
  /** Simple selectable list panel. */
  options?: OptionRow[];
  searchPlaceholder?: string;
  emptyText?: string;
  showAnyOption?: boolean;
  onSelect?: (value: string) => void;
  /** Custom panel content; overrides options. */
  content?: ReactNode;
};

type SearchPillBarProps = {
  segments: PillSegment[];
  submitLabel: string;
  submitColor?: "neutral" | "blue";
  onSubmit: () => void;
  className?: string;
};

/**
 * Desktop Airbnb-style segmented search pill. Each segment opens a popover
 * panel; the circular azure button submits. Flat by design — hairline borders
 * and hover washes instead of shadows.
 */
export function SearchPillBar({
  segments,
  submitLabel,
  submitColor = "neutral",
  onSubmit,
  className,
}: SearchPillBarProps) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
    setOpenId(null);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-center gap-1 rounded-full border border-border bg-card p-1.5",
        className,
      )}
    >
      {segments.map((segment, index) => (
        <Popover
          key={segment.id}
          open={openId === segment.id}
          onOpenChange={(open) => setOpenId(open ? segment.id : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-expanded={openId === segment.id}
              className={cn(
                "flex min-w-0 flex-col justify-center gap-0.5 rounded-full px-4 py-1.5 text-left transition-colors hover:bg-[color:var(--foreground)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-5",
                index > 0 && "border-l border-border",
                segment.grow ?? "flex-1",
                openId === segment.id && "bg-[color:var(--foreground)]/[0.06]",
              )}
            >
              <span className="truncate text-[11px] font-bold tracking-wide text-[color:var(--ink)]">
                {segment.label}
              </span>
              <span
                className={cn(
                  "truncate text-sm",
                  segment.filled
                    ? "font-semibold text-[color:var(--ink)]"
                    : "text-muted-foreground",
                )}
              >
                {segment.display}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={10}
            className={cn(
              "z-[9999] w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-4",
              segment.panelClassName,
            )}
          >
            {segment.title ? (
              <p className="mb-3 text-xl font-bold tracking-tight text-[color:var(--ink)]">
                {segment.title}
              </p>
            ) : null}
            {segment.content ?? (
              <SearchableOptionsPanel
                options={segment.options ?? []}
                currentValue={segment.currentValue}
                onSelect={(value) => {
                  segment.onSelect?.(value);
                  setOpenId(null);
                }}
                searchPlaceholder={segment.searchPlaceholder}
                emptyText={segment.emptyText}
                showAnyOption={segment.showAnyOption ?? true}
                anyLabel={t("search_ui.any_value")}
              />
            )}
          </PopoverContent>
        </Popover>
      ))}
      <Button
        type="submit"
        variant="solid"
        color={submitColor}
        shape="pill"
        aria-label={submitLabel}
        className="ml-1 h-11 w-11 shrink-0 rounded-full p-0"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  );
}

/** Keyword segment panel: big input bound to the live draft query. */
export function KeywordPanelContent({
  value,
  onValueChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
}) {
  return (
    <SearchBigInput
      autoFocus
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
    />
  );
}
