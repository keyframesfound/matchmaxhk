import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  School,
  Star,
  type LucideIcon,
} from "lucide-react";

import { TUTOR_BACKGROUND_LABELS } from "@/features/cases/case-options";
import i18n from "@/features/i18n/config";
import { senCategoryLabel } from "@/features/tutors/sen-labels";
import { academicTierLabel, kindergartenTopicLabel } from "@/features/tutors/verticals-labels";
import { caseAcademicTier } from "@/features/tutors/verticals";
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

  // Issue #190: academic tier chip — stored tier first, legacy rows derive
  // it from student_level (Kindergarten/University only).
  const tier = caseAcademicTier(item.academicTier, item.studentLevel);
  if (tier) {
    pills.push({
      key: "tier",
      label: academicTierLabel(tier),
      icon: GraduationCap,
      tone: "background",
    });
  }

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

  // Issue #190: University vertical details (stored values, no copy).
  if (item.uniName) {
    pills.push({ key: "uni_name", label: item.uniName, icon: GraduationCap, tone: "background" });
  }
  if (item.uniField) {
    pills.push({ key: "uni_field", label: item.uniField, icon: BookOpen, tone: "curriculum" });
  }

  // Issue #190: Kindergarten focus topics with translated labels.
  for (const topic of item.kindergartenFocus) {
    pills.push({
      key: `k_topic:${topic}`,
      label: kindergartenTopicLabel(topic),
      icon: BookOpen,
      tone: "curriculum",
    });
  }

  const background = backgroundPill(item);
  if (background) pills.push(background);

  // Issue #199: SEN support required — a hard requirement for matching.
  // Specific categories surface as extra hard pills so tutors can see the
  // exact needs at a glance.
  if (item.senRequired) {
    pills.push({
      key: "sen",
      label: i18n.t("sen.board_pill"),
      icon: HeartHandshake,
      tone: "hard",
    });
    for (const category of item.senCategories) {
      pills.push({
        key: `sen:${category}`,
        // Stored category values are data — interpolate the translated label.
        label: i18n.t("sen.case_pill", { category: senCategoryLabel(category) }),
        icon: HeartHandshake,
        tone: "hard",
      });
    }
  }

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
