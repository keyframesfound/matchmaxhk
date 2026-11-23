/**
 * #794 §2.6 (was #730) — Student Progress Evidence, the CEO lock as pure rules.
 *
 * The unit of proof is a verified MatchMax case delta, never a gradebook and
 * never a free-text claim. This module decides whether a case's checkpoints
 * may render on /u/{handle}; it does no I/O so the desk, the profile and vitest
 * all read the same rules.
 *
 * Locks encoded here (2026-11-18):
 *  - two checkpoints minimum, all on ONE scale;
 *  - tenure floor 4 completed lessons OR 30 days since lesson 1 OR 6 verified hours;
 *  - Parent-Attested or Report-Card-Checked only; tutor-only claims stay private;
 *  - anonymous public share consent, revocable;
 *  - Predicted -> Predicted only never publishes;
 *  - public-exam checkpoints may land up to 120 days after the last lesson,
 *    a baseline up to 60 days before lesson 1, other latest points up to 60
 *    days after the last lesson.
 *
 * MUST NOT: normalise across curricula, compute an average jump, or rank a
 * tutor publicly by improvement rate. Those are product-level bans and the
 * shapes here deliberately carry no field for them.
 */

export type ScaleType = "hkdse" | "ibdp" | "igcse" | "alevel" | "letter" | "percentage";

export type CheckpointType = "school_quiz" | "term_exam" | "mock" | "predicted" | "public_exam";

export type VerificationKind = "parent_attested" | "desk_checked" | "tutor_unconfirmed";

export type Checkpoint = {
  type: CheckpointType;
  scale: ScaleType;
  /** The value in the native scale: "5**", "7", "9", "A*", "B", "82". */
  value: string;
  /** YYYY-MM, the month the assessment was sat. */
  month: string;
};

export const TENURE_MIN_LESSONS = 4;
export const TENURE_MIN_DAYS = 30;
export const TENURE_MIN_HOURS = 6;

/** Public-exam results may be logged this long after the last completed lesson. */
export const PUBLIC_EXAM_WINDOW_DAYS = 120;
/** A baseline may be dated this far before lesson 1, and other points this far after. */
export const EDGE_WINDOW_DAYS = 60;

export type TenureInput = {
  completedLessons: number;
  daysSinceFirstLesson: number;
  verifiedHours: number;
};

export function meetsTenureFloor(tenure: TenureInput): boolean {
  return (
    tenure.completedLessons >= TENURE_MIN_LESSONS ||
    tenure.daysSinceFirstLesson >= TENURE_MIN_DAYS ||
    tenure.verifiedHours >= TENURE_MIN_HOURS
  );
}

