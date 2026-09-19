import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
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

/** Airbnb-style filters modal: centered title, scrollable body, sticky footer. */
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden rounded-3xl border-border p-0">
        <div className="border-b border-border py-4 text-center">
          <DialogTitle className="text-base font-bold text-[color:var(--ink)]">
            {title ?? t("search_ui.filters")}
          </DialogTitle>
        </div>
        <div className="max-h-[62dvh] space-y-7 overflow-y-auto px-6 py-5">{children}</div>
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

/** One titled block inside the filters dialog. */
export function FiltersSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-base font-bold text-[color:var(--ink)]">{title}</h3>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}
