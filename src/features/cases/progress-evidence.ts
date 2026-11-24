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
 *
 * Scale names match `case_progress_checkpoints.scale_type` exactly, so a row
 * reads into a rule with no mapping table in between.
 */

export type ScaleType = "dse" | "ibdp" | "igcse" | "alevel" | "letter" | "percent";

export type CheckpointType =
  | "school_quiz"
  /** Public alias of "school_quiz": the card must never carry a school word. */
  | "quiz"
  | "term_exam"
  | "mock"
  | "predicted"
  | "public_exam";

/**
 * `tutor_unconfirmed` is a tutor-entered row the parent has not yet tapped to
 * confirm. It is stored, it is visible to the case parties, and it never
 * publishes.
 */
export type VerificationKind = "parent_attested" | "desk_checked" | "tutor_unconfirmed";

export type Checkpoint = {
  type: CheckpointType;
  scale: ScaleType;
  /** The value in the native scale: "5**", "7", "9", "A*", "B", "82%". */
  value: string;
  /** YYYY-MM, the month the assessment was sat. */
  month: string;
  /** Omitted means "judge this row as the card-level verification". */
  verification?: VerificationKind;
};

/** §2.6: a card is 2–4 checkpoints. Four is the hard ceiling per case. */
export const MAX_CHECKPOINTS_PER_CASE = 4;
export const MIN_PUBLIC_CHECKPOINTS = 2;

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

/** The two verification states that may appear on /u/{handle}. */
export function isPublicVerification(kind: VerificationKind | undefined): boolean {
  return kind === "parent_attested" || kind === "desk_checked";
}

