/**
 * Issue #796 §2.6 (was #742), AC-742-3 — Progress Report, pure half.
 *
 * The report is the printable A4 / PDF snapshot of a case for the learner side
 * (parent or student owner). It is ALL-TIME, so unlike the weekly digest it has
 * no window: every number is derived from rows that already exist at read time.
 *
 *  - verified lessons + hours: `case_lessons` through the ONE shared predicate
 *    (`isEligibleReviewLesson`) and the ONE shared counter
 *    (`completedLessonCount`), so a lesson that cannot unlock a rating can
 *    never inflate the report;
 *  - period: earliest / latest verified lesson `starts_at` only, never a planned
 *    or cancelled row;
 *  - mastery + focus: `buildTopicCells` over the case's Super-Drawer logs and
 *    unresolved mistake tags, the #796 §2.1 heatmap being the single mastery
 *    definition.
 *
 * Contract rules:
 *  - A tutor name is rendered as an independent tutor. Employer / organisation
 *    language never enters this payload.
 *  - NO internal id may leave the server: every string field is scrubbed of
 *    uuids, emails and phone numbers by `scrubReportText`, so a case, student
 *    or tutor uuid pasted into a nickname or a topic tag cannot leak.
 *  - Nothing verified (no eligible lesson AND no tagged log) → `null`; the UI
 *    has nothing honest to print, and an empty report is worse than none.
 *
 * Copy stays in `progress_report.*` in the locale files; this module produces
 * facts only.
 */

import { isEligibleReviewLesson } from "@/features/cases/case-reviews";
import { completedLessonCount } from "@/features/cases/rating-window";
import { buildTopicCells, heatmapTopicKey, type HeatmapCell } from "@/features/cases/heatmap-logic";
import type { DrawerLogRow } from "@/features/cases/super-drawer/super-drawer-logic";

/** Focus = at most five weak topics: a report page, not a curriculum dump. */
export const REPORT_FOCUS_MAX = 5;

/** Uuid anywhere in free text (case, student, tutor ids). */
const REPORT_UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/** Email addresses, mirroring the #215 contact filter's looseness. */
const REPORT_EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
/**
 * Hong Kong-ish phone numbers plus generic separated digit runs (#215 is
 * deliberately loose). Over-matching a number-like topic is the safe failure:
 * the report must never carry a contact channel.
 */
const REPORT_PHONE_PATTERN =
  /(?:\+?852[\s-]?)?\b[2-9]\d{3}[\s-]?\d{4}\b|\b\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}\b/g;

export type ProgressReport = {
  /** Public case code, e.g. MM-1234. Never the case uuid. */
  caseCode: string;
  /** `learner_nickname`, scrubbed. */
  studentName: string | null;
  /** `subjects[0]`, scrubbed. */
  subject: string | null;
  /** Tutor display name (or code) fallback, scrubbed. */
  tutorName: string | null;
  /** Earliest verified lesson start (ISO), null when nothing verified. */
  periodStartIso: string | null;
  /** Latest verified lesson start (ISO), null when nothing verified. */
  periodEndIso: string | null;
  /** When the report was generated (ISO). */
  issuedAtIso: string;
  verifiedLessons: number;
  /** Verified minutes / 60, one decimal. */
  verifiedHours: number;
  mastery: { mastered: number; practicing: number; weak: number };
  /** Weak-first topic tags, cap `REPORT_FOCUS_MAX`. */
  focus: string[];
};

/** `case_lessons` columns the report reads. Structurally a `LessonConfirmRow`. */
export type ProgressLessonRow = {
  status: string;
  confirmed_by_parent_at: string | null;
  confirmed_by_tutor_at: string | null;
  starts_at: string | null;
  duration_min: number | null;
};

export type BuildProgressReportInput = {
  now: Date;
  caseCode: string;
  studentName: string | null;
  subject: string | null;
  tutorName: string | null;
  lessons: readonly ProgressLessonRow[];
  /** Drawer logs with `topics` already through `parseDrawerTopics`. */
  logs: readonly DrawerLogRow[];
  /** Unresolved `case_mistakes` counts keyed by `heatmapTopicKey`. */
  unresolvedMistakesByTopic?: Record<string, number>;
};

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Minutes → hours at one decimal, never a negative or NaN figure. */
function roundHours(totalMinutes: number): number {
  const safe = Number.isFinite(totalMinutes) && totalMinutes > 0 ? totalMinutes : 0;
  return Math.round((safe / 60) * 10) / 10;
}

