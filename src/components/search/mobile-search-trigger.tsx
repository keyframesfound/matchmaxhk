import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickChip = {
  key: string;
  label: string;
  active?: boolean;
  onClick: () => void;
};

/**
 * Mobile Airbnb-style "Start your search" trigger with a scrollable chip row.
 * Placement/positioning is owned by the page via className.
 */
export function MobileSearchTrigger({
  label,
  onClick,
  chips,
  className,
}: {
  label: string;
  onClick: () => void;
  chips?: QuickChip[];
  className?: string;
}) {
  return (
    <div className={cn("lg:hidden", className)}>
      <button
        type="button"
        onClick={onClick}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-[15px] font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
      {chips && chips.length > 0 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={chip.active}
              onClick={chip.onClick}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                chip.active
                  ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
                  : "border-border bg-card text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
