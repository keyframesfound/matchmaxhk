/**
 * Issue #653: Progress & Grades, pure half. Scores stay private to the parties
 * of one case and never reach a public profile. The target is not stored here:
 * it lives on the #637 Demand-Side row, so the two can't disagree.
 */

import { hktDateKey } from "@/features/cases/sor";

export const ASSESSMENT_CATEGORIES = ["lesson_quiz", "past_paper", "school_exam"] as const;
export const ASSESSMENT_NAME_MAX = 80;
export const ASSESSMENT_NOTE_MAX = 200;
export const GRADE_LABEL_MAX = 12;
/** Same limit as target_grade in the #637 panel, which shares the value. */
export const TARGET_GRADE_MAX = 100;
export const MAX_MARKS_LIMIT = 10000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number];

export type AssessmentScore = {
  assessedOn: string;
  marks: number;
  maxMarks: number;
  createdAt: string;
};

export type ProgressSummary = {
  baseline: number | null;
  latest: number | null;
  /** Latest minus baseline; null until there are two scores. */
  delta: number | null;
  onTarget: boolean;
};

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function assessmentPct(marks: number, maxMarks: number): number {
  return roundOne((marks / maxMarks) * 100);
}

/** A real day: V8 reads 2026-02-31 as 3 March, so round-trip it. */
function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export function assessmentError(input: {
  marks: number;
  maxMarks: number;
  assessedOn: string;
  now: Date;
}): "BAD_MARKS" | "BAD_DATE" | null {
  const { marks, maxMarks, assessedOn, now } = input;
  const validMarks =
    Number.isFinite(marks) &&
    Number.isFinite(maxMarks) &&
    maxMarks > 0 &&
    maxMarks <= MAX_MARKS_LIMIT &&
    marks >= 0 &&
    marks <= maxMarks;
  if (!validMarks) return "BAD_MARKS";
  if (!isCalendarDate(assessedOn)) return "BAD_DATE";
  return assessedOn > hktDateKey(now) ? "BAD_DATE" : null;
}

export function sortAssessments<T extends AssessmentScore>(scores: readonly T[]): T[] {
  return [...scores].sort(
    (a, b) => a.assessedOn.localeCompare(b.assessedOn) || a.createdAt.localeCompare(b.createdAt),
  );
}

export function summarizeProgress(
  scores: readonly AssessmentScore[],
  targetPct: number | null,
): ProgressSummary {
  const sorted = sortAssessments(scores);
  if (sorted.length === 0) {
    return { baseline: null, latest: null, delta: null, onTarget: false };
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const baseline = assessmentPct(first.marks, first.maxMarks);
  const latest = assessmentPct(last.marks, last.maxMarks);
  return {
    baseline,
    latest,
    delta: sorted.length < 2 ? null : roundOne(latest - baseline),
    onTarget: targetPct !== null && latest >= targetPct,
  };
}

/** Plot positions: x by calendar date, y by percent (100% at the top). */
export function chartPoints<T extends AssessmentScore>(
  scores: readonly T[],
  frame: { width: number; height: number },
): (T & { x: number; y: number; pct: number })[] {
  const sorted = sortAssessments(scores);
  if (sorted.length === 0) return [];
  const firstMs = Date.parse(sorted[0].assessedOn);
  const spanDays = (Date.parse(sorted[sorted.length - 1].assessedOn) - firstMs) / DAY_MS;
  return sorted.map((score) => {
    const pct = Math.min(assessmentPct(score.marks, score.maxMarks), 100);
    const days = (Date.parse(score.assessedOn) - firstMs) / DAY_MS;
    return {
      ...score,
      pct,
      x: spanDays === 0 ? frame.width / 2 : (days / spanDays) * frame.width,
      y: frame.height - (pct / 100) * frame.height,
    };
  });
}
