/**
 * #794 §2.1 — server core for the ratings loop.
 *
 * One shared implementation behind every submit path (parent case page, tutor
 * case hub, the post-Mark-done sheet) so the gates cannot drift:
 *  - the caller must be the case's parent (parent→tutor) or its matched tutor
 *    (tutor→parent);
 *  - ONE eligible completed lesson is required, and it is also what publishes;
 *  - one row per case per direction, edited in place;
 *  - the 14-day edit window / post-case-end freeze comes from
 *    rating-window.ts (pure, vitest-covered);
 *  - the optional private desk note lives on the row and is never returned by
 *    any public read (no RPC selects it, no client query touches the table);
 *  - before the first completed lesson the writer gets NO_ELIGIBLE_LESSON and
 *    the UI offers the private desk report instead.
 */

import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  isEligibleReviewLesson,
  validateReviewInput,
  type LessonConfirmRow,
} from "@/features/cases/case-reviews";
import { parentDisplayLineFromCase } from "@/features/cases/parent/review-flow";
import {
  DESK_REPORT_DETAIL_MAX,
  DESK_REPORT_REASONS,
  RATING_DESK_NOTE_MAX,
  evaluateRatingWindow,
  type DeskReportReason,
  type RatingWindowState,
} from "@/features/cases/rating-window";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;

export type RatingDirection = "parent_to_tutor" | "tutor_to_parent";

export type SaveCaseRatingInput = {
  caseId: string;
  direction: RatingDirection;
  rating: number;
  comment: string;
  deskNote: string;
};

export type CaseRatingState = {
  direction: RatingDirection;
  existing: {
    id: string;
    status: "visible" | "held" | "hidden";
    rating: number;
    comment: string;
    /** The author's private note to the desk, so an edit cannot wipe it. */
    deskNote: string;
    updated_at: string | null;
  } | null;
  window: RatingWindowState;
};

export type SaveCaseRatingResult = {
  direction: RatingDirection;
  status: "visible" | "held" | "hidden";
  heldReason: string | null;
  window: RatingWindowState;
};

type CaseRow = {
  id: string;
  parent_id: string | null;
  matched_tutor_id: string | null;
  sor_status: string | null;
  student_level: string | null;
  student_grade_current: string | null;
  exam_system: string | null;
  subjects: string[] | null;
  ended_by_parent_at: string | null;
  ended_by_tutor_at: string | null;
  updated_at: string | null;
};

async function loadCase(db: Db, caseId: string): Promise<CaseRow | null> {
  const { data } = await db
    .from<CaseRow>("tutoring_cases")
    .select(
      "id, parent_id, matched_tutor_id, sor_status, student_level, student_grade_current, exam_system, subjects, ended_by_parent_at, ended_by_tutor_at, updated_at",
    )
    .eq("id", caseId);
  const rows = (data ?? []) as CaseRow[];
  return rows[0] ?? null;
}

async function tutorRowForUser(db: Db, userId: string): Promise<{ id: string } | null> {
  const { data } = await db
    .from<{ id: string; user_id: string | null }>("tutors")
    .select("id, user_id")
    .eq("user_id", userId);
  const rows = (data ?? []) as { id: string; user_id: string | null }[];
  return rows[0] ?? null;
}

async function lessonsForCase(db: Db, caseId: string): Promise<LessonConfirmRow[]> {
  const { data } = await db
    .from<LessonConfirmRow>("case_lessons")
    .select("status, confirmed_by_parent_at, confirmed_by_tutor_at")
    .eq("case_id", caseId);
  return ((data ?? []) as LessonConfirmRow[]).filter((l) => typeof l?.status === "string");
}

type ReviewRow = {
  id: string;
  status: string;
  rating: number;
  comment: string;
  held_reason: string | null;
  desk_note: string | null;
  desk_note_at: string | null;
  updated_at: string | null;
  completed_lessons_at_write: number | null;
  author_account_id: string;
};