/** Values each scale actually allows; anything else is a validation failure. */
const SCALE_VALUES: Record<ScaleType, string[]> = {
  dse: ["1", "2", "3", "4", "5", "5*", "5**"],
  ibdp: ["1", "2", "3", "4", "5", "6", "7"],
  igcse: ["9", "8", "7", "6", "5", "4", "3", "2", "1"],
  alevel: ["A*", "A", "B", "C", "D", "E"],
  letter: ["A", "B", "C", "D", "E", "F"],
  percent: [],
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidScaleValue(scale: ScaleType, value: string): boolean {
  const normalised = value.trim().toUpperCase();
  if (scale === "percent") {
    const number = Number(normalised.replace("%", ""));
    return Number.isFinite(number) && number >= 0 && number <= 100;
  }
  return SCALE_VALUES[scale].includes(normalised);
}

/**
 * Ordinal INSIDE one scale, for ordering only. Never rendered, never compared
 * across scales, never aggregated — §2.6 bans a normalised cross-curriculum
 * index and an "average jump" marketing number.
 */
export function scaleValueToNumeric(scale: ScaleType, value: string): number | null {
  const normalised = value.trim().toUpperCase();
  if (scale === "percent") {
    const number = Number(normalised.replace("%", ""));
    return Number.isFinite(number) ? number : null;
  }
  if (scale === "dse") {
    if (normalised === "5**") return 7;
    if (normalised === "5*") return 6;
    const number = Number(normalised);
    return Number.isFinite(number) ? number : null;
  }
  if (scale === "alevel" || scale === "letter") {
    const ladder: Record<string, number> = { "A*": 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
    return ladder[normalised] ?? null;
  }
  const number = Number(normalised);
  return Number.isFinite(number) ? number : null;
}

/** Every point on the card must share one scale (AC-730-5). */
export function sameScale(checkpoints: readonly Checkpoint[]): boolean {
  return new Set(checkpoints.map((p) => p.scale)).size <= 1;
}

/** Days between an ISO date and an assessment month (positive = after). */
function daysBetween(iso: string, month: string): number {
  const from = Date.parse(iso);
  const to = Date.parse(`${month}-01T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.NaN;
  return (to - from) / 86_400_000;
}

/** Whole months between two ISO instants, floored, never negative. */
export function monthsBetween(fromIso: string | null, toIso: string | null): number {
  if (!fromIso || !toIso) return 0;
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.floor((to - from) / (86_400_000 * 30.4375)));
}

export type WindowContext = {
  /** ISO date of the first completed lesson. */
  firstLessonAt: string;
  /** ISO date of the last completed lesson; null while the case is running. */
  lastLessonAt: string | null;
  /** The earliest checkpoint on the card — the only one allowed before Lesson 1. */
  isBaseline?: boolean;
};

/**
 * The §2.6 date windows:
 *  - a baseline may be dated up to 60 days BEFORE Lesson 1;
 *  - a public exam may be dated up to 120 days AFTER the last completed lesson;
 *  - any other point may be dated up to 60 days after the last completed lesson;
 *  - a case with no last lesson has no upper bound.
 */
export function checkpointWindowOk(point: Checkpoint, context: WindowContext): boolean {
  if (context.isBaseline) {
    const beforeFirstLesson = daysBetween(context.firstLessonAt, point.month);
    if (Number.isFinite(beforeFirstLesson) && beforeFirstLesson < -EDGE_WINDOW_DAYS) return false;
  }
  if (!context.lastLessonAt) return true;
  const afterLastLesson = daysBetween(context.lastLessonAt, point.month);
  if (!Number.isFinite(afterLastLesson)) return true;
  const limit = point.type === "public_exam" ? PUBLIC_EXAM_WINDOW_DAYS : EDGE_WINDOW_DAYS;
  return afterLastLesson <= limit;
}

/**
 * "Predicted → Predicted only" is not evidence: two forecasts do not show a
 * result, so such a card never publishes (AC-730-2). Any card made only of
 * predicted points is blocked, not just the two-point case.
 */
export function isPredictedOnlyPair(checkpoints: readonly Checkpoint[]): boolean {
  return (
    checkpoints.length >= MIN_PUBLIC_CHECKPOINTS && checkpoints.every((p) => p.type === "predicted")
  );
}

/** The whole set must sit inside the windows, with the earliest point as baseline. */
function withinWindows(points: readonly Checkpoint[], context: WindowContext): boolean {
  const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month));
  const baselineMonth = sorted[0]?.month;
  return sorted.every((point) =>
    checkpointWindowOk(point, {
      firstLessonAt: context.firstLessonAt,
      lastLessonAt: context.lastLessonAt,
      isBaseline: point.month === baselineMonth,
    }),
  );
}

export type PublicCardMatch = {
  /** The parent (or adult student) allows anonymous public display. */
  anonymousShareConsent: boolean;
  tenure: TenureInput;
  firstLessonAt: string;
  lastLessonAt: string | null;
};

export type CardCandidate = PublicCardMatch & {
  checkpoints: Checkpoint[];
  verification: VerificationKind;
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
 * Every reason a card may NOT publish, from ROW-LEVEL verification up. Reasons
 * are returned together so the tutor sees the whole list rather than one at a
 * time. Unverified rows are dropped from the card rather than blocking it, so a
 * tutor's unconfirmed draft cannot suppress a genuine parent-attested pair —
 * but a card with NOTHING verified is blocked as `unverified`.
 */
export function publicCardEligible(
  checkpoints: readonly Checkpoint[],
  matches: PublicCardMatch,
): CardVerdict {
  const points = [...checkpoints];
  const verified = points.filter((p) => isPublicVerification(p.verification));

  if (points.length > 0 && verified.length === 0) {
    return { publishable: false, reasons: ["unverified"] };
  }

  const reasons: CardBlockReason[] = [];

  if (verified.length < MIN_PUBLIC_CHECKPOINTS) reasons.push("too_few_checkpoints");
  if (!sameScale(points)) reasons.push("mixed_scales");
  if (points.some((p) => !isValidScaleValue(p.scale, p.value))) reasons.push("bad_scale_value");
  if (points.some((p) => !MONTH_PATTERN.test(p.month))) reasons.push("bad_month");

  if (!matches.anonymousShareConsent) reasons.push("no_consent");
  if (!meetsTenureFloor(matches.tenure)) reasons.push("below_tenure_floor");

  if (isPredictedOnlyPair(verified)) reasons.push("predicted_only");

  if (verified.length > 0 && !withinWindows(verified, matches)) reasons.push("outside_windows");

  return reasons.length === 0 ? { publishable: true } : { publishable: false, reasons };
}

export type NewCheckpointRejection =
  "invalid_scale_value" | "bad_month" | "checkpoint_limit" | "scale_mismatch";

/**
 * The write-side gate, shared by the server fn and vitest: a new point must be
 * a legal value on the card's ONE scale, and the card may hold at most four.
 * Returning a reason (instead of throwing) keeps the message stable across the
 * case page, the tutor hub and any later import path.
 */
export function validateNewCheckpoint(
  existing: readonly Checkpoint[],
  next: Checkpoint,
): { ok: true } | { ok: false; reason: NewCheckpointRejection } {
  if (!isValidScaleValue(next.scale, next.value)) {
    return { ok: false, reason: "invalid_scale_value" };
  }
  if (!MONTH_PATTERN.test(next.month)) return { ok: false, reason: "bad_month" };
  if (existing.length >= MAX_CHECKPOINTS_PER_CASE) {
    return { ok: false, reason: "checkpoint_limit" };
  }
  if (!sameScale([...existing, next])) return { ok: false, reason: "scale_mismatch" };
  return { ok: true };
}

/**
 * Card-level entry point kept for the desk/preview shapes that hold one
 * verification for the whole set. It expands that flag onto every row and
 * delegates, so there is exactly ONE rule engine.
 */
export function evaluateProgressCard(candidate: CardCandidate): CardVerdict {
  return publicCardEligible(
    candidate.checkpoints.map((p) => ({ ...p, verification: candidate.verification })),
    candidate,
  );
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

export type CardSummaryInput = {
  /** tutoring_cases.student_level ("S5", "Year 11"), never a name. */
  studentLevel: string | null;
  completedLessons: number;
  months: number;
};

/**
 * The auto-stamp from §2.6: "{level} student · {N} verified lessons ({M} mos)".
 * Counts and duration come from the case ledger, never from tutor input.
 */
export function cardSummary(input: CardSummaryInput): string {
  const level = (input.studentLevel ?? "").trim();
  const lessons = `${input.completedLessons} verified ${input.completedLessons === 1 ? "lesson" : "lessons"}`;
  const months = `(${input.months} ${input.months === 1 ? "mo" : "mos"})`;
  // "S5 student · 6 verified lessons (5 mos)" — the months are a parenthetical
  // suffix, not a third dot-separated segment.
  const base = level ? `${level} student · ${lessons}` : lessons;
  return `${base} ${months}`;
}

/** The locked non-guarantee disclaimer (EN + 繁中). Copy is fixed by §2.6. */
export const PROGRESS_DISCLAIMER =
  "Verified progress from one MatchMax case, shown in the original grading scale. Results vary, no grade is guaranteed. / 單一個案的核實進步，以原本評分尺度顯示。成績因人而異，不保證達標。";

// ---------------------------------------------------------------------------
// The public card shape. Assembled here (not in the server fn) so vitest can
// prove the shape carries no student identity and no proof pointer.
// ---------------------------------------------------------------------------

export type PublicCardCase = {
  caseId: string;
  /** tutoring_cases.student_level — a year band, never a name or a school. */
  studentLevel: string | null;
  firstLessonAt: string;
  lastLessonAt: string | null;
  completedLessons: number;
  verifiedHours: number;
  /** Case-level anonymous-share consent; null = never consented. */
  consentAt: string | null;
};

export type PublicCardCheckpointRow = {
  assessmentType: CheckpointType;
  /** YYYY-MM-DD (first of the month) or YYYY-MM; both are accepted. */
  assessedOn: string;
  scaleType: ScaleType;
  scoreValue: string;
  label: string;
  verification: VerificationKind;
};

/**
 * The ONLY shape /u/{handle} may receive. Deliberately absent: student name,
 * initials, school, the author account, and `proof_key`.
 */
export type PublicProgressCard = {
  caseId: string;
  scale: ScaleType;
  verification: "parent_attested" | "desk_checked";
  /** Ascending by month, verified points only — the pills the UI renders. */
  checkpoints: Checkpoint[];
  /** "4 → 5*" in the native scale. Never a percentage or an average jump. */
  delta: string;
  summary: string;
  disclaimer: string;
  lastLessonAt: string | null;
};

function monthOf(assessedOn: string): string {
  return assessedOn.slice(0, 7);
}

/**
 * Returns null whenever the case may not render publicly: no consent, fewer
 * than two verified points, mixed scale, predicted-only, below the tenure
 * floor, or outside the §2.6 date windows.
 */
export function buildPublicCard(
  caseInput: PublicCardCase,
  rows: readonly PublicCardCheckpointRow[],
  now: Date = new Date(),
): PublicProgressCard | null {
  if (!caseInput.consentAt || rows.length === 0) return null;

  const all: Checkpoint[] = rows.map((row) => ({
    type: row.assessmentType,
    scale: row.scaleType,
    value: row.scoreValue,
    month: monthOf(row.assessedOn),
    verification: row.verification,
  }));

  const firstLessonMs = Date.parse(caseInput.firstLessonAt);
  const daysSinceFirstLesson = Number.isFinite(firstLessonMs)
    ? Math.max(0, Math.floor((now.getTime() - firstLessonMs) / 86_400_000))
    : 0;

  const verdict = publicCardEligible(all, {
    anonymousShareConsent: true,
    tenure: {
      completedLessons: caseInput.completedLessons,
      daysSinceFirstLesson,
      verifiedHours: caseInput.verifiedHours,
    },
    firstLessonAt: caseInput.firstLessonAt,
    lastLessonAt: caseInput.lastLessonAt,
  });
  if (!verdict.publishable) return null;

  const verified = rows
    .filter((row) => isPublicVerification(row.verification))
    .sort((a, b) => monthOf(a.assessedOn).localeCompare(monthOf(b.assessedOn)));
  if (verified.length < MIN_PUBLIC_CHECKPOINTS) return null;

  // The public shape carries no school identity at all, so the internal
  // "school_quiz" assessment type is published as the neutral "quiz".
  const publicType = (type: CheckpointType): CheckpointType =>
    type === "school_quiz" ? "quiz" : type;
  const checkpoints: Checkpoint[] = verified.map((row) => ({
    type: publicType(row.assessmentType),
    scale: row.scaleType,
    value: row.scoreValue,
    month: monthOf(row.assessedOn),
  }));

  const baseline = checkpoints[0];
  const latest = checkpoints[checkpoints.length - 1];

  return {
    caseId: caseInput.caseId,
    scale: latest.scale,
    verification: verified.some((row) => row.verification === "desk_checked")
      ? "desk_checked"
      : "parent_attested",
    checkpoints,
    delta: deltaLabel(baseline, latest),
    summary: cardSummary({
      studentLevel: caseInput.studentLevel,
      completedLessons: caseInput.completedLessons,
      months: monthsBetween(caseInput.firstLessonAt, caseInput.lastLessonAt ?? now.toISOString()),
    }),
    disclaimer: PROGRESS_DISCLAIMER,
    lastLessonAt: caseInput.lastLessonAt,
  };
}
