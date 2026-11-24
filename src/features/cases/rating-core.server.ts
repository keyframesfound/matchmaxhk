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
 *
 * #702 anti-manipulation (all three live here so no submit path can skip them):
 *  - WEEKLY RATE CAP: a fresh row is refused with RATE_LIMITED once the caller
 *    already wrote RATING_WEEKLY_CAP rows in the rolling window. Editing the
 *    existing row for a case+direction is never capped (it writes no new row).
 *  - SELF-DEALING COLLISION: a rater whose profile shares the tutor's account,
 *    normalised phone or email does not publish — the row is written 'held'
 *    with held_reason 'self_deal: <signal>'.
 *  - BURST FLAG: a new five-star that would be the tutor's third published
 *    five-star inside the window, while the tutor has fewer than
 *    RATING_BURST_MIN_LESSONS completed lessons, is held for the desk and the
 *    existing ops webhook is pinged.
 *  Held rows never enter the public aggregate: the RPC counts status 'visible'
 *  only, and its legacy lazy-publish flips the two legacy reasons alone.
 */

import { normalizePhone } from "@/features/cases/import-plan";
import { normalizeContact } from "@/features/rosters/roster-logic";

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

/** #702 anti-manipulation caps — tune HERE, this is the one place ops edits. */
export const RATING_WEEKLY_CAP = 3;
/** Rolling window for every #702 counter (days). */
export const RATING_WEEKLY_WINDOW_DAYS = 7;
/** #702 burst: a new 5★ that would make this many published 5★ in the window… */
export const RATING_BURST_FIVE_STAR = 3;
/** …while the tutor has fewer than this many completed lessons → desk hold. */
export const RATING_BURST_MIN_LESSONS = 3;

const RATING_DAY_MS = 86_400_000;

function windowStartIso(now: Date): string {
  return new Date(now.getTime() - RATING_WEEKLY_WINDOW_DAYS * RATING_DAY_MS).toISOString();
}

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

const LESSON_COLUMNS = "status, confirmed_by_parent_at, confirmed_by_tutor_at";

async function lessonsForCase(db: Db, caseId: string): Promise<LessonConfirmRow[]> {
  const { data } = await db
    .from<LessonConfirmRow>("case_lessons")
    .select(LESSON_COLUMNS)
    .eq("case_id", caseId);
  return ((data ?? []) as LessonConfirmRow[]).filter((l) => typeof l?.status === "string");
}

/** Every completed lesson the tutor has recorded, across all their cases. */
async function tutorCompletedLessonCount(db: Db, tutorId: string): Promise<number> {
  const { data: cases } = await db
    .from<{ id: string }>("tutoring_cases")
    .select("id")
    .eq("matched_tutor_id", tutorId);
  const caseIds = ((cases ?? []) as { id: string }[]).map((c) => c.id);
  if (caseIds.length === 0) return 0;
  const { data } = await db
    .from<LessonConfirmRow>("case_lessons")
    .select(LESSON_COLUMNS)
    .in("case_id", caseIds);
  return ((data ?? []) as LessonConfirmRow[]).filter(isEligibleReviewLesson).length;
}

// ---------------------------------------------------------------------------
// #702 anti-manipulation helpers
// ---------------------------------------------------------------------------

/**
 * Distinct case+direction rows the caller INSERTED inside the window. Counted
 * once per case+direction (the unique index makes that one row), so editing an
 * existing row never moves the counter. `created_at` is the insert stamp —
 * updates only touch `updated_at`.
 */
async function recentAuthoredReviewCount(
  db: Db,
  userId: string,
  sinceIso: string,
): Promise<number> {
  const { data } = await db
    .from<{ case_id: string; direction: string }>("case_reviews")
    .select("case_id, direction")
    .eq("author_account_id", userId)
    .in("status", ["visible", "held", "hidden"])
    .gte("created_at", sinceIso);
  const keys = new Set(
    ((data ?? []) as { case_id: string; direction: string }[]).map(
      (r) => `${r.case_id}:${r.direction}`,
    ),
  );
  return keys.size;
}

/** The account behind a tutor card (null while the card has no login yet). */
async function tutorAccountUserId(db: Db, tutorId: string): Promise<string | null> {
  const { data } = await db
    .from<{ id: string; user_id: string | null }>("tutors")
    .select("id, user_id")
    .eq("id", tutorId);
  const rows = (data ?? []) as { id: string; user_id: string | null }[];
  return rows[0]?.user_id ?? null;
}

type ContactProfile = { id: string; email: string | null; phone: string | null };

async function contactProfile(db: Db, userId: string): Promise<ContactProfile | null> {
  const { data } = await db
    .from<ContactProfile>("profiles")
    .select("id, email, phone")
    .eq("id", userId);
  const rows = (data ?? []) as ContactProfile[];
  return rows[0] ?? null;
}

/**
 * Both helpers below are the EXISTING normalisers, not new ones: phone is the
 * #201/#205 collision key from import-plan.ts (digits with the +852 prefix
 * folded, already used for parent duplicate detection in byos), email is the
 * roster duplicate key from roster-logic.ts (lowercase canonical form).
 */
