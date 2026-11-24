/**
 * #794 §2.6 (was #730) — Student Progress Evidence server fns.
 *
 * The unit of proof is a verified MatchMax case delta. Every rule lives in
 * ./progress-evidence.ts (pure, vitest-covered); this file is I/O plus the
 * party gate, so the case page, the desk and /u/{handle} cannot disagree.
 *
 * Privacy invariants (PDPO, §2.6):
 *  - `proof_key` is NEVER selected by anything in this file. There is no public
 *    read of the column and no sidebar path to it.
 *  - No public shape carries a student name, initials, school, author account
 *    or proof pointer; `buildPublicCard` assembles that shape and a unit test
 *    pins it.
 *  - `case_progress_checkpoints` is service-role only (RLS enabled, no browser
 *    grants), so nothing here can be called around by a client query.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { isEligibleReviewLesson, type LessonConfirmRow } from "@/features/cases/case-reviews";
import { isChannelCardPublic } from "@/features/channels/channel.functions";
import {
  buildPublicCard,
  cardSummary,
  checkpointWindowOk,
  isPublicVerification,
  isValidScaleValue,
  meetsTenureFloor,
  monthsBetween,
  publicCardEligible,
  scaleValueToNumeric,
  sortPublicCards,
  type CardBlockReason,
  type Checkpoint,
  type CheckpointType,
  type PublicCardCase,
  type PublicCardCheckpointRow,
  type PublicProgressCard,
  type ScaleType,
  type TenureInput,
  type VerificationKind,
  validateNewCheckpoint,
} from "@/features/cases/progress-evidence";

const SCALE_TYPES = ["dse", "ibdp", "igcse", "alevel", "letter", "percent"] as const;
const ASSESSMENT_TYPES = ["school_quiz", "term_exam", "mock", "predicted", "public_exam"] as const;

/** YYYY-MM only: the UI never collects a day and the column stores the 1st. */
const MONTH_INPUT = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM");

type CaseRow = {
  id: string;
  parent_id: string;
  matched_tutor_id: string | null;
  student_level: string | null;
  sor_status: string | null;
  progress_share_consent_at: string | null;
};

type CheckpointDbRow = {
  id: string;
  case_id: string;
  created_by: string;
  author_side: "parent" | "tutor";
  assessment_type: CheckpointType;
  assessed_on: string;
  scale_type: ScaleType;
  score_value: string;
  score_numeric: number | null;
  label: string;
  verification: VerificationKind;
  parent_confirmed_at: string | null;
  created_at: string;
};

const CHECKPOINT_COLUMNS =
  "id, case_id, created_by, author_side, assessment_type, assessed_on, scale_type, score_value, score_numeric, label, verification, parent_confirmed_at, created_at";

/**
 * Explicit column list on purpose: `proof_key` is desk-only and must never
 * ride along on a party read. Add it to a desk-only query, never to this one.
 */
const CASE_COLUMNS =
  "id, parent_id, matched_tutor_id, student_level, sor_status, progress_share_consent_at";

type LessonRow = LessonConfirmRow & { starts_at: string };

const LESSON_COLUMNS = "status, confirmed_by_parent_at, confirmed_by_tutor_at, starts_at";

async function loadCase(db: Db, caseId: string): Promise<CaseRow | null> {
  const rows = await selectRows<CaseRow>(db, "tutoring_cases", CASE_COLUMNS, [
    { col: "id", op: "eq", value: caseId },
  ]);
  return rows[0] ?? null;
}