async function existingReview(
  db: Db,
  caseId: string,
  direction: RatingDirection,
): Promise<ReviewRow | null> {
  const { data } = await db
    .from<ReviewRow>("case_reviews")
    .select(
      "id, status, rating, comment, held_reason, desk_note, desk_note_at, updated_at, completed_lessons_at_write, author_account_id",
    )
    .eq("case_id", caseId)
    .eq("direction", direction)
    .in("status", ["visible", "held", "hidden"])
    .order("updated_at", { ascending: false })
    .limit(1);
  const rows = (data ?? []) as ReviewRow[];
  return rows[0] ?? null;
}

/** The case's end instant: the last side's End Case tap, else the row update. */
function caseEndedAt(c: CaseRow): string | null {
  if (c.sor_status !== "closed" && c.sor_status !== "replaced") return null;
  const candidates = [c.ended_by_parent_at, c.ended_by_tutor_at, c.updated_at]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map((v) => Date.parse(v))
    .filter((t) => !Number.isNaN(t));
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates)).toISOString();
}

async function authorize(
  db: Db,
  userId: string,
  c: CaseRow,
  direction: RatingDirection,
): Promise<void> {
  if (direction === "parent_to_tutor") {
    if (c.parent_id !== userId) throw new Error("CASE_NOT_FOUND");
    if (!c.matched_tutor_id) throw new Error("NO_TUTOR");
    return;
  }
  const tutor = await tutorRowForUser(db, userId);
  if (!tutor || c.matched_tutor_id !== tutor.id) throw new Error("CASE_NOT_FOUND");
}

function fmtWindow(direction: RatingDirection, w: RatingWindowState): RatingWindowState {
  // tutor→parent never publishes publicly, but the WRITE window is identical.
  return direction === "tutor_to_parent" ? { ...w, canPublish: false } : w;
}

/** Read the state the sheet needs (my row + whether the window is open). */
export async function getCaseRatingStateCore(
  db: Db,
  userId: string,
  caseId: string,
  direction: RatingDirection,
  now: Date = new Date(),
): Promise<CaseRatingState> {
  const c = await loadCase(db, caseId);
  if (!c) throw new Error("CASE_NOT_FOUND");
  await authorize(db, userId, c, direction);

  const [lessons, mine] = await Promise.all([
    lessonsForCase(db, c.id),
    existingReview(db, c.id, direction),
  ]);
  const eligible = lessons.filter((l) => isEligibleReviewLesson(l)).length;
  const window = fmtWindow(
    direction,
    evaluateRatingWindow({
      now,
      caseEndedAt: caseEndedAt(c),
      lastSavedAt: mine?.updated_at ?? null,
      eligibleLessonsNow: eligible,
      eligibleLessonsAtSave: mine?.completed_lessons_at_write ?? null,
    }),
  );

  return {
    direction,
    existing: mine
      ? {
          id: mine.id,
          status: mine.status === "held" ? "held" : mine.status === "hidden" ? "hidden" : "visible",
          rating: mine.rating,
          comment: mine.comment ?? "",
          deskNote: mine.desk_note ?? "",
          updated_at: mine.updated_at ?? null,
        }
      : null,
    window,
  };
}

