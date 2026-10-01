import { Search } from "lucide-react";
import {
  motion,
  motionValue,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * Airbnb-style grouped search header with a snap collapse (desktop lg+ only).
 *
 * Once the search band pins under the header, a 4px scroll in either
 * direction snaps it: scrolling down springs the bar closed (it shrinks into
 * the header while the nav tabs slide up) and scrolling up springs it open
 * again. All consumers animate from one spring-smoothed collapseProgress
 * value, so the choreography stays in lockstep.
 *
 * - "top"      → normal snapping; the full bar shows while progress is low.
 * - "expanded" → compact pill clicked: the bar is pinned open again under the
 *                nav and a scrim tints the page until dismissed (scrim click /
 *                Esc / scrolling down). Progress is held open while tinted.
 *
 * On <lg the provider is inert: everything renders exactly as before.
 */
export type SearchGroupPhase = "top" | "expanded";

/** Progress past which the collapsed bar and the nav swap pointer events. */
export const COLLAPSE_MIDPOINT = 0.5;

type SearchGroupContextValue = {
  phase: SearchGroupPhase;
  /** Sticky offset for the pinned bar: the live height of the site header. */
  headerTop: number;
  /** 0 = full search bar showing, 1 = collapsed behind the compact pill. */
  collapseProgress: MotionValue<number>;
  /** Register the sticky bar element (drives pin-offset measurement). */
  registerBar: (element: HTMLDivElement | null) => void;
  expand: () => void;
  /** Dismiss the tinted state back to the collapsed compact pill. */
  collapse: () => void;
};

const DEFAULT_CONTEXT: SearchGroupContextValue = {
  phase: "top",
  headerTop: 72,
  collapseProgress: motionValue(0),
  registerBar: () => {},
  expand: () => {},
  collapse: () => {},
};

const SearchGroupContext = createContext<SearchGroupContextValue | null>(null);

export function useSearchGroup() {
  return useContext(SearchGroupContext) ?? DEFAULT_CONTEXT;
}

export function SearchGroupProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SearchGroupPhase>("top");
  const [headerTop, setHeaderTop] = useState(72);
  const [isDesktop, setIsDesktop] = useState(false);
  const [pinStart, setPinStart] = useState(0);
  const barRef = useRef<HTMLDivElement | null>(null);
  const pinStartRef = useRef(pinStart);
  pinStartRef.current = pinStart;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const lastScrollY = useRef<number | null>(null);
  const { scrollY } = useScroll();
  const prefersReducedMotion = useReducedMotion();

  // Owned scrub target, written imperatively so the expanded (tinted) state
  // can hold the band open regardless of scroll; the spring smooths raw
  // scroll steps instead of snapping between the two.
  const scrubTarget = useMotionValue(0);
  const springConfig = useMemo(
    () =>
      prefersReducedMotion
        ? { stiffness: 1000, damping: 500, restDelta: 0.001 }
        : { stiffness: 500, damping: 40 },
    [prefersReducedMotion],
  );
  const collapseProgress = useSpring(scrubTarget, springConfig);

  // Only drive the state machine at Tailwind's lg breakpoint; below lg every
  // consumer renders its static (top) appearance.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 64rem)");
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // The pinned bar must clear the whole sticky header, announcement banner
  // included — measure it live instead of hardcoding 64px.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    if (!header) return;
    const update = () => {
      const height = header.offsetHeight;
      setHeaderTop(height > 0 ? height : 72);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const registerBar = useCallback((element: HTMLDivElement | null) => {
    barRef.current = element;
  }, []);

  // Scroll offset at which the band reaches the header: its document-space
  // flow position (offsetTop is unaffected by sticky pinning) minus the live
  // header height. On the homepage the band sits flush under the header, so
  // the collapse can snap with the very first scroll pixels.
  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    const measure = () => {
      const bar = barRef.current;
      if (!bar) return;
      let top = 0;
      let el: HTMLElement | null = bar;
      while (el) {
        top += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      }
      if (!cancelled) setPinStart(Math.max(0, top - headerTop));
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, [isDesktop, headerTop]);

  const snapBar = useCallback(
    (collapsed: boolean) => {
      scrubTarget.set(collapsed ? 1 : 0);
    },
    [scrubTarget],
  );

  const expand = useCallback(() => {
    setPhase("expanded");
    scrubTarget.set(0);
  }, [scrubTarget]);

  const collapse = useCallback(() => {
    setPhase("top");
    snapBar(true);
  }, [snapBar]);

  useMotionValueEvent(scrollY, "change", (y) => {
    const previous = lastScrollY.current;
    lastScrollY.current = y;
    if (!isDesktop) return;
    if (phaseRef.current === "expanded") {
      // Scrolling down while tinted returns to the compact pill; scrolling up
      // keeps the expanded search open.
      if (previous !== null && y - previous > 4) collapse();
      return;
    }
    // Above the pin point the band never collapses; past it, scroll direction
    // snaps it closed / open.
    if (y < pinStartRef.current - 8) {
      snapBar(false);
      return;
    }
    if (previous !== null) {
      if (y - previous > 4) snapBar(true);
      else if (previous - y > 4) snapBar(false);
    }
  });

  // Sync once on mount, breakpoint flips and pin-offset changes so a page
  // loaded mid-scroll renders already collapsed. Strictly past the pin point:
  // on the homepage the band pins at scrollY 0, where the bar must stay open.
  useEffect(() => {
    lastScrollY.current = window.scrollY;
    if (!isDesktop) {
      setPhase("top");
      scrubTarget.set(0);
      return;
    }
    snapBar(window.scrollY > pinStartRef.current + 8);
  }, [isDesktop, pinStart, snapBar, scrubTarget]);

  useEffect(() => {
    if (!isDesktop || phase !== "expanded") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDesktop, phase, collapse]);

  return (
    <SearchGroupContext.Provider
      value={{ phase, headerTop, collapseProgress, registerBar, expand, collapse }}
    >
      {children}
    </SearchGroupContext.Provider>
  );
}

/**
 * Sticky band that carries the desktop search row. It pins directly under the
 * site header; as the collapse progress grows, a clipping wrapper shrinks the
 * band away (height → 0) while the content drifts up and fades, so the bar
 * reads as shrinking into the header instead of sliding off it.
 */
export function StickySearchBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { phase, headerTop, registerBar, collapse, collapseProgress } = useSearchGroup();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  // Track the bar's natural height so the wrapper can shrink from it; when
  // unmeasured (first paint) fall back to auto so nothing collapses early.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => setContentHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = useTransform(collapseProgress, (p) =>
    p <= 0 || contentHeight === null ? "auto" : Math.max(0, contentHeight * (1 - p)),
  );
  const y = useTransform(collapseProgress, (p) =>
    contentHeight === null ? 0 : -p * contentHeight * 0.25,
  );
  const opacity = useTransform(collapseProgress, [0.55, 0.9], [1, 0]);
  const [pastMid, setPastMid] = useState(false);
  useMotionValueEvent(collapseProgress, "change", (p) => setPastMid(p > COLLAPSE_MIDPOINT));

  const scrimVisible = phase === "expanded";

  return (
    <div ref={registerBar} className="sticky z-40 hidden lg:block" style={{ top: headerTop }}>
      <div
        aria-hidden="true"
        onClick={collapse}
        className={cn(
          "fixed inset-0 z-30 cursor-default bg-black/45 transition-opacity duration-300 motion-reduce:transition-none",
          scrimVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <motion.div style={{ height }} className="overflow-hidden">
        <motion.div
          ref={contentRef}
          style={{ opacity, y }}
          aria-hidden={pastMid || undefined}
          className={cn(
            "border-b border-border bg-[color:var(--surface-header)] transition-colors duration-300 motion-reduce:transition-none",
            scrimVisible && "bg-[color:var(--surface-subtle)]",
            pastMid ? "pointer-events-none" : "pointer-events-auto",
            className,
          )}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * Compact Airbnb-style pill for the center of the nav row: segmented
 * "Anywhere | Anytime | Add guests"-style summary with hairline dividers, an
 * optional vertical icon, and the circular azure submit mark. Clicking it
 * expands the full search bar again (tinted state).
 */
export function CompactSearchPill({
  segments,
  icon,
}: {
  /** Pre-translated display values, one per segment (placeholders included). */
  segments: string[];
  /** Optional icon asset (public/ path) for the vertical, Airbnb-style. */
  icon?: string;
}) {
  const { t } = useTranslation();
  const { expand } = useSearchGroup();

  return (
    <button
      type="button"
      onClick={expand}
      aria-label={t("search_ui.compact_expand")}
      className={cn(
        "group flex h-12 w-[min(30rem,calc(100vw-44rem))] min-w-56 items-center gap-2.5 rounded-full border border-border bg-card py-1 pr-1.5 pl-4 text-left transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      )}
    >
      {icon ? (
        <img
          src={icon}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-5 w-5 shrink-0 dark:invert-[0.85] dark:hue-rotate-180"
        />
      ) : null}
      <span className="flex min-w-0 flex-1 items-center">
        {segments.map((segment, index) => (
          <Fragment key={segment + index}>
            {index > 0 && (
              <span
                aria-hidden="true"
                className="mx-2.5 h-6 w-px shrink-0 bg-[color:var(--border)]"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[color:var(--ink)]">
              {segment}
            </span>
          </Fragment>
        ))}
      </span>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-accent)] text-white transition-colors group-hover:bg-[color:var(--btn-accent-hover)]"
      >
        <Search className="h-4 w-4" />
      </span>
    </button>
  );
}