async function isDeskStaff(db: Db, userId: string): Promise<boolean> {
  for (const role of ["admin", "super_admin", "staff"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

/** Which side of the case the caller is on, if any. Staff are neither. */
async function partySide(db: Db, userId: string, c: CaseRow): Promise<"parent" | "tutor" | null> {
  if (c.parent_id === userId) return "parent";
  if (!c.matched_tutor_id) return null;
  const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  return tutors[0]?.id === c.matched_tutor_id ? "tutor" : null;
}

async function requireCaseAccess(
  db: Db,
  userId: string,
  caseId: string,
): Promise<{ c: CaseRow; side: "parent" | "tutor" | "staff" }> {
  const c = await loadCase(db, caseId);
  if (!c) throw new Error("CASE_NOT_FOUND");
  const side = await partySide(db, userId, c);
  if (side) return { c, side };
  if (await isDeskStaff(db, userId)) return { c, side: "staff" };
  throw new Error("CASE_NOT_FOUND");
}

async function lessonsForCase(db: Db, caseId: string): Promise<LessonRow[]> {
  const rows = await selectRows<LessonRow>(db, "case_lessons", LESSON_COLUMNS, [
    { col: "case_id", op: "eq", value: caseId },
  ]);
  return rows.filter((l) => typeof l?.status === "string");
}

type CaseTiming = {
  completedLessons: number;
  firstLessonAt: string | null;
  lastLessonAt: string | null;
};

/** The same "completed lesson" predicate the rating gates use. */
function timingFromLessons(lessons: readonly LessonRow[]): CaseTiming {
  const done = lessons.filter(isEligibleReviewLesson);
  if (done.length === 0) return { completedLessons: 0, firstLessonAt: null, lastLessonAt: null };
  const stamps = done
    .map((l) => Date.parse(l.starts_at))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  return {
    completedLessons: done.length,
    firstLessonAt: stamps.length > 0 ? new Date(stamps[0]).toISOString() : null,
    lastLessonAt: stamps.length > 0 ? new Date(stamps[stamps.length - 1]).toISOString() : null,
  };
}

async function verifiedHoursForCase(db: Db, caseId: string): Promise<number> {
  const rows = await selectRows<{ duration_hours: number | string }>(
    db,
    "verified_hours_ledger",
    "duration_hours",
    [
      { col: "case_id", op: "eq", value: caseId },
      { col: "status", op: "eq", value: "verified_completed" },
    ],
  );
  return rows.reduce((sum, r) => sum + Number(r.duration_hours ?? 0), 0);
}

async function checkpointsForCase(db: Db, caseId: string): Promise<CheckpointDbRow[]> {
  return selectRows<CheckpointDbRow>(
    db,
    "case_progress_checkpoints",
    CHECKPOINT_COLUMNS,
    [{ col: "case_id", op: "eq", value: caseId }],
    { col: "assessed_on", asc: false },
  );
}

function tenureFor(timing: CaseTiming, verifiedHours: number, now: Date): TenureInput {
  return {
    completedLessons: timing.completedLessons,
    daysSinceFirstLesson: timing.firstLessonAt
      ? Math.max(0, Math.floor((now.getTime() - Date.parse(timing.firstLessonAt)) / 86_400_000))
      : 0,
    verifiedHours,
  };
}

function toCheckpoint(row: CheckpointDbRow): Checkpoint {
  return {
    type: row.assessment_type,
    scale: row.scale_type,
    value: row.score_value,
    month: row.assessed_on.slice(0, 7),
    verification: row.verification,
  };
}

export type ProgressCheckpointView = {
  id: string;
  caseId: string;
  authorSide: "parent" | "tutor";
  assessmentType: CheckpointType;
  /** YYYY-MM. */
  assessedOn: string;
  scaleType: ScaleType;
  scoreValue: string;
  scoreNumeric: number | null;
  label: string;
  verification: VerificationKind;
  parentConfirmedAt: string | null;
  createdAt: string;
};

function toView(row: CheckpointDbRow): ProgressCheckpointView {
  return {
    id: row.id,
    caseId: row.case_id,
    authorSide: row.author_side,
    assessmentType: row.assessment_type,
    assessedOn: row.assessed_on.slice(0, 7),
    scaleType: row.scale_type,
    scoreValue: row.score_value,
    scoreNumeric: row.score_numeric,
    label: row.label,
    verification: row.verification,
    parentConfirmedAt: row.parent_confirmed_at,
    createdAt: row.created_at,
  };
}

export type CaseProgressCheckpoints = {
  /** Case-level anonymous-share consent (AC-730-4). */
  consent: boolean;
  checkpoints: ProgressCheckpointView[];
  publicEligible: boolean;
  blockedReasons: CardBlockReason[];
  /** "{level} student · {N} verified lessons ({M} mos)" — never tutor-typed. */
  summary: string;
  tenure: TenureInput;
  firstLessonAt: string | null;
  lastLessonAt: string | null;
};

/**
 * The case page read. Party-gated (parent / matched tutor / staff) and returns
 * the computed public-eligibility flag so the workspace can render the same
 * reason the public path enforces instead of guessing.
 */
export const listCaseProgressCheckpoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseProgressCheckpoints> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c } = await requireCaseAccess(db, context.userId, data.caseId);

    const [rows, lessons, verifiedHours] = await Promise.all([
      checkpointsForCase(db, c.id),
      lessonsForCase(db, c.id),
      verifiedHoursForCase(db, c.id),
    ]);
    const timing = timingFromLessons(lessons);
    const now = new Date();
    const tenure = tenureFor(timing, verifiedHours, now);
    const checkpoints = rows.map(toCheckpoint);

    const verdict =
      timing.firstLessonAt && checkpoints.length > 0
        ? publicCardEligible(checkpoints, {
            anonymousShareConsent: Boolean(c.progress_share_consent_at),
            tenure,
            firstLessonAt: timing.firstLessonAt,
            lastLessonAt: timing.lastLessonAt,
          })
        : { publishable: false as const, reasons: ["below_tenure_floor"] as CardBlockReason[] };

    return {
      consent: Boolean(c.progress_share_consent_at),
      checkpoints: rows.map(toView),
      publicEligible: verdict.publishable,
      blockedReasons: verdict.publishable ? [] : verdict.reasons,
      summary: cardSummary({
        studentLevel: c.student_level,
        completedLessons: timing.completedLessons,
        months: monthsBetween(timing.firstLessonAt, timing.lastLessonAt ?? now.toISOString()),
      }),
      tenure,
      firstLessonAt: timing.firstLessonAt,
      lastLessonAt: timing.lastLessonAt,
    };
  });