/** Values each scale actually allows; anything else is a validation failure. */
const SCALE_VALUES: Record<ScaleType, string[]> = {
  hkdse: ["1", "2", "3", "4", "5", "5*", "5**"],
  ibdp: ["1", "2", "3", "4", "5", "6", "7"],
  igcse: ["9", "8", "7", "6", "5", "4", "3", "2", "1"],
  alevel: ["A*", "A", "B", "C", "D", "E"],
  letter: ["A", "B", "C", "D", "E", "F"],
  percentage: [],
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidScaleValue(scale: ScaleType, value: string): boolean {
  const normalised = value.trim().toUpperCase();
  if (scale === "percentage") {
    const number = Number(normalised.replace("%", ""));
    return Number.isFinite(number) && number >= 0 && number <= 100;
  }
  return SCALE_VALUES[scale].includes(normalised);
}

/** Whole months between a lesson date and an assessment month, as days. */
function daysBetween(iso: string, month: string): number {
  const from = Date.parse(iso);
  const to = Date.parse(`${month}-01T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.NaN;
  return (to - from) / 86_400_000;
}

export type CardCandidate = {
  checkpoints: Checkpoint[];
  verification: VerificationKind;
  /** The parent (or adult student) allows anonymous public display. */
  anonymousShareConsent: boolean;
  tenure: TenureInput;
  /** ISO date of the first completed lesson. */
  firstLessonAt: string;
  /** ISO date of the last completed lesson; null while the case is running. */
  lastLessonAt: string | null;
};

export type CardVerdict =
  { publishable: true } | { publishable: false; reasons: CardBlockReason[] };

export type CardBlockReason =
  | "too_few_checkpoints"
  | "mixed_scales"
  | "bad_scale_value"
  | "bad_month"
  | "predicted_only"
  | "unverified"
  | "no_consent"
  | "below_tenure_floor"
  | "outside_windows";

/**
 * Every reason a card may NOT publish. Reasons are returned together so the
 * tutor sees the whole list rather than one at a time.
 */
export function evaluateProgressCard(candidate: CardCandidate): CardVerdict {
  const reasons: CardBlockReason[] = [];
  const points = candidate.checkpoints;

  if (points.length < 2) reasons.push("too_few_checkpoints");

  if (new Set(points.map((p) => p.scale)).size > 1) reasons.push("mixed_scales");

  if (points.some((p) => !isValidScaleValue(p.scale, p.value))) reasons.push("bad_scale_value");
  if (points.some((p) => !MONTH_PATTERN.test(p.month))) reasons.push("bad_month");

  // Parent-Attested / desk-checked only; a tutor's own numbers stay private.
  if (candidate.verification === "tutor_unconfirmed") reasons.push("unverified");
  if (!candidate.anonymousShareConsent) reasons.push("no_consent");
  if (!meetsTenureFloor(candidate.tenure)) reasons.push("below_tenure_floor");

  if (points.length >= 2 && points.every((p) => p.type === "predicted")) {
    reasons.push("predicted_only");
  }

  if (points.length > 0 && !withinWindows(points, candidate)) reasons.push("outside_windows");

  return reasons.length === 0 ? { publishable: true } : { publishable: false, reasons };
}

/**
 * A baseline may predate lesson 1 by up to 60 days; a non-public-exam latest
 * may trail the last lesson by up to 60 days; a public exam may land up to 120
 * days after it. A case with no last lesson has no upper bound.
 */
function withinWindows(points: Checkpoint[], candidate: CardCandidate): boolean {
  const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month));
  const baseline = sorted[0];
  const baselineGap = daysBetween(candidate.firstLessonAt, baseline.month);
  if (Number.isFinite(baselineGap) && baselineGap < -EDGE_WINDOW_DAYS) return false;

  if (!candidate.lastLessonAt) return true;

  for (const point of sorted.slice(1)) {
    const gap = daysBetween(candidate.lastLessonAt, point.month);
    if (!Number.isFinite(gap)) continue;
    const limit = point.type === "public_exam" ? PUBLIC_EXAM_WINDOW_DAYS : EDGE_WINDOW_DAYS;
    if (gap > limit) return false;
  }
  return true;
}

/**
 * Public ordering: most recent verified assessment first, never the biggest
 * jump. Ties fall back to the case's last-lesson date.
 */
export function sortPublicCards<
  T extends { checkpoints: Checkpoint[]; lastLessonAt: string | null },
>(cards: readonly T[]): T[] {
  const newest = (card: T) =>
    [...card.checkpoints].map((p) => p.month).sort((a, b) => b.localeCompare(a))[0] ?? "";
  return [...cards].sort(
    (a, b) =>
      newest(b).localeCompare(newest(a)) ||
      (b.lastLessonAt ?? "").localeCompare(a.lastLessonAt ?? ""),
  );
}

/** "Level 4 → Level 5*" without inventing a cross-curriculum number. */
export function deltaLabel(baseline: Checkpoint, latest: Checkpoint): string {
  return `${baseline.value} → ${latest.value}`;
}

/** The locked non-guarantee disclaimer (EN + 繁中). Copy is fixed by §2.6. */
export const PROGRESS_DISCLAIMER =
  "Verified progress from one MatchMax case, shown in the original grading scale. Results vary, no grade is guaranteed. / 單一個案的核實進步，以原本評分尺度顯示。成績因人而異，不保證達標。";
