import { Search } from "lucide-react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchBigInput, SearchableOptionsPanel, type OptionRow } from "./search-controls";

/** Airbnb-style spring used when the white pill and panel slide between segments. */
const HIGHLIGHT_SPRING = { type: "spring", bounce: 0.15, duration: 0.5 } as const;

/** Must match the panel's w-[min(24rem,calc(100vw-2rem))] class for viewport clamping. */
const PANEL_WIDTH = 384;
const PANEL_VIEWPORT_MARGIN = 16;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
 * Desktop Airbnb-style segmented search pill. Opening a segment (click) greys
 * the bar and slides a full-height white pill under it; one persistent panel
 * below the bar survives segment-to-segment moves (content swaps in place).
 * Flat by design — hairline borders and washes instead of shadows.
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
  const openIdRef = useRef(openId);
  openIdRef.current = openId;
  /** Set when a hover (not a click) switched the open segment, so the follow-up click keeps the panel open. */
  const switchedByHover = useRef(false);
  const setOpenId = useCallback(
    (id: string | null) => {
      setInternalOpenId(id);
      onOpenSegmentIdChange?.(id);
    },
    [onOpenSegmentIdChange],
  );
  const prefersReducedMotion = useReducedMotion();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const highlightX = useMotionValue(0);
  const highlightWidth = useMotionValue(0);
  const highlightHeight = useMotionValue(0);
  const highlightOpacity = useMotionValue(0);
  const panelX = useMotionValue(0);
  const hasHighlight = useRef(false);
  const hasPanelPosition = useRef(false);

  const moveHighlight = useCallback(
    (segmentId: string, snap: boolean) => {
      const form = formRef.current;
      const button = buttonRefs.current.get(segmentId);
      if (!form || !button) return;
      // Full bar height: the pill spans flush between the borders, Airbnb-style.
      if (snap || prefersReducedMotion === true) {
        highlightX.set(button.offsetLeft);
        highlightWidth.set(button.offsetWidth);
        highlightHeight.set(form.clientHeight);
      } else {
        animate(highlightX, button.offsetLeft, HIGHLIGHT_SPRING);
        animate(highlightWidth, button.offsetWidth, HIGHLIGHT_SPRING);
        animate(highlightHeight, form.clientHeight, HIGHLIGHT_SPRING);
      }
    },
    [prefersReducedMotion, highlightX, highlightWidth, highlightHeight],
  );

  /** Wrapper-relative panel offset, left-aligned to the segment and clamped to the viewport. */
  const movePanel = useCallback(
    (segmentId: string, snap: boolean) => {
      const wrapper = wrapperRef.current;
      const button = buttonRefs.current.get(segmentId);
      if (!wrapper || !button) return;
      const wrapperLeft = wrapper.getBoundingClientRect().left;
      const buttonLeft = button.getBoundingClientRect().left;
      const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_VIEWPORT_MARGIN * 2);
      const min = PANEL_VIEWPORT_MARGIN;
      const max = Math.max(min, window.innerWidth - PANEL_VIEWPORT_MARGIN - panelWidth);
      const clampedLeft = Math.min(Math.max(buttonLeft, min), max);
      const target = clampedLeft - wrapperLeft;
      if (snap || prefersReducedMotion === true) panelX.set(target);
      else animate(panelX, target, HIGHLIGHT_SPRING);
    },
    [prefersReducedMotion, panelX],
  );

  /**
   * Drives the shared white pill: fades in on open, spring-slides to the open
   * segment (including hover switches between open segments), fades out on
   * close while keeping its position so the next open starts from a clean fade.
   */
  useEffect(() => {
    if (!openId) {
      hasHighlight.current = false;
      animate(highlightOpacity, 0, { duration: 0.2 });
      return;
    }
    const snap = !hasHighlight.current;
    hasHighlight.current = true;
    moveHighlight(openId, snap);
    animate(highlightOpacity, 1, { duration: 0.2 });
  }, [openId, moveHighlight, highlightOpacity]);

  // Position the panel before first paint on open so it never flashes at x: 0.
  useIsomorphicLayoutEffect(() => {
    if (!openId) {
      hasPanelPosition.current = false;
      switchedByHover.current = false;
      return;
    }
    movePanel(openId, !hasPanelPosition.current);
    hasPanelPosition.current = true;
  }, [openId, movePanel]);

  /** Keep the white pill glued to the open segment across resizes/reflows. */
  useEffect(() => {
    const form = formRef.current;
    const button = openId ? buttonRefs.current.get(openId) : undefined;
    if (!form || !button) return;
    const sync = () => {
      highlightX.set(button.offsetLeft);
      highlightWidth.set(button.offsetWidth);
      highlightHeight.set(form.clientHeight);
    };
    const observer = new ResizeObserver(sync);
    observer.observe(form);
    observer.observe(button);
    return () => observer.disconnect();
  }, [openId, highlightX, highlightWidth, highlightHeight]);

  /** Dismiss on outside pointerdown / Escape; re-clamp the panel on resize. */
  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpenId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    const onResize = () => movePanel(openId, true);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [openId, setOpenId, movePanel]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
    setOpenId(null);
  };

  const panelSegment = segments.find((segment) => segment.id === openId);

  return (
    <div
      ref={wrapperRef}
      className={cn("relative", className)}
      onPointerLeave={() => {
        switchedByHover.current = false;
      }}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="relative flex w-full items-center gap-1 rounded-full border border-border bg-card p-1.5"
      >
        {/* Engagement wash: greys the whole bar while a panel is open. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full bg-[color:var(--foreground)] transition-opacity duration-200",
            openId ? "opacity-[0.1]" : "opacity-0",
          )}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-full bg-card"
          style={{
            x: highlightX,
            width: highlightWidth,
            height: highlightHeight,
            opacity: highlightOpacity,
          }}
        />
        {segments.map((segment, index) => {
          const adjacentActive = openId === segment.id || openId === segments[index - 1]?.id;
          return (
            <button
              key={segment.id}
              ref={(node) => {
                if (node) buttonRefs.current.set(segment.id, node);
                else buttonRefs.current.delete(segment.id);
              }}
              type="button"
              aria-expanded={openId === segment.id}
              aria-haspopup="dialog"
              onPointerEnter={() => {
                if (openIdRef.current !== null && openIdRef.current !== segment.id) {
                  setOpenId(segment.id);
                  switchedByHover.current = true;
                }
              }}
              onClick={() => {
                if (switchedByHover.current && openIdRef.current === segment.id) {
                  switchedByHover.current = false;
                  return;
                }
                setOpenId(openIdRef.current === segment.id ? null : segment.id);
              }}
              className={cn(
                "relative flex min-w-0 flex-col justify-center gap-0.5 rounded-full px-4 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-5",
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
      <AnimatePresence>
        {openId && panelSegment ? (
          <motion.div
            key="search-pill-panel"
            role="dialog"
            aria-label={panelSegment.label}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -4 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(24rem,calc(100vw-2rem))] rounded-3xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-4"
            style={{ x: panelX }}
          >
            <div key={openId}>
              {panelSegment.title ? (
                <p className="mb-3 text-xl font-bold tracking-tight text-[color:var(--ink)]">
                  {panelSegment.title}
                </p>
              ) : null}
              {panelSegment.content ?? (
                <SearchableOptionsPanel
                  options={panelSegment.options ?? []}
                  currentValue={panelSegment.currentValue}
                  onSelect={(value) => {
                    panelSegment.onSelect?.(value);
                    setOpenId(null);
                  }}
                  searchPlaceholder={panelSegment.searchPlaceholder}
                  emptyText={panelSegment.emptyText}
                  showAnyOption={panelSegment.showAnyOption ?? true}
                  anyLabel={t("search_ui.any_value")}
                />
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
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
