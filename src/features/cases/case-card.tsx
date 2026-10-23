// Issue #423 (sections 2+3) — shared unified case-card building blocks.
//
// One implementation for both surfaces so the list card and the detail page
// can never drift: the fee-rule pill (package_type), the 1-line logistics
// row, the bilingual auto-title pair, and the single clickable chip row.
// Design system: hairline borders, no shadows, sentence-case labels.

import { useTranslation } from "react-i18next";
import { MapPin, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

import {
  CASE_MODE_LABEL,
  caseBudgetHkdBounds,
  formatCaseRate,
  formatCaseSchedule,
  formatStudentLevel,
} from "@/features/cases/display";
import {
  buildCaseTitle,
  caseTitleFieldsFromBoard,
  type CaseTitleLocale,
} from "@/features/cases/case-title";
import { caseChips, type CaseChip } from "@/features/cases/case-chips";
import type { PublicCaseBoardItem } from "@/lib/cases.functions";

export type CasePackageType = "ongoing_1_5" | "short_20" | "pro_bono";

/** Locale-primary + secondary titles in the #411 dual-language pattern. */
export function useCaseTitles(item: PublicCaseBoardItem): {
  primary: string;
  secondary: string;
  primaryLocale: CaseTitleLocale;
} {
  const { i18n } = useTranslation();
  const primaryLocale: CaseTitleLocale = i18n.language?.startsWith("zh") ? "zh-HK" : "en";
  const secondaryLocale: CaseTitleLocale = primaryLocale === "en" ? "zh-HK" : "en";
  // Map the board item at the boundary — the raw item has examSystem/
  // studentLevel, and an unmapped pass titles subject-only while shadowing
  // the stored title (GLM blocker, 2026-10-23).
  const titleFields = caseTitleFieldsFromBoard(item);
  const primary = buildCaseTitle(titleFields, primaryLocale) || item.title;
  const secondaryRaw = buildCaseTitle(titleFields, secondaryLocale);
  return {
    primary,
    // Never render the same string twice (legacy fallback / untranslated
    // custom subject makes the two lines identical).
    secondary: secondaryRaw && secondaryRaw !== primary ? secondaryRaw : "",
    primaryLocale,
  };
}

const FEE_PILL_KEY: Record<CasePackageType, string> = {
  ongoing_1_5: "case_board.fee_pill_ongoing",
  short_20: "case_board.fee_pill_short",
  pro_bono: "case_board.fee_pill_pro_bono",
};

export function caseFeePillKey(packageType: string | null | undefined): string {
  return FEE_PILL_KEY[(packageType ?? "") as CasePackageType] ?? FEE_PILL_KEY.ongoing_1_5;
}

/** Footer fee-rule pill: `1.5-Lesson` | `20% Short` | `Pro-Bono $0`. */
export function CaseFeePill({
  packageType,
  className = "",
}: {
  packageType: string | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--card-tint)] px-2.5 py-0.5 text-xs font-semibold text-[color:var(--ink)] ${className}`}
    >
      {t(caseFeePillKey(packageType))}
    </span>
  );
}

/** The rate string for a case with its own unit suffix (never "HK$?"). */
export function caseRateText(item: PublicCaseBoardItem): string {
  const { min, max } = caseBudgetHkdBounds(item);
  return formatCaseRate(min, max, item.rateUnit ?? "hr");
}

/** Logistics parts for the 1-line `📍 district · mode · cadence · rate` row. */
export function caseLogisticsParts(item: PublicCaseBoardItem): string[] {
  const modeLabel = CASE_MODE_LABEL[item.mode] ?? item.mode;
  // District-less cases (online) must not repeat the mode: the pin part IS
  // the mode there, so drop the bare label instead of Set-dedupe (which can't
  // dedupe `📍 Online` vs `Online`) — GLM review, 2026-10-23.
  const parts = item.district ? [`📍 ${item.district}`, modeLabel] : [`📍 ${modeLabel}`];
  parts.push(formatCaseSchedule(item.sessionsPerWeek, item.sessionLengthMinutes));
  parts.push(caseRateText(item));
  // Dedupe mode when it already leads the line for online-only cases.
  return [...new Set(parts.filter(Boolean))];
}

/** One clickable chip — shared by the card row and the detail grouping. */
export function CaseChipLink({ chip }: { chip: CaseChip }) {
  const { t } = useTranslation();
  const inner = (
    <span
      className={`inline-flex shrink-0 items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-tight transition-colors ${
        chip.hard
          ? "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[#a16207] dark:text-[color:var(--warning)]"
          : "border-border bg-[color:var(--card-tint)] text-muted-foreground hover:border-[color:var(--brand-link)] hover:text-[color:var(--ink)]"
      }`}
    >
      {chip.hard ? "⚠️ " : ""}
      {chip.tKey ? t(chip.tKey) : chip.label}
    </span>
  );
  if (chip.tag) {
    return (
      <Link to="/tutor-requests" search={{ tag: chip.tag }} className="shrink-0">
        {inner}
      </Link>
    );
  }
  if (chip.query) {
    return (
      <Link to="/tutor-requests" search={{ q: chip.query }} className="shrink-0">
        {inner}
      </Link>
    );
  }
  return <span className="shrink-0">{inner}</span>;
}

/**
 * The ONE chip row: clickable chips from the shared profile-tags vocabulary,
 * capped at MAX_CASE_TAGS, hard-cut to a single ellipsized line so grid
 * cards stay equal height.
 */
export function CaseChipRow({ item, limit }: { item: PublicCaseBoardItem; limit?: number }) {
  const chips: CaseChip[] = limit ? caseChips(item).slice(0, limit) : caseChips(item);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-nowrap items-center gap-1.5 overflow-hidden">
      {chips.map((chip) => (
        <CaseChipLink key={chip.key} chip={chip} />
      ))}
    </div>
  );
}

/** `👥 N students` — only rendered when student_count > 1 (caller + here). */
export function CaseStudentsRow({ item }: { item: PublicCaseBoardItem }) {
  const { t } = useTranslation();
  if ((item.studentCount ?? 1) <= 1) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {t("case_board.students_count", { count: item.studentCount })}
      </span>
    </div>
  );
}

/** The grade segment of the auto-title, for the detail meta row. */
export function caseGradeLabel(item: PublicCaseBoardItem): string {
  return formatStudentLevel(item.studentLevel) || item.studentLevel;
}

export function CaseLogisticsLine({
  parts,
  className = "",
}: {
  parts: string[];
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{parts.join(" · ")}</span>
    </div>
  );
}