/**
 * Log one checkpoint. Enforces, in this order:
 *  1. the caller is the case's parent or its matched tutor (author_side is
 *     DERIVED from that relation, never read from input);
 *  2. the native value is legal for the scale;
 *  3. ONE scale per case — a second scale on the same card is refused;
 *  4. at most MAX_CHECKPOINTS_PER_CASE (4) points;
 *  5. a public_exam point only after the tenure floor is met (§2.6 window rule);
 *  6. the §2.6 date windows (baseline ≤ 60 days before Lesson 1, latest ≤ 60
 *     days after the last lesson, public_exam ≤ 120 days after).
 */
export const logProgressCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        assessmentType: z.enum(ASSESSMENT_TYPES),
        assessedOn: MONTH_INPUT,
        scaleType: z.enum(SCALE_TYPES),
        scoreValue: z.string().trim().min(1).max(24),
        label: z.string().trim().max(80).default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ProgressCheckpointView> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, side } = await requireCaseAccess(db, context.userId, data.caseId);
    if (side === "staff") throw new Error("FORBIDDEN");

    if (!isValidScaleValue(data.scaleType, data.scoreValue)) throw new Error("INVALID_SCALE_VALUE");

    const [existing, lessons] = await Promise.all([
      checkpointsForCase(db, c.id),
      lessonsForCase(db, c.id),
    ]);

    const points = existing.map(toCheckpoint);
    const gate = validateNewCheckpoint(points, {
      type: data.assessmentType,
      scale: data.scaleType,
      value: data.scoreValue,
      month: data.assessedOn,
    });
    if (!gate.ok) {
      if (gate.reason === "checkpoint_limit") throw new Error("CHECKPOINT_LIMIT");
      if (gate.reason === "scale_mismatch") throw new Error("SCALE_MISMATCH");
      if (gate.reason === "bad_month") throw new Error("INVALID_ASSESSED_ON");
      throw new Error("INVALID_SCALE_VALUE");
    }

    const timing = timingFromLessons(lessons);
    // The earliest point on the card is the only one allowed to precede Lesson 1.
    const earliestMonth = points.reduce<string | null>(
      (min, p) => (min === null || p.month < min ? p.month : min),
      null,
    );
    const isBaseline = earliestMonth === null ? true : data.assessedOn < earliestMonth;

    if (data.assessmentType === "public_exam") {
      const verifiedHours = await verifiedHoursForCase(db, c.id);
      if (!meetsTenureFloor(tenureFor(timing, verifiedHours, new Date()))) {
        throw new Error("TENURE_FLOOR_NOT_MET");
      }
    }

    if (timing.firstLessonAt) {
      const ok = checkpointWindowOk(
        {
          type: data.assessmentType,
          scale: data.scaleType,
          value: data.scoreValue,
          month: data.assessedOn,
        },
        {
          firstLessonAt: timing.firstLessonAt,
          lastLessonAt: timing.lastLessonAt,
          isBaseline,
        },
      );
      if (!ok) throw new Error("OUTSIDE_WINDOW");
    }

    const now = new Date().toISOString();
    const row = {
      case_id: c.id,
      created_by: context.userId,
      author_side: side,
      assessment_type: data.assessmentType,
      assessed_on: `${data.assessedOn}-01`,
      scale_type: data.scaleType,
      score_value: data.scoreValue,
      score_numeric: scaleValueToNumeric(data.scaleType, data.scoreValue),
      label: data.label,
      // A tutor-entered row is private to the case until the parent taps it.
      verification: side === "parent" ? "parent_attested" : "tutor_unconfirmed",
      parent_confirmed_at: side === "parent" ? now : null,
    };

    const { data: inserted, error } = await db
      .from<CheckpointDbRow>("case_progress_checkpoints")
      .insert(row)
      .select(CHECKPOINT_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return toView(inserted);
  });

