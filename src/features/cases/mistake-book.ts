/**
 * Issue #796 §2.2 — Digital Mistake Book (錯題本), pure half.
 *
 * Everything the server fns and the Case Workspace UI must agree on lives
 * here (vitest-covered): the locked error-reason pills, the
 * Unresolved → Practiced Once → Mastered lifecycle, the 2 × 5 MB image rule,
 * the draft validation and the resolved counter.
 *
 * Deliberately NOT here (MUST NOT for this ticket): OCR / LaTeX calls, spaced
 * repetition scheduling, public sharing and any past-paper database. The
 * 5 MB per-image cap is this module's own and is independent of the #785
 * 50 MB case-file cap — never raise or lower either by borrowing the other.
 */

import { normalizeTopicTag } from "@/features/cases/super-drawer/super-drawer-logic";

// ---------------------------------------------------------------------------
// Locked vocabulary
// ---------------------------------------------------------------------------

/** The REQUIRED error-reason pill. Copy keys: mistakes.reason_<value>. */
export const MISTAKE_ERROR_REASONS = [
  "concept_gap",
  "careless_mistake",
  "exam_keyword",
  "time_management",
] as const;
export type MistakeErrorReason = (typeof MISTAKE_ERROR_REASONS)[number];

/** Unresolved / 待重溫 → Practiced Once / 已重做一次 → Mastered / 已完全掌握. */
export const MISTAKE_STATUSES = ["unresolved", "practiced_once", "mastered"] as const;
export type MistakeStatus = (typeof MISTAKE_STATUSES)[number];

/** Who is acting. Learners may only move FORWARD; tutors/ops may correct. */
export type MistakeActor = "learner" | "tutor" | "ops";

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

export const MISTAKE_TITLE_MAX = 120;
export const MISTAKE_SOURCE_MAX = 120;
export const MISTAKE_TEXT_MAX = 2000;
export const MISTAKE_TIP_MAX = 1000;
export const MISTAKE_TAG_MAX = 60;

/**
 * ≤2 images × 5 MB (question + solution). Separate from — and never merged
 * with — the #785 50 MB case-file cap.
 */
export const MISTAKE_MAX_IMAGES = 2;
export const MISTAKE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MISTAKE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type MistakeImageType = (typeof MISTAKE_IMAGE_TYPES)[number];

// ---------------------------------------------------------------------------
// Image validation (client mirrors the server; the server is the gate)
// ---------------------------------------------------------------------------

export type MistakeImageError = "IMAGE_TOO_LARGE" | "IMAGE_TYPE";

/**
 * JPG / PNG / WEBP only, ≤5 MB. A PDF (e.g. a 20-page booklet scan) fails on
 * type, an oversized photo fails on size — both surface the bilingual
 * size / crop copy in the UI (mistakes.err_IMAGE_TOO_LARGE / err_IMAGE_TYPE).
 */
export function mistakeImageError(file: {
  contentType: string;
  size: number;
}): MistakeImageError | null {
  const type = (file.contentType ?? "").toLowerCase().split(";")[0].trim();
  if (!(MISTAKE_IMAGE_TYPES as readonly string[]).includes(type)) return "IMAGE_TYPE";
  if (!Number.isFinite(file.size) || file.size <= 0) return "IMAGE_TYPE";
  if (file.size > MISTAKE_IMAGE_MAX_BYTES) return "IMAGE_TOO_LARGE";
  return null;
}

/** Human-facing MB label used by the size copy (5 MB, never 5.0 MB). */
export function mistakeImageCapMb(): number {
  return Math.round(MISTAKE_IMAGE_MAX_BYTES / (1024 * 1024));
}

// ---------------------------------------------------------------------------
// Status lifecycle + resolved counter
// ---------------------------------------------------------------------------

const STATUS_RANK: Record<MistakeStatus, number> = {
  unresolved: 0,
  practiced_once: 1,
  mastered: 2,
};

export function isMistakeStatus(value: unknown): value is MistakeStatus {
  return (MISTAKE_STATUSES as readonly unknown[]).includes(value);
}

/** The natural next status, or null when already Mastered. */
export function nextMistakeStatus(status: MistakeStatus): MistakeStatus | null {
  if (status === "unresolved") return "practiced_once";
  if (status === "practiced_once") return "mastered";
  return null;
}

/**
 * Is `target` allowed for this actor?
 * Learners advance only (Unresolved → Practiced Once → Mastered, and may skip
 * to Mastered once they have redone it); tutors and Ops may correct in either
 * direction. A no-op (same status) is always allowed.
 */
export function canSetMistakeStatus(
  current: MistakeStatus,
  target: MistakeStatus,
  actor: MistakeActor,
): boolean {
  if (current === target) return true;
  if (actor !== "learner") return true;
  return STATUS_RANK[target] > STATUS_RANK[current];
}