function samePhone(a: string | null, b: string | null): boolean {
  const x = normalizePhone(a ?? "");
  const y = normalizePhone(b ?? "");
  return x.length >= 8 && y.length >= 8 && x === y;
}

function sameEmail(a: string | null, b: string | null): boolean {
  const x = (a ?? "").trim();
  const y = (b ?? "").trim();
  if (!x.includes("@") || !y.includes("@")) return false;
  return normalizeContact(x) === normalizeContact(y);
}

export type SelfDealSignal = "account" | "phone" | "email";

/**
 * #702 self-dealing collision. There is no Stripe CUSTOMER fingerprint stored
 * for either side in this schema (the only Stripe column is
 * material_orders.stripe_payment_intent_id, which is per-order, not per-person),
 * so this compares the three signals that genuinely exist.
 */
async function findSelfDealSignal(
  db: Db,
  raterUserId: string,
  tutorUserId: string | null,
): Promise<SelfDealSignal | null> {
  if (!tutorUserId) return null;
  if (tutorUserId === raterUserId) return "account";
  const [rater, tutor] = await Promise.all([
    contactProfile(db, raterUserId),
    contactProfile(db, tutorUserId),
  ]);
  if (!rater || !tutor) return null;
  if (samePhone(rater.phone, tutor.phone)) return "phone";
  if (sameEmail(rater.email, tutor.email)) return "email";
  return null;
}

/** Published five-stars on the tutor inside the window, EXCLUDING this row. */
async function tutorRecentFiveStarCount(
  db: Db,
  tutorId: string,
  sinceIso: string,
  excludeReviewId: string | null,
): Promise<number> {
  const { data } = await db
    .from<{ id: string }>("case_reviews")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("direction", "parent_to_tutor")
    .eq("status", "visible")
    .eq("rating", 5)
    .gte("created_at", sinceIso);
  return ((data ?? []) as { id: string }[]).filter((r) => r.id !== excludeReviewId).length;
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

  // #702 WEEKLY RATE CAP. Only a NEW row is capped: editing the single
  // case+direction row is never a new write, so a cooling-off typo fix keeps
  // working however many cases the author has rated this week.
  if (!mine) {
    const used = await recentAuthoredReviewCount(db, userId, windowStartIso(now));
    if (used >= RATING_WEEKLY_CAP) throw new Error("RATE_LIMITED");
  }

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

  // #702 hold signals. Both only ever apply to the public direction: a
  // tutor→parent row never publishes, so holding it would be noise.
  let selfDeal: SelfDealSignal | null = null;
  let burst: { recentFiveStar: number; completedLessons: number } | null = null;
  if (input.direction === "parent_to_tutor" && !hidden && c.matched_tutor_id) {
    const tutorId = c.matched_tutor_id;
    const tutorUserId = await tutorAccountUserId(db, tutorId);
    selfDeal = await findSelfDealSignal(db, userId, tutorUserId);
    // A burst needs a five-star that would PUBLISH; a 1–4★ never trips it.
    if (input.rating === 5) {
      const recentFiveStar = await tutorRecentFiveStarCount(
        db,
        tutorId,
        windowStartIso(now),
        mine?.id ?? null,
      );
      if (recentFiveStar + 1 >= RATING_BURST_FIVE_STAR) {
        const completedLessons = await tutorCompletedLessonCount(db, tutorId);
        if (completedLessons < RATING_BURST_MIN_LESSONS) {
          burst = { recentFiveStar: recentFiveStar + 1, completedLessons };
        }
      }
    }
  }

  // Most severe signal first, so the desk reason names the root cause.
  const holdReasons: string[] = [];
  if (selfDeal) holdReasons.push(`self_deal: ${selfDeal}`);
  if (burst) holdReasons.push("burst: five_star_reviews");
  if (canHeld) holdReasons.push(`comment_held: ${validity.heldReasons.join(", ")}`);

  const nextStatus: "visible" | "held" | "hidden" = hidden
    ? "hidden"
    : holdReasons.length > 0
      ? "held"
      : "visible";
  const heldReason = hidden
    ? (mine?.held_reason ?? null)
    : holdReasons.length > 0
      ? holdReasons.join(", ")
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

  let reviewId = mine?.id ?? null;
  if (mine) {
    const { error } = await db.from<Row>("case_reviews").update(row).eq("id", mine.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db
      .from<{ id: string }>("case_reviews")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    reviewId = data?.id ?? null;
  }

  // #702 BURST FLAG: the desk already drinks from notifyOps (fee desk, trust
  // queue, applications), so reuse that channel rather than inventing one.
  // Never awaited — a webhook hiccup must not fail the author's save.
  if (burst && c.matched_tutor_id) {
    const { notifyOps } = await import("@/lib/ops-webhook.server");
    void notifyOps("case.rating_burst_hold", {
      case_id: c.id,
      review_id: reviewId,
      tutor_id: c.matched_tutor_id,
      rating: input.rating,
      recent_five_star: burst.recentFiveStar,
      tutor_completed_lessons: burst.completedLessons,
    }).catch(() => {});
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