/**
 * The parent's one tap on a tutor-entered row (Parent-Attested). Only the
 * case's parent may confirm — a tutor cannot attest their own claim, and staff
 * use the desk-check path instead. Idempotent.
 */
export const confirmProgressCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<ProgressCheckpointView> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const rows = await selectRows<CheckpointDbRow>(
      db,
      "case_progress_checkpoints",
      CHECKPOINT_COLUMNS,
      [{ col: "id", op: "eq", value: data.id }],
    );
    const row = rows[0];
    if (!row) throw new Error("CHECKPOINT_NOT_FOUND");

    const c = await loadCase(db, row.case_id);
    if (!c || c.parent_id !== context.userId) throw new Error("CASE_NOT_FOUND");

    if (row.verification !== "tutor_unconfirmed") return toView(row);

    const now = new Date().toISOString();
    const { error } = await db
      .from<CheckpointDbRow>("case_progress_checkpoints")
      .update({ verification: "parent_attested", parent_confirmed_at: now })
      .eq("id", row.id);
    if (error) throw new Error(error.message);

    return { ...toView(row), verification: "parent_attested", parentConfirmedAt: now };
  });

/**
 * Anonymous-share consent (AC-730-4). The parent consents, and revoking clears
 * the stamp so the card stops rendering on the next load.
 */
export const setProgressShareConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid(), consent: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ consent: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, side } = await requireCaseAccess(db, context.userId, data.caseId);
    // Only the family may publish a case; the desk may act on their behalf.
    if (side === "tutor") throw new Error("FORBIDDEN");

    const consentAt = data.consent ? new Date().toISOString() : null;
    const { error } = await db
      .from<CaseRow>("tutoring_cases")
      .update({ progress_share_consent_at: consentAt })
      .eq("id", c.id);
    if (error) throw new Error(error.message);
    return { consent: Boolean(consentAt) };
  });

/**
 * Public read for /u/{handle}. Returns ONLY the public card shape — no student
 * identity, no school, no author, no proof pointer — and an empty array when
 * nothing qualifies (the section then hides entirely).
 *
 * One query per table for every case on the channel, so a tutor with a dozen
 * cases does not cost a dozen round trips.
 */