/** Insert or edit-in-place the single row for this case + direction. */
export async function saveCaseRatingCore(
  db: Db,
  userId: string,
  input: SaveCaseRatingInput,
  now: Date = new Date(),
): Promise<SaveCaseRatingResult> {
  const c = await loadCase(db, input.caseId);
  if (!c) throw new Error("CASE_NOT_FOUND");
  await authorize(db, userId, c, input.direction);

  const [lessons, mine] = await Promise.all([
    lessonsForCase(db, c.id),
    existingReview(db, c.id, input.direction),
  ]);
  const eligible = lessons.filter((l) => isEligibleReviewLesson(l)).length;

  if (eligible < 1) throw new Error("NO_ELIGIBLE_LESSON");

  const window = fmtWindow(
    input.direction,
    evaluateRatingWindow({
      now,
      caseEndedAt: caseEndedAt(c),
      lastSavedAt: mine?.updated_at ?? null,
      eligibleLessonsNow: eligible,
      eligibleLessonsAtSave: mine?.completed_lessons_at_write ?? null,
    }),
  );
  if (!window.canWrite) throw new Error("REVIEW_FROZEN");

  const validity = validateReviewInput(input.direction, input.rating, input.comment);
  if (!validity.ok) throw new Error(validity.message);
  const contactHeld = validity.heldReasons.length > 0;

  const nowIso = now.toISOString();
  // The note is private to the desk and may have been written on an earlier
  // visit: an edit that does not mention it keeps it, and only an explicit
  // string (including "") replaces or clears it. Writing `null` over the row on
  // every star change was destroying the author's message to the desk.
  const nextDeskNote =
    input.deskNote === undefined
      ? (mine?.desk_note ?? null)
      : input.deskNote.trim().slice(0, RATING_DESK_NOTE_MAX) || null;
  const nextDeskNoteAt =
    input.deskNote === undefined ? (mine?.desk_note_at ?? null) : nextDeskNote ? nowIso : null;
  // A desk-hidden review stays hidden when its author edits it. Otherwise any
  // typo fix would silently republish a moderated row.
  const hidden = mine?.status === "hidden";
  const canHeld = contactHeld && !hidden;
  const nextStatus: "visible" | "held" | "hidden" = hidden
    ? "hidden"
    : canHeld
      ? "held"
      : "visible";
  const heldReason = hidden
    ? (mine?.held_reason ?? null)
    : canHeld
      ? `comment_held: ${validity.heldReasons.join(", ")}`
      : null;
  const row: Row = {
    case_id: c.id,
    lesson_id: null,
    direction: input.direction,
    author_account_id: userId,
    tutor_id: c.matched_tutor_id,
    rating: input.rating,
    // #205 contact filter: the star still publishes (CEO lock: one completed
    // lesson publishes), the flagged text never does. The desk sees the flag.
    comment: canHeld || (hidden && mine?.held_reason) ? "" : input.comment.trim(),
    author_display_line:
      input.direction === "parent_to_tutor" ? parentDisplayLineFromCase(c) : "Tutor",
    status: nextStatus,
    held_reason: heldReason,
    desk_note: nextDeskNote,
    desk_note_at: nextDeskNoteAt,
    completed_lessons_at_write: eligible,
    updated_at: nowIso,
  };

  if (mine) {
    const { error } = await db.from<Row>("case_reviews").update(row).eq("id", mine.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from<Row>("case_reviews").insert(row).select("id").single();
    if (error) throw new Error(error.message);
  }

  // Re-evaluate so the caller sees the fresh window (14 days from THIS save).
  const after = fmtWindow(
    input.direction,
    evaluateRatingWindow({
      now,
      caseEndedAt: caseEndedAt(c),
      lastSavedAt: nowIso,
      eligibleLessonsNow: eligible,
      eligibleLessonsAtSave: eligible,
    }),
  );

  return {
    direction: input.direction,
    status: nextStatus,
    heldReason,
    window: after,
  };
}

export type ReportCaseToDeskInput = {
  caseId: string;
  reason: DeskReportReason;
  detail: string;
};

/** Pre-lesson stop path: a private report to the desk, never a public review. */
export async function reportCaseToDeskCore(
  db: Db,
  userId: string,
  input: ReportCaseToDeskInput,
): Promise<{ ok: true }> {
  if (!DESK_REPORT_REASONS.includes(input.reason)) throw new Error("BAD_REASON");
  const c = await loadCase(db, input.caseId);
  if (!c) throw new Error("CASE_NOT_FOUND");

  const isParent = c.parent_id === userId;
  let isTutor = false;
  if (!isParent) {
    const tutor = await tutorRowForUser(db, userId);
    isTutor = Boolean(tutor && c.matched_tutor_id === tutor.id);
  }
  if (!isParent && !isTutor) throw new Error("CASE_NOT_FOUND");

  const { error } = await db.from<Row>("case_desk_reports").insert({
    case_id: c.id,
    author_account_id: userId,
    author_side: isParent ? "parent" : "tutor",
    reason: input.reason,
    detail: input.detail.trim().slice(0, DESK_REPORT_DETAIL_MAX),
    status: "open",
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
