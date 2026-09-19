import { Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

/**
 * Airbnb-style grouped search header state machine (desktop lg+ only).
 *
 * - "top"      → nav links visible, full search bar in the page flow, no scrim.
 * - "compact"  → full bar retracted behind the nav, compact pill centered in
 *                the nav row, links hidden.
 * - "expanded" → compact pill clicked: full bar pinned under the nav again and
 *                a scrim tints the page until dismissed (scrim click / Esc /
 *                scrolling down).
 *
 * On <lg the provider is inert: everything renders exactly as before.
 */
export type SearchGroupPhase = "top" | "compact" | "expanded";

type SearchGroupContextValue = {
  phase: SearchGroupPhase;
  /** Sticky offset for the pinned bar: the live height of the site header. */
  headerTop: number;
  /** Register the sticky bar element (drives pin detection). */
  registerBar: (element: HTMLDivElement | null) => void;
  expand: () => void;
  /** Dismiss the tinted state back to the compact pill. */
  collapse: () => void;
};

const DEFAULT_CONTEXT: SearchGroupContextValue = {
  phase: "top",
  headerTop: 64,
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
  const [headerTop, setHeaderTop] = useState(64);
  const [isDesktop, setIsDesktop] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

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
      setHeaderTop(height > 0 ? height : 64);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const registerBar = useCallback((element: HTMLDivElement | null) => {
    barRef.current = element;
  }, []);

  const expand = useCallback(() => setPhase("expanded"), []);
  const collapse = useCallback(() => setPhase("compact"), []);

  useEffect(() => {
    if (!isDesktop) {
      lastScrollY.current = null;
      setPhase("top");
      return;
    }
    lastScrollY.current = window.scrollY;

    const evaluate = () => {
      const y = window.scrollY;
      const previous = lastScrollY.current;
      lastScrollY.current = y;
      const current = phaseRef.current;

      if (current === "expanded") {
        // Scrolling down while tinted returns to the compact pill; scrolling
        // up keeps the expanded search open.
        if (previous !== null && y - previous > 4) setPhase("compact");
        return;
      }

      const bar = barRef.current;
      const pinned = !!bar && bar.getBoundingClientRect().top <= headerTop + 8;
      if (!pinned) {
        setPhase("top");
        return;
      }
      if (previous !== null) {
        if (y - previous > 4) setPhase("compact");
        else if (previous - y > 4) setPhase("top");
      }
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        evaluate();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDesktop, headerTop]);

  useEffect(() => {
    if (!isDesktop || phase !== "expanded") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPhase("compact");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDesktop, phase]);

  return (
    <SearchGroupContext.Provider value={{ phase, headerTop, registerBar, expand, collapse }}>
      {children}
    </SearchGroupContext.Provider>
  );
}

/**
 * Sticky band that carries the desktop search row. It pins directly under the
 * site header; the band itself (background + divider) collapses out of view
 * while the compact pill is showing so the layout never jumps.
 */
export function StickySearchBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { phase, headerTop, registerBar, collapse } = useSearchGroup();
  const prefersReducedMotion = useReducedMotion();
  const collapsed = phase === "compact";
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
      <div
        className={cn(
          "border-b border-border bg-[color:var(--surface-header)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
          collapsed
            ? cn("pointer-events-none opacity-0", !prefersReducedMotion && "-translate-y-[120%]")
            : "pointer-events-auto opacity-100",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Compact Airbnb-style pill for the center of the nav row: single-line search
 * summary with the circular azure submit mark. Clicking it expands the full
 * search bar again (tinted state).
 */
export function CompactSearchPill({ summary }: { summary: string }) {
  const { t } = useTranslation();
  const { expand } = useSearchGroup();
  const prefersReducedMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={expand}
      aria-label={t("search_ui.compact_expand")}
      className={cn(
        "group flex h-12 w-[min(30rem,calc(100vw-44rem))] min-w-56 items-center gap-2 rounded-full border border-border bg-card py-1 pr-1.5 pl-5 text-left transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--ink)]">
        {summary}
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

/** Fades the compact pill in/out inside the nav row. */
export function CompactPillSlot({ visible, children }: { visible: boolean; children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="compact-pill"
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
          className="pointer-events-auto"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
