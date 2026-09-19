import { SlidersHorizontal, X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** The standalone "Filters" pill that sits beside the search bar. */
export function FiltersPillButton({
  label,
  count,
  onClick,
  className,
}: {
  label: string;
  count?: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-auto shrink-0 gap-2 self-stretch rounded-full border-border bg-card px-5 text-sm font-bold text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]",
        className,
      )}
    >
      <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {count ? (
        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-link)] px-1.5 text-[11px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </Button>
  );
}

type SectionMeta = { id: string; title: string };

type FiltersSectionContextValue = {
  register: (meta: SectionMeta, element: HTMLElement) => () => void;
  focusId: string | null;
};

const FiltersSectionContext = createContext<FiltersSectionContextValue | null>(null);

/**
 * Airbnb-style filters modal: centered title, "Search all filters" jump bar,
 * scrollable body, sticky footer. Sections register themselves so the search
 * bar can scroll + flash the matching one.
 */
export function FiltersDialog({
  open,
  onOpenChange,
  title,
  clearLabel,
  applyLabel,
  onClear,
  onApply,
  footerExtra,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  clearLabel: string;
  applyLabel: ReactNode;
  onClear: () => void;
  onApply: () => void;
  footerExtra?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SectionMeta[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const elementsRef = useRef(new Map<string, HTMLElement>());
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) return;
    setQuery("");
    setFocusId(null);
    setSections([]);
    elementsRef.current.clear();
  }, [open]);

  const register = (meta: SectionMeta, element: HTMLElement) => {
    elementsRef.current.set(meta.id, element);
    setSections((prev) =>
      prev.some((section) => section.id === meta.id) ? prev : [...prev, meta],
    );
    return () => {
      elementsRef.current.delete(meta.id);
      setSections((prev) => prev.filter((section) => section.id !== meta.id));
    };
  };

  const jumpTo = (id: string) => {
    setFocusId(id);
    setQuery("");
    const element = elementsRef.current.get(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      scrollBodyRef.current
        ?.querySelector(`[data-filter-section="${id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const normalized = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      normalized
        ? sections.filter((section) => section.title.toLowerCase().includes(normalized))
        : [],
    [sections, normalized],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden rounded-3xl border-border p-0">
        <div className="border-b border-border py-4 text-center">
          <DialogTitle className="text-base font-bold text-[color:var(--ink)]">
            {title ?? t("search_ui.filters")}
          </DialogTitle>
        </div>
        <div className="relative px-4 pt-3">
          <div className="relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search_ui.search_all_filters")}
              aria-label={t("search_ui.search_all_filters")}
              className="h-11 w-full rounded-full border border-transparent bg-[color:var(--surface-subtle)] pl-4 pr-10 text-sm font-medium text-[color:var(--ink)] placeholder:text-muted-foreground transition-[border-color,background-color] focus:border-ring focus:bg-[color:var(--surface)] focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            {query ? (
              <button
                type="button"
                aria-label={t("search_panel.clear_search")}
                onClick={() => setQuery("")}
                className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--foreground)]/[0.1] text-[color:var(--ink)]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {normalized && matches.length > 0 ? (
            <div className="absolute inset-x-4 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-border bg-[color:var(--surface)] p-1.5">
              {matches.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => jumpTo(section.id)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.05]"
                >
                  {section.title}
                  <SlidersHorizontal
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div ref={scrollBodyRef} className="max-h-[62dvh] space-y-7 overflow-y-auto px-6 py-5">
          <FiltersSectionContext.Provider value={{ register, focusId }}>
            {children}
          </FiltersSectionContext.Provider>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClear}
            className="h-10 shrink-0 px-2 text-sm font-semibold text-[color:var(--ink)] underline underline-offset-4 hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
          >
            {clearLabel}
          </Button>
          {footerExtra}
          <Button
            type="button"
            variant="solid"
            color="neutral"
            onClick={() => {
              onApply();
              onOpenChange(false);
            }}
            className="h-11 rounded-xl px-6 text-sm font-bold"
          >
            {applyLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** One titled block inside the filters dialog; registers for the search bar. */
export function FiltersSection({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const context = useContext(FiltersSectionContext);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!context || !element) return;
    return context.register({ id, title }, element);
  }, [context, id, title]);

  return (
    <section ref={ref} data-filter-section={id} className="scroll-mt-2">
      <h3
        className={cn(
          "rounded-lg text-base font-bold text-[color:var(--ink)] transition-colors",
          context?.focusId === id && "-mx-2 bg-[color:var(--brand-royal)]/[0.12] px-2 py-1",
        )}
      >
        {title}
      </h3>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Airbnb "Recommended for you" quick-pick scroller: bordered icon cards that
 * apply a preset instantly; tapping the active card clears it.
 */
export function FilterQuickPicks({
  options,
  className,
}: {
  options: Array<{
    id: string;
    label: string;
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
    active?: boolean;
    onToggle: () => void;
  }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.active}
            onClick={option.onToggle}
            className={cn(
              "flex w-24 shrink-0 flex-col items-center justify-center gap-2.5 rounded-2xl border px-2 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              option.active
                ? "border-[1.5px] border-[color:var(--foreground)] bg-card"
                : "border-border bg-card hover:bg-[color:var(--surface-subtle)]",
            )}
          >
            <Icon
              className={cn(
                "h-6 w-6",
                option.active ? "text-[color:var(--ink)]" : "text-[color:var(--ink)]/80",
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                "text-center text-xs leading-tight",
                option.active
                  ? "font-bold text-[color:var(--ink)]"
                  : "font-medium text-[color:var(--ink)]/75",
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
