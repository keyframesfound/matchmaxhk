import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ActiveFilterChip } from "@/features/tutors/active-filter-chips";

/**
 * #605 AC8: dismissible chips for every applied constraint plus Clear all.
 * One horizontal row that scrolls on phone (never wraps into 2–3 rows).
 */
export function ActiveFilterRibbon({
  chips,
  onRemove,
  onClearAll,
}: {
  chips: ActiveFilterChip[];
  onRemove: (chip: ActiveFilterChip) => void;
  onClearAll: () => void;
}) {
  const { t } = useTranslation();
  if (chips.length === 0) return null;
  return (
    <div
      role="group"
      aria-label={t("explore_search.active_filters")}
      className="-mx-4 mb-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip)}
          aria-label={t("explore_search.remove_filter", { label: chip.label })}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[color:var(--ink)]/20 bg-card px-3 text-[13px] font-semibold text-[color:var(--ink)] transition-colors hover:border-[color:var(--ink)]/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
        >
          {chip.label}
          <X className="h-3.5 w-3.5 text-[color:var(--ink)]/60" aria-hidden="true" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="shrink-0 whitespace-nowrap px-1 text-[13px] font-semibold text-[color:var(--ink)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
      >
        {t("search_ui.clear_all")}
      </button>
    </div>
  );
}
