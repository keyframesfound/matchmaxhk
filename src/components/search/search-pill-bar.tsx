import { Search } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchBigInput, SearchableOptionsPanel, type OptionRow } from "./search-controls";

/** Airbnb-style spring used when the active-pill wash slides between segments. */
const HIGHLIGHT_SPRING = { type: "spring", bounce: 0.15, duration: 0.5 } as const;

/** Button box relative to the pill bar (the form is the buttons' offsetParent). */
function readButtonRect(button: HTMLButtonElement) {
  return {
    x: button.offsetLeft,
    y: button.offsetTop,
    width: button.offsetWidth,
    height: button.offsetHeight,
  };
}

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
  /** Controlled open segment id; when provided the bar becomes fully controlled. */
  openSegmentId?: string | null;
  onOpenSegmentIdChange?: (id: string | null) => void;
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
  openSegmentId,
  onOpenSegmentIdChange,
}: SearchPillBarProps) {
  const { t } = useTranslation();
  const [internalOpenId, setInternalOpenId] = useState<string | null>(null);
  const openId = openSegmentId !== undefined ? openSegmentId : internalOpenId;
  const setOpenId = (id: string | null) => {
    setInternalOpenId(id);
    onOpenSegmentIdChange?.(id);
  };
  const prefersReducedMotion = useReducedMotion();
  const formRef = useRef<HTMLFormElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const highlightX = useMotionValue(0);
  const highlightY = useMotionValue(0);
  const highlightWidth = useMotionValue(0);
  const highlightHeight = useMotionValue(0);
  const highlightOpacity = useMotionValue(0);
  const hasHighlight = useRef(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
    setOpenId(null);
  };

  /**
   * Drives the shared highlight: fades in on first open, spring-slides to the
   * newly opened segment on pill-to-pill switches, fades out on close while
   * keeping its last position so the next open starts from a clean fade.
   */
  useEffect(() => {
    const button = openId ? buttonRefs.current.get(openId) : undefined;
    if (!openId || !button) {
      hasHighlight.current = false;
      animate(highlightOpacity, 0, { duration: 0.2 });
      return;
    }
    const rect = readButtonRect(button);
    const snap = !hasHighlight.current || prefersReducedMotion === true;
    hasHighlight.current = true;
    if (snap) {
      highlightX.set(rect.x);
      highlightY.set(rect.y);
      highlightWidth.set(rect.width);
      highlightHeight.set(rect.height);
    } else {
      animate(highlightX, rect.x, HIGHLIGHT_SPRING);
      animate(highlightY, rect.y, HIGHLIGHT_SPRING);
      animate(highlightWidth, rect.width, HIGHLIGHT_SPRING);
      animate(highlightHeight, rect.height, HIGHLIGHT_SPRING);
    }
    animate(highlightOpacity, 1, { duration: 0.2 });
  }, [
    openId,
    prefersReducedMotion,
    highlightX,
    highlightY,
    highlightWidth,
    highlightHeight,
    highlightOpacity,
  ]);

  /** Keep the highlight glued to the open segment across resizes/reflows. */
  useEffect(() => {
    const form = formRef.current;
    const button = openId ? buttonRefs.current.get(openId) : undefined;
    if (!form || !button) return;
    const sync = () => {
      const rect = readButtonRect(button);
      highlightX.set(rect.x);
      highlightY.set(rect.y);
      highlightWidth.set(rect.width);
      highlightHeight.set(rect.height);
    };
    const observer = new ResizeObserver(sync);
    observer.observe(form);
    observer.observe(button);
    return () => observer.disconnect();
  }, [openId, highlightX, highlightY, highlightWidth, highlightHeight]);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={cn(
        "relative flex items-center gap-1 rounded-full border border-border bg-card p-1.5",
        className,
      )}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 rounded-full bg-[color:var(--foreground)]/[0.06]"
        style={{
          x: highlightX,
          y: highlightY,
          width: highlightWidth,
          height: highlightHeight,
          opacity: highlightOpacity,
        }}
      />
      {segments.map((segment, index) => {
        const adjacentActive = openId === segment.id || openId === segments[index - 1]?.id;
        return (
          <Popover
            key={segment.id}
            open={openId === segment.id}
            onOpenChange={(open) => setOpenId(open ? segment.id : null)}
          >
            <PopoverTrigger asChild>
              <button
                ref={(node) => {
                  if (node) buttonRefs.current.set(segment.id, node);
                  else buttonRefs.current.delete(segment.id);
                }}
                type="button"
                aria-expanded={openId === segment.id}
                className={cn(
                  "relative flex min-w-0 flex-col justify-center gap-0.5 rounded-full px-4 py-1.5 text-left transition-colors hover:bg-[color:var(--foreground)]/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-5",
                  index > 0 &&
                    (adjacentActive ? "border-l border-transparent" : "border-l border-border"),
                  segment.grow ?? "flex-1",
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
        );
      })}
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
