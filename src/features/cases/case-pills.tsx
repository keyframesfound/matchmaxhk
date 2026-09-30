import { BookOpen, ClipboardList, School, Star, type LucideIcon } from "lucide-react";

import { TUTOR_BACKGROUND_LABELS } from "@/features/cases/case-options";
import type { PublicCaseBoardItem } from "@/lib/cases.functions";

/**
 * Case requirement pills (issue #149).
 *
 * Requirement data is grouped into visual categories with fixed color coding so
 * tutors can scan a case at a glance:
 *  - hard   (red)      — strict requirements (currently only target tests)
 *  - background (gold) — schools / pathways / tutor credentials
 *  - curriculum (blue) — syllabus and coursework components
 *
 * Minimum-grade and verified-transcript pills are intentionally absent: the
 * case form does not collect those yet (decided 2026-09-30 — still under
 * discussion). The renderer accepts them, so adding the form fields later only
 * requires new entries in `casePills`.
 */

export type CasePillTone = "hard" | "background" | "curriculum";

export type CasePill = {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: CasePillTone;
};

const TONE_CLASSES: Record<CasePillTone, string> = {
  hard: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  background:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  curriculum:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
};

// Card list priority: strict requirements first, then background, then
// coursework (issue #149 priority order).
const TONE_PRIORITY: Record<CasePillTone, number> = {
  hard: 0,
  background: 1,
  curriculum: 2,
};

function backgroundPill(item: PublicCaseBoardItem): CasePill | null {
  if (!item.tutorBackground || item.tutorBackground === "any") return null;
  const label = TUTOR_BACKGROUND_LABELS[item.tutorBackground];
  if (!label) return null;
  return { key: `background:${item.tutorBackground}`, label, icon: Star, tone: "background" };
}

/** All requirement pills for a case, in stable display order. */
export function casePills(item: PublicCaseBoardItem): CasePill[] {
  const pills: CasePill[] = [];

  if (item.examSystem && item.examSystem !== "Not sure yet") {
    pills.push({
      key: "curriculum",
      label: item.examSystem,
      icon: BookOpen,
      tone: "curriculum",
    });
  }

  if (item.specificComponent) {
    pills.push({
      key: "component",
      label: item.specificComponent,
      icon: ClipboardList,
      tone: "curriculum",
    });
  }

  if (item.targetSchool) {
    pills.push({
      key: "target_school",
      label: item.targetSchool,
      icon: School,
      tone: "background",
    });
  }

  const background = backgroundPill(item);
  if (background) pills.push(background);

  return pills;
}

/** Card list slice: most critical pills first, with an overflow count. */
export function casePillsForCard(
  item: PublicCaseBoardItem,
  max = 3,
): { pills: CasePill[]; overflow: number } {
  const sorted = [...casePills(item)].sort((a, b) => TONE_PRIORITY[a.tone] - TONE_PRIORITY[b.tone]);
  return { pills: sorted.slice(0, max), overflow: Math.max(0, sorted.length - max) };
}

export function CasePillBadge({ pill }: { pill: CasePill }) {
  const Icon = pill.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[pill.tone]}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {pill.label}
    </span>
  );
}
