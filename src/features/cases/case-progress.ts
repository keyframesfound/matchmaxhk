/**
 * Issue #653: Progress & Grades, pure half. Scores stay private to the parties
 * of one case and never reach a public profile. The target is not stored here:
 * it lives on the #637 Demand-Side row, so the two can't disagree.
 */

import { HOMEWORK_SCORE_MAX } from "@/features/cases/homework";
import { hktDateKey } from "@/features/cases/sor";

/** The log form only writes manual assessments; homework arrives from #736. */
export const ASSESSMENT_CATEGORIES = ["lesson_quiz", "past_paper", "school_exam"] as const;
/** Display-only union for the gradebook: manual rows plus reviewed homework. */
export const GRADEBOOK_CATEGORIES = [...ASSESSMENT_CATEGORIES, "homework"] as const;
export const ASSESSMENT_NAME_MAX = 80;
export const ASSESSMENT_NOTE_MAX = 200;
export const GRADE_LABEL_MAX = 12;
/** Same limit as target_grade in the #637 panel, which shares the value. */
export const TARGET_GRADE_MAX = 100;
export const MAX_MARKS_LIMIT = 10000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number];
export type GradebookCategory = (typeof GRADEBOOK_CATEGORIES)[number];

export type AssessmentScore = {
  assessedOn: string;
  marks: number;
  maxMarks: number;
  createdAt: string;
  /** #736: where the point came from; absent means a manual assessment. */
  source?: "assessment" | "homework";
};

/** #736: the case_homework columns that can become a gradebook point. */
export type HomeworkScoreRow = {
  id: string;
  title: string;
  reviewedAt: string | null;
  scorePct: number | null;
};

export type HomeworkScoreEntry = AssessmentScore & {
  id: string;
  name: string;
  source: "homework";
};

type ScoredHomework = HomeworkScoreRow & { reviewedAt: string; scorePct: number };

function isScoredHomework(row: HomeworkScoreRow): row is ScoredHomework {
  return row.reviewedAt !== null && row.scorePct !== null;
}

/**
 * #736: reviewed homework with a score becomes a gradebook point on its HKT
 * review day. Reviewed without a score, or not reviewed at all, contributes
 * nothing. Oldest first, then id, so the merged log is stable.
 */
export function homeworkScoreEntries(rows: readonly HomeworkScoreRow[]): HomeworkScoreEntry[] {
  return rows
    .filter(isScoredHomework)
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt) || a.id.localeCompare(b.id))
    .map((row) => ({
      id: `homework:${row.id}`,
      name: row.title,
      assessedOn: hktDateKey(new Date(row.reviewedAt)),
      marks: row.scorePct,
      maxMarks: HOMEWORK_SCORE_MAX,
      createdAt: row.reviewedAt,
      source: "homework",
    }));
}

export type ProgressSummary = {
  baseline: number | null;
  latest: number | null;
  /** Latest minus baseline; null until there are two scores. */
  delta: number | null;
  onTarget: boolean;
};

/** #736: one verified hours log row, dated to its HKT calendar day. */
export type HoursRow = {
  occurredOn: string;
  hours: number;
};

/** #736: a ledger row plus the running total through that row. */
export type HoursPoint = HoursRow & { cumulativeHours: number };

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

/**
 * #736: running total of verified hours, one point per ledger row, oldest
 * first. A lesson log read out of order still lands on the right day.
 */
export function cumulativeHours(rows: readonly HoursRow[]): HoursPoint[] {
  const points: HoursPoint[] = [];
  let total = 0;
  for (const row of [...rows].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))) {
    total = roundOne(total + row.hours);
    points.push({ occurredOn: row.occurredOn, hours: row.hours, cumulativeHours: total });
  }
  return points;
}

/**
 * #736: cumulative verified hours as of each score, in the order chartPoints
 * plots them (date, then logged time). A score on a lesson day includes that
 * day's hours.
 */
export function hoursAtScores<T extends AssessmentScore>(
  scores: readonly T[],
  hoursSeries: readonly HoursPoint[],
): number[] {
  const series = [...hoursSeries].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));
  return sortAssessments(scores).map((score) => {
    let total = 0;
    for (const row of series) {
      if (row.occurredOn > score.assessedOn) break;
      total = row.cumulativeHours;
    }
    return roundOne(total);
  });
}

/**
 * #736: bar heights for the chart, where the case's whole verified total is
 * 100%. Aligned 1:1 with the plotted score points.
 */
export function hoursBars(
  scores: readonly AssessmentScore[],
  hoursSeries: readonly HoursPoint[],
): { pctOfMax: number }[] {
  const total = hoursSeries.reduce((sum, row) => sum + row.hours, 0);
  return hoursAtScores(scores, hoursSeries).map((hours) => ({
    pctOfMax: total > 0 ? roundOne((hours / total) * 100) : 0,
  }));
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