/**
 * Strip ids and contact details from free text before it enters the payload.
 * `null` stays `null`; a value that is nothing but ids becomes `null` too, so a
 * scrubbed-away nickname renders as absent rather than as an empty line.
 */
export function scrubReportText(value: string | null): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const clean = value
    .replace(REPORT_UUID_PATTERN, " ")
    .replace(REPORT_EMAIL_PATTERN, " ")
    .replace(REPORT_PHONE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > 0 ? clean : null;
}

/** Earliest verified-lesson start (ISO) — the report's period opening. */
function earliestVerifiedLessonAt(lessons: readonly ProgressLessonRow[]): string | null {
  let best: number | null = null;
  for (const lesson of lessons) {
    if (!isEligibleReviewLesson(lesson)) continue;
    const ms = parseMs(lesson.starts_at);
    if (ms === null) continue;
    if (best === null || ms < best) best = ms;
  }
  return best === null ? null : new Date(best).toISOString();
}

/** Latest verified-lesson start (ISO) — the report's period closing. */
function latestVerifiedLessonAt(lessons: readonly ProgressLessonRow[]): string | null {
  let best: number | null = null;
  for (const lesson of lessons) {
    if (!isEligibleReviewLesson(lesson)) continue;
    const ms = parseMs(lesson.starts_at);
    if (ms === null) continue;
    if (best === null || ms > best) best = ms;
  }
  return best === null ? null : new Date(best).toISOString();
}

/**
 * Focus = the tags the tutor marked weak first, then the tags forced weak by
 * unresolved mistakes, capped. Both bands come from `buildTopicCells`, so the
 * report never disagrees with the heatmap about what is weak.
 */
function focusTags(cells: readonly HeatmapCell[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (cell: HeatmapCell): void => {
    const tag = scrubReportText(cell.tag);
    if (!tag) return;
    const key = heatmapTopicKey(tag);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(tag);
  };

  for (const cell of cells) if (cell.mastery === "weak") add(cell);
  for (const cell of cells) if (cell.weakByMistakes) add(cell);
  return out.slice(0, REPORT_FOCUS_MAX);
}

/**
 * Fold the raw rows into the report, or `null` when the case has nothing
 * verified to show (no eligible lesson and no tagged log).
 *
 * Facts only: verified count and hours, the period, the heatmap's mastery
 * split and the weak-first focus list. No average, no percentage, no grade
 * claim, and no internal id — every string is scrubbed before it is returned.
 */
export function buildProgressReport(input: BuildProgressReportInput): ProgressReport | null {
  const verified = input.lessons.filter(isEligibleReviewLesson);
  const verifiedLessons = completedLessonCount(input.lessons);
  const { cells, summary } = buildTopicCells(input.logs, input.unresolvedMistakesByTopic ?? {});

  // Nothing verified anywhere: the report would be an empty shell.
  if (verifiedLessons === 0 && cells.length === 0) return null;

  const verifiedMinutes = verified.reduce((sum, lesson) => {
    const minutes = Number(lesson.duration_min);
    return Number.isFinite(minutes) && minutes > 0 ? sum + minutes : sum;
  }, 0);

  return {
    // The public code is already human-facing, but a uuid pasted into it must
    // still not survive; an emptied code degrades to "" rather than a leak.
    caseCode: scrubReportText(input.caseCode) ?? "",
    studentName: scrubReportText(input.studentName),
    subject: scrubReportText(input.subject),
    tutorName: scrubReportText(input.tutorName),
    periodStartIso: earliestVerifiedLessonAt(input.lessons),
    periodEndIso: latestVerifiedLessonAt(input.lessons),
    issuedAtIso: new Date(input.now).toISOString(),
    verifiedLessons,
    verifiedHours: roundHours(verifiedMinutes),
    mastery: {
      mastered: summary.mastered,
      practicing: summary.practicing,
      weak: summary.weak,
    },
    focus: focusTags(cells),
  };
}