export const listPublicProgressCards = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ handle: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicProgressCard[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const profiles = await selectRows<{ id: string }>(db, "profiles", "id", [
      { col: "handle", op: "eq", value: data.handle.toLowerCase() },
    ]);
    const profile = profiles[0];
    if (!profile) return [];

    const tutors = await selectRows<{
      id: string;
      is_published: boolean | null;
      card_hidden_by_ban: boolean | null;
      owner_account_status: string | null;
    }>(db, "tutors", "id, is_published, card_hidden_by_ban, owner_account_status", [
      { col: "user_id", op: "eq", value: profile.id },
    ]);
    const tutor = tutors[0];
    if (!tutor) return [];
    if (
      !isChannelCardPublic({
        isPublished: tutor.is_published,
        cardHiddenByBan: tutor.card_hidden_by_ban,
        ownerAccountStatus: tutor.owner_account_status,
      })
    ) {
      return [];
    }

    const cases = await selectRows<{
      id: string;
      student_level: string | null;
      sor_status: string | null;
      progress_share_consent_at: string | null;
    }>(db, "tutoring_cases", "id, student_level, sor_status, progress_share_consent_at", [
      { col: "matched_tutor_id", op: "eq", value: tutor.id },
    ]);

    // A rematch is a NEW case row, so a replaced case's evidence is retired
    // with it. Everything else — running or closed — may carry a card.
    const eligibleCases = cases.filter(
      (c) => Boolean(c.progress_share_consent_at) && c.sor_status !== "replaced",
    );
    if (eligibleCases.length === 0) return [];

    const caseIds = eligibleCases.map((c) => c.id);
    const [checkpointRows, lessonRows, ledgerRows] = await Promise.all([
      selectRows<CheckpointDbRow>(db, "case_progress_checkpoints", CHECKPOINT_COLUMNS, [
        { col: "case_id", op: "in", value: caseIds },
      ]),
      selectRows<LessonRow & { case_id: string }>(
        db,
        "case_lessons",
        `case_id, ${LESSON_COLUMNS}`,
        [{ col: "case_id", op: "in", value: caseIds }],
      ),
      selectRows<{ case_id: string | null; duration_hours: number | string }>(
        db,
        "verified_hours_ledger",
        "case_id, duration_hours",
        [
          { col: "case_id", op: "in", value: caseIds },
          { col: "status", op: "eq", value: "verified_completed" },
        ],
      ),
    ]);

    const lessonsByCase = new Map<string, LessonRow[]>();
    for (const lesson of lessonRows) {
      const list = lessonsByCase.get(lesson.case_id) ?? [];
      list.push(lesson);
      lessonsByCase.set(lesson.case_id, list);
    }
    const hoursByCase = new Map<string, number>();
    for (const row of ledgerRows) {
      if (!row.case_id) continue;
      hoursByCase.set(
        row.case_id,
        (hoursByCase.get(row.case_id) ?? 0) + Number(row.duration_hours ?? 0),
      );
    }
    const checkpointsByCase = new Map<string, PublicCardCheckpointRow[]>();
    for (const row of checkpointRows) {
      const list = checkpointsByCase.get(row.case_id) ?? [];
      list.push({
        assessmentType: row.assessment_type,
        assessedOn: row.assessed_on,
        scaleType: row.scale_type,
        scoreValue: row.score_value,
        label: row.label,
        verification: row.verification,
      });
      checkpointsByCase.set(row.case_id, list);
    }

    const now = new Date();
    const cards: PublicProgressCard[] = [];
    for (const c of eligibleCases) {
      const timing = timingFromLessons(lessonsByCase.get(c.id) ?? []);
      // No completed lesson means no verified delta — nothing to show.
      if (!timing.firstLessonAt) continue;
      const cardCase: PublicCardCase = {
        caseId: c.id,
        studentLevel: c.student_level,
        firstLessonAt: timing.firstLessonAt,
        lastLessonAt: timing.lastLessonAt,
        completedLessons: timing.completedLessons,
        verifiedHours: hoursByCase.get(c.id) ?? 0,
        consentAt: c.progress_share_consent_at,
      };
      const card = buildPublicCard(cardCase, checkpointsByCase.get(c.id) ?? [], now);
      if (card) cards.push(card);
    }

    // Newest verified assessment first — never the biggest jump.
    return sortPublicCards(cards);
  });

/** Exported for the desk slice: does this row publish at all? */
export function checkpointPublishes(verification: VerificationKind): boolean {
  return isPublicVerification(verification);
}
