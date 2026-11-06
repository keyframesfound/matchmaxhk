import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  MORE_TUTOR_STATUSES,
  PRIMARY_TUTOR_STATUSES,
  type TutorStatusCode,
} from "@/features/tutors/status-taxonomy";

/**
 * Issue #658 §2.1/§3: the parent-facing tutor-status filter body — 6 primary
 * multi-select chips (OR) with the rarer statuses under a "More statuses +"
 * expander. 36px chips, hairline borders, no shadows; the section renders
 * inside the desktop FiltersDialog and the mobile search overlay.
 */

export function tutorStatusLabelKey(code: string): string {
  return `tutor_status.${code}`;
}

function StatusChip({
  code,
  active,
  onToggle,
}: {
  code: string;
  active: boolean;
  onToggle: (code: TutorStatusCode) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onToggle(code as TutorStatusCode)}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
        active
          ? "border-[color:var(--ink)] bg-[color:var(--ink)]/5 text-[color:var(--ink)]"
          : "border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]/70 hover:border-[color:var(--ink)]/30 hover:text-[color:var(--ink)]",
      )}
    >
      {t(tutorStatusLabelKey(code))}
    </button>
  );
}

export function TutorStatusFilterChips({
  selected,
  onToggle,
  onClear,
}: {
  /** Fully-parsed selected codes (canonical and/or legacy URL values). */
  selected: readonly string[];
  onToggle: (code: TutorStatusCode) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  // The expander stays open when a "More" code is active (deep link / back
  // navigation), so the pick is never invisible inside a collapsed section.
  const [moreOpen, setMoreOpen] = useState(
    MORE_TUTOR_STATUSES.some((code) => selected.includes(code)),
  );
  const moreSelectedCount = MORE_TUTOR_STATUSES.filter((code) => selected.includes(code)).length;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {PRIMARY_TUTOR_STATUSES.map((code) => (
          <StatusChip key={code} code={code} active={selected.includes(code)} onToggle={onToggle} />
        ))}
      </div>
      {moreOpen ? (
        <div className="flex flex-wrap gap-2">
          {MORE_TUTOR_STATUSES.map((code) => (
            <StatusChip
              key={code}
              code={code}
              active={selected.includes(code)}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className="inline-flex items-center gap-1 text-sm font-bold text-[color:var(--brand-link)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
        >
          {moreOpen ? t("tutor_status.more_collapse") : t("tutor_status.more_toggle")}
          {moreSelectedCount > 0 ? ` (${moreSelectedCount})` : ""}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
          >
            {t("tutor_status.clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
