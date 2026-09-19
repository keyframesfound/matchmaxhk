import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readSlideDirection } from "./slide-direction";

export type MobileSearchTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string;
  active?: boolean;
  onSelect: () => void;
};

/**
 * Full-screen Airbnb-style mobile search overlay: tab row + close bubble up
 * top, a rounded panel body, and a sticky footer with "Clear all" + Search.
 * Switching tabs cross-page slides the new overlay in from the side.
 */
export function MobileSearchOverlay({
  open,
  onOpenChange,
  tabs,
  children,
  clearLabel,
  submitLabel,
  onClear,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabs?: MobileSearchTab[];
  children: ReactNode;
  clearLabel: string;
  submitLabel: ReactNode;
  onClear: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const [direction] = useState<"next" | "prev" | null>(() => readSlideDirection());
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) setClosing(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setClosing(true);
        window.clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => onOpenChange(false), 180);
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  if (!open) return null;

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => onOpenChange(false), 180);
  };

  const enterClass =
    direction === "next"
      ? "slide-in-from-right"
      : direction === "prev"
        ? "slide-in-from-left"
        : "fade-in";
  const exitClass =
    direction === "next"
      ? "slide-out-to-right"
      : direction === "prev"
        ? "slide-out-to-left"
        : "fade-out";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "fixed inset-0 z-[70] flex flex-col bg-[color:var(--surface-subtle)] lg:hidden",
        "animate-in ease-out",
        closing
          ? cn(exitClass, "animation-duration-200")
          : cn(enterClass, "animation-duration-300"),
      )}
    >
      <div className="relative flex items-center justify-center gap-5 px-10 pt-3 pb-1 sm:gap-7">
        {tabs?.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={tab.onSelect}
            aria-current={tab.active ? "true" : undefined}
            className={`relative flex min-w-12 flex-col items-center gap-0.5 py-1 text-[13px] font-semibold transition-colors ${
              tab.active
                ? "text-[color:var(--ink)]"
                : "text-[color:var(--ink)]/55 hover:text-[color:var(--ink)]"
            }`}
          >
            <span className="relative">
              {tab.icon}
              {tab.badge ? (
                <span className="absolute -right-6 -top-2.5 rounded-full bg-[color:var(--foreground)] px-1.5 py-px text-[9px] font-bold uppercase leading-none text-[color:var(--background)]">
                  {tab.badge}
                </span>
              ) : null}
            </span>
            {tab.label}
            {tab.active ? (
              <span className="absolute -bottom-0.5 h-0.5 w-full rounded-full bg-[color:var(--foreground)]" />
            ) : null}
          </button>
        ))}
        <button
          type="button"
          aria-label={t("search_ui.close_search")}
          onClick={requestClose}
          className="absolute right-3 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5">{children}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="ghost"
          onClick={onClear}
          className="h-10 shrink-0 px-2 text-[15px] font-semibold text-[color:var(--ink)] underline underline-offset-4 hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
        >
          {clearLabel}
        </Button>
        <Button
          type="button"
          variant="solid"
          color="blue"
          onClick={onSubmit}
          className="h-12 min-w-0 flex-1 rounded-full px-6 text-base font-bold sm:flex-none"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{submitLabel}</span>
        </Button>
      </div>
    </div>
  );
}