// ---------------------------------------------------------------------------
// Draft validation (Add form)
// ---------------------------------------------------------------------------

export type MistakeDraft = {
  title: string;
  errorReason: MistakeErrorReason | null;
  questionText: string;
  questionImagePath: string | null;
  topicTag: string | null;
};

export type MistakeDraftError = "TITLE_REQUIRED" | "REASON_REQUIRED" | "QUESTION_REQUIRED";

/**
 * The Add form's required set: a title, an error-reason pill and a question
 * (text and/or one image). Everything else — source, #tag, correction, tutor
 * tip — is optional, so a student can file a mistake in under a minute.
 */
export function mistakeDraftError(draft: MistakeDraft): MistakeDraftError | null {
  if (!draft.title.trim()) return "TITLE_REQUIRED";
  if (
    !draft.errorReason ||
    !(MISTAKE_ERROR_REASONS as readonly string[]).includes(draft.errorReason)
  )
    return "REASON_REQUIRED";
  if (!draft.questionText.trim() && !draft.questionImagePath) return "QUESTION_REQUIRED";
  return null;
}

/** `#QuadraticEquations` → `QuadraticEquations` (same #767 normalisation). */
export function normalizeMistakeTag(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return normalizeTopicTag(raw);
}

// ---------------------------------------------------------------------------
// Reading the book
// ---------------------------------------------------------------------------

export type MistakeCounter = {
  total: number;
  unresolved: number;
  practicedOnce: number;
  mastered: number;
  /** The resolved counter: Mastered items only. */
  resolved: number;
};

/** One pass over the rows — the counter can never desync from the list. */
export function mistakeCounts(rows: readonly { status: MistakeStatus }[]): MistakeCounter {
  let unresolved = 0;
  let practicedOnce = 0;
  let mastered = 0;
  for (const row of rows) {
    if (row.status === "unresolved") unresolved += 1;
    else if (row.status === "practiced_once") practicedOnce += 1;
    else mastered += 1;
  }
  return {
    total: rows.length,
    unresolved,
    practicedOnce,
    mastered,
    resolved: mastered,
  };
}

/**
 * Revision Mode (Hide Solutions): a card shows its solution only when the
 * global mode is off OR that card was individually revealed. Answers are
 * hidden by DEFAULT the moment the mode turns on.
 */
export function solutionVisible(
  revealMode: boolean,
  revealed: ReadonlySet<string>,
  id: string,
): boolean {
  return !revealMode || revealed.has(id);
}

/**
 * Progressive reveal: the book (and its Add form) opens once the case has a
 * verified Lesson 1 — same predicate the review gates use.
 */
export function mistakeBookRevealed(verifiedLessonCount: number): boolean {
  return verifiedLessonCount >= 1;
}

// ---------------------------------------------------------------------------
// Filtering (#741: filter entries by Topic, Error Cause, Status)
// ---------------------------------------------------------------------------

/** "all" / null on any axis means "no constraint on this axis". */
export type MistakeFilters = {
  topic: string | null;
  reason: MistakeErrorReason | "all";
  status: MistakeStatus | "all";
};

export const NO_MISTAKE_FILTERS: MistakeFilters = {
  topic: null,
  reason: "all",
  status: "all",
};

/** True when at least one axis actually narrows the list. */
export function hasMistakeFilters(filters: MistakeFilters): boolean {
  return (
    (filters.topic ?? "").trim().length > 0 || filters.reason !== "all" || filters.status !== "all"
  );
}

/**
 * Client-side filter over the already-fetched rows. The axes AND together;
 * a blank topic, "all" reason or "all" status constrains nothing. Topic
 * matching trims and ignores case, so a `QUADRATICS` filter finds a
 * `Quadratics` row. An empty result is a valid answer, never an error.
 */
export function filterMistakes<
  T extends {
    topicTag: string | null;
    errorReason: MistakeErrorReason;
    status: MistakeStatus;
  },
>(rows: readonly T[], filters: MistakeFilters): T[] {
  const topic = (filters.topic ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (topic && (row.topicTag ?? "").trim().toLowerCase() !== topic) return false;
    if (filters.reason !== "all" && row.errorReason !== filters.reason) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    return true;
  });
}

/** The distinct, sorted #tags present in the rows — the Topic select's options. */
export function mistakeTopicOptions(rows: readonly { topicTag: string | null }[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const tag = (row.topicTag ?? "").trim();
    if (tag) seen.add(tag);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Newest first, unresolved before resolved at the same timestamp so the next
 * thing to revise is at the top of the tab.
 */
export function sortMistakes<T extends { createdAt: string; status: MistakeStatus; id: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (byDate !== 0) return byDate;
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    return a.id.localeCompare(b.id);
  });
}
