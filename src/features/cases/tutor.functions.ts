/**
 * Issues #201 + #204 — tutor-side server fns: my cases + lesson actions,
 * weekly windows / blackouts (calendar), week view, Tutor Plus banner state.
 *
 * All tables in this slice are RLS-deny; everything runs on the service-role
 * client with the tutor gated by tutors.user_id = auth uid.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { CaseLessonRow, FeeStatus, SorStatus } from "@/features/cases/sor-db";
import {
  canMarkDone,
  cancelActionFor,
  hktFromParts,
  isActiveStudentCase,
  isRequestExpired,
  TUTOR_PLUS_THRESHOLD,
} from "@/features/cases/sor";
import { generateSlots, type GeneratedSlot } from "@/features/cases/slot";
import { validateReviewInput } from "@/features/cases/case-reviews";
import { sweepDueSessionLogs, type SessionLogRowT } from "@/features/cases/experience.functions";
import { REVIEW_COMMENT_MAX_TUTOR, REVIEW_COMMENT_MIN } from "@/features/cases/case-reviews";
import {
  countActiveStudents,
  firstNameOf,
  groupWeekByDay,
  validateWindows,
  type WeekDayGroup,
  type WeekLesson,
} from "@/features/cases/tutor/week-model";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;
type DbError = { message: string } | null;

/** The structural AdminTable has no delete; cast just that method per call. */
async function deleteRow(db: Db, table: string, col: string, value: unknown): Promise<void> {
  const tableAny = db.from<Row>(table) as unknown as {
    delete: (opts?: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: DbError }> };
  };
  const { error } = await tableAny.delete().eq(col, value);
  if (error) throw new Error(error.message);
}

async function selectRows<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: { col: string; op: "eq" | "in"; value: unknown }[],
  order?: { col: string; asc?: boolean; limit?: number },
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) {
    if (m.op === "eq") q = q.eq(m.col, m.value);
    else q = q.in(m.col, m.value as unknown[]);
  }
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (order?.limit) q = q.limit(order.limit);
  const { data } = await q;
  return (data ?? []) as T[];
}

/** Resolve the signed-in tutor's card id (throws when the account has no card). */
async function myTutorId(db: Db, userId: string): Promise<string> {
  const rows = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  if (rows.length === 0) throw new Error("NO_TUTOR_CARD");
  return rows[0].id;
}

async function insertAudit(
  db: Db,
  caseId: string,
  actorId: string | null,
  toStatus: string,
  reason: string | null,
  fromStatus: string | null = null,
): Promise<void> {
  await db
    .from<Row>("case_audit")
    .insert({
      case_id: caseId,
      actor_id: actorId,
      from_status: fromStatus,
      to_status: toStatus,
      reason,
    })
    .select("id")
    .single();
}

// ---------------------------------------------------------------------------
// My cases (#201 tutor list: student first name, subject, next lesson, station, fee status)
// ---------------------------------------------------------------------------

export type TutorCaseItem = {
  id: string;
  case_code: string;
  student_first_name: string;
  subject: string | null;
  exam_system: string | null;
  station: string | null;
  lesson_mode: string | null;
  sor_status: SorStatus | null;
  fee_status: FeeStatus | null;
  fee_amount_hkd: number | null;
  lessons: {
    id: string;
    sequence: number;
    starts_at: string;
    duration_min: number;
    status: string;
    created_at: string;
    confirmed_by_parent_at: string | null;
    confirmed_by_tutor_at: string | null;
    location_or_link: string | null;
  }[];
  /** #387 experience-log rows for this case (any status). */
  session_logs: SessionLogRowT[];
  /** #387: fee paid + dispute lock not hit → the log form may render. */
  can_log_session: boolean;
};

export const getMyTutorCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TutorCaseItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);

    // #387 lazy 72h auto-verify sweep: statuses are fresh before any read.
    await sweepDueSessionLogs(db);

    const cases = await selectRows<{
      id: string;
      case_code: string;
      title: string;
      subjects: string[] | null;
      exam_system: string | null;
      district: string | null;
      lesson_mode: string | null;
      sor_status: SorStatus | null;
      created_at: string;
    }>(
      db,
      "tutoring_cases",
      "id, case_code, title, subjects, exam_system, district, lesson_mode, sor_status, created_at",
      [{ col: "matched_tutor_id", op: "eq", value: tutorId }],
      { col: "created_at", asc: false, limit: 100 },
    );
    const mine = cases.filter((c) => c.sor_status !== null);
    if (mine.length === 0) return [];

    const caseIds = mine.map((c) => c.id);
    const [lessons, fees, sessionLogs] = await Promise.all([
      selectRows<{
        id: string;
        case_id: string;
        sequence: number;
        starts_at: string;
        duration_min: number;
        status: string;
        created_at: string;
        confirmed_by_parent_at: string | null;
        confirmed_by_tutor_at: string | null;
        location_or_link: string | null;
      }>(
        db,
        "case_lessons",
        "id, case_id, sequence, starts_at, duration_min, status, created_at, confirmed_by_parent_at, confirmed_by_tutor_at, location_or_link",
        [{ col: "case_id", op: "in", value: caseIds }],
        { col: "starts_at", asc: true },
      ),
      selectRows<{ case_id: string; amount_hkd: number; status: FeeStatus }>(
        db,
        "case_fees",
        "case_id, amount_hkd, status",
        [{ col: "case_id", op: "in", value: caseIds }],
      ),
      selectRows<SessionLogRowT>(
        db,
        "tutor_session_logs",
        "id, case_id, log_date, start_minute, duration_min, status, dispute_reason, created_at",
        [{ col: "case_id", op: "in", value: caseIds }],
        { col: "log_date", asc: false },
      ),
    ]);

    // #204: a slot request the tutor never confirmed within 12h expires —
    // lazy-cancel on read (idempotent: only still-planned rows are touched).
    const now = new Date();
    const expired = lessons.filter(
      (l) => l.status === "planned" && isRequestExpired(new Date(l.created_at), now),
    );
    if (expired.length > 0) {
      for (const l of expired) {
        const { error: expireError } = await db
          .from<Row>("case_lessons")
          .update({ status: "cancelled" })
          .eq("id", l.id);
        if (expireError) throw new Error(expireError.message);
        await insertAudit(db, l.case_id, null, "lesson_request_expired", null);
        l.status = "cancelled";
      }
    }

    const openFeeByCase = new Map<string, { status: FeeStatus; amount_hkd: number }>();
    for (const f of fees) {
      const existing = openFeeByCase.get(f.case_id);
      // #202: waived joins the visible set (invoiced, paid, waived) so the
      // Tutor home fee card can show it; refunded stays hidden — it is always
      // followed by a fresh invoice which ranks higher.
      const open =
        f.status === "not_due" ||
        f.status === "invoiced" ||
        f.status === "paid" ||
        f.status === "waived";
      if (open && (!existing || rankFee(f.status) > rankFee(existing.status))) {
        openFeeByCase.set(f.case_id, { status: f.status, amount_hkd: f.amount_hkd });
      }
    }

    return mine.map((c) => ({
      id: c.id,
      case_code: c.case_code,
      student_first_name: firstNameOf(c.title),
      subject: c.subjects?.[0] ?? null,
      exam_system: c.exam_system,
      station: c.district,
      lesson_mode: c.lesson_mode,
      sor_status: c.sor_status,
      fee_status: openFeeByCase.get(c.id)?.status ?? null,
      fee_amount_hkd: openFeeByCase.get(c.id)?.amount_hkd ?? null,
      lessons: lessons
        .filter((l) => l.case_id === c.id)
        .map((l) => ({
          id: l.id,
          sequence: l.sequence,
          starts_at: l.starts_at,
          duration_min: l.duration_min,
          status: l.status,
          created_at: l.created_at,
          confirmed_by_parent_at: l.confirmed_by_parent_at,
          confirmed_by_tutor_at: l.confirmed_by_tutor_at,
          location_or_link: l.location_or_link,
        })),
      // #387 experience log: list rows for every case; the FORM only opens
      // when the 1.5-lesson admin fee is paid and the dispute lock is not hit.
      session_logs: sessionLogs.filter((l) => l.case_id === c.id),
      can_log_session:
        openFeeByCase.get(c.id)?.status === "paid" &&
        sessionLogs.filter((l) => l.case_id === c.id && l.status === "disputed").length < 2 &&
        c.sor_status !== "replaced" &&
        c.sor_status !== "closed",
    }));
  });

/**
 * #202: which fee row wins when several exist for a case. At most one OPEN
 * fee (not_due/invoiced/paid) sits on a case (partial unique index), but a
 * waived row may precede a later invoice — the live one must win. Waived now
 * ranks last but is kept visible so the Tutor home can show it (#202 lists
 * invoiced, paid AND waived).
 */
export function rankFee(status: FeeStatus): number {
  return status === "invoiced" ? 3 : status === "not_due" ? 2 : status === "paid" ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Lesson actions (tutor side)
// ---------------------------------------------------------------------------

type LessonWithCase = CaseLessonRow & {
  tutoring_cases: { matched_tutor_id: string | null } | null;
};

async function myLesson(db: Db, lessonId: string, tutorId: string): Promise<LessonWithCase> {
  const rows = await selectRows<LessonWithCase>(
    db,
    "case_lessons",
    "*, tutoring_cases(matched_tutor_id)",
    [{ col: "id", op: "eq", value: lessonId }],
  );
  const lesson = rows[0];
  if (!lesson || lesson.tutoring_cases?.matched_tutor_id !== tutorId) {
    throw new Error("LESSON_NOT_FOUND");
  }
  return lesson;
}

export const confirmLessonTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lessonId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ status: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    const lesson = await myLesson(db, data.lessonId, tutorId);
    if (lesson.status !== "planned") throw new Error("NOT_PLANNED");
    // #204: a slot request unconfirmed for 12h has expired — no late confirms.
    if (isRequestExpired(new Date(lesson.created_at), new Date())) {
      throw new Error("REQUEST_EXPIRED");
    }

    const parentConfirmed = lesson.confirmed_by_parent_at !== null;
    const nextStatus = parentConfirmed ? "confirmed" : "planned";
    const { error } = await db
      .from<Row>("case_lessons")
      .update({ confirmed_by_tutor_at: new Date().toISOString(), status: nextStatus })
      .eq("id", lesson.id);
    if (error) throw new Error(error.message);
    return { status: nextStatus };
  });

export const declineLessonTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ lessonId: z.string().uuid(), reason: z.string().max(300).optional() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    const lesson = await myLesson(db, data.lessonId, tutorId);
    if (lesson.status !== "planned") throw new Error("NOT_PLANNED");

    const { error } = await db
      .from<Row>("case_lessons")
      .update({ status: "cancelled" })
      .eq("id", lesson.id);
    if (error) throw new Error(error.message);
    await insertAudit(
      db,
      lesson.case_id,
      context.userId,
      "lesson_cancelled",
      data.reason ?? "Tutor declined",
    );
    return { ok: true };
  });

export const markLessonDoneTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ lessonId: z.string().uuid(), privateNote: z.string().max(500).optional() })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    const lesson = await myLesson(db, data.lessonId, tutorId);
    if (lesson.status !== "planned" && lesson.status !== "confirmed") throw new Error("NOT_LIVE");
    // #204 mark-done window: 15 min before start until 7 days after.
    if (!canMarkDone(new Date(lesson.starts_at), new Date())) throw new Error("DONE_WINDOW_CLOSED");

    const { error } = await db
      .from<Row>("case_lessons")
      .update({
        status: "done",
        marked_done_by: context.userId,
        done_at: new Date().toISOString(),
        private_note: data.privateNote ?? null,
      })
      .eq("id", lesson.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelLessonTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lessonId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ status: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    const lesson = await myLesson(db, data.lessonId, tutorId);
    if (lesson.status !== "planned" && lesson.status !== "confirmed") throw new Error("NOT_LIVE");

    // #204: >12h before start -> cancelled (slot reopens); inside -> late_cancel.
    const status = cancelActionFor(new Date(lesson.starts_at), new Date());
    const { error } = await db.from<Row>("case_lessons").update({ status }).eq("id", lesson.id);
    if (error) throw new Error(error.message);
    await insertAudit(db, lesson.case_id, context.userId, `lesson_${status}`, "Tutor cancelled");
    return { status };
  });

// ---------------------------------------------------------------------------
// Weekly windows + blackouts (#204 — editing these never touches lessons)
// ---------------------------------------------------------------------------

export type WindowRow = {
  id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  station: string | null;
};

export const getMyWeeklyWindows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WindowRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    return selectRows<WindowRow>(
      db,
      "tutor_weekly_windows",
      "id, weekday, start_minute, end_minute, station",
      [{ col: "tutor_id", op: "eq", value: tutorId }],
      { col: "weekday", asc: true },
    );
  });

export const setMyWeeklyWindows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        windows: z
          .array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              start_minute: z.number().int().min(0).max(1440),
              end_minute: z.number().int().min(0).max(1440),
              station: z.string().max(60).nullable().optional(),
            }),
          )
          .max(40),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const errors = validateWindows(data.windows);
    if (errors.length > 0) throw new Error(errors[0]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);

    // Replace-all. Windows live in their own table — confirmed/planned lessons
    // are separate rows on case_lessons and are never touched here (#204:
    // "changing weekly hours must not delete a confirmed lesson").
    for (const existing of await selectRows<{ id: string }>(db, "tutor_weekly_windows", "id", [
      { col: "tutor_id", op: "eq", value: tutorId },
    ])) {
      await deleteRow(db, "tutor_weekly_windows", "id", existing.id);
    }
    for (const w of data.windows) {
      const { error } = await db
        .from<Row>("tutor_weekly_windows")
        .insert({
          tutor_id: tutorId,
          weekday: w.weekday,
          start_minute: w.start_minute,
          end_minute: w.end_minute,
          station: w.station ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export type BlackoutRowT = { id: string; blackout_date: string; reason: string | null };

export const getMyBlackouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BlackoutRowT[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    return selectRows<BlackoutRowT>(
      db,
      "tutor_blackout_dates",
      "id, blackout_date, reason",
      [{ col: "tutor_id", op: "eq", value: tutorId }],
      { col: "blackout_date", asc: true },
    );
  });

export const addMyBlackout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().max(140).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    // UNIQUE(tutor_id, blackout_date) — upsert semantics: replace any reason.
    for (const existing of await selectRows<{ id: string }>(db, "tutor_blackout_dates", "id", [
      { col: "tutor_id", op: "eq", value: tutorId },
      { col: "blackout_date", op: "eq", value: data.date },
    ])) {
      await deleteRow(db, "tutor_blackout_dates", "id", existing.id);
    }
    const { error } = await db
      .from<Row>("tutor_blackout_dates")
      .insert({ tutor_id: tutorId, blackout_date: data.date, reason: data.reason ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMyBlackout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    const owned = await selectRows<{ id: string }>(db, "tutor_blackout_dates", "id", [
      { col: "id", op: "eq", value: data.id },
      { col: "tutor_id", op: "eq", value: tutorId },
    ]);
    if (owned.length === 0) throw new Error("NOT_FOUND");
    await deleteRow(db, "tutor_blackout_dates", "id", data.id);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Week view (#204): derived slots + booked lessons, grouped by HKT day
// ---------------------------------------------------------------------------

export type WeekViewDay = WeekDayGroup & {
  lessons: (WeekLesson & { status: string })[];
};

export const getMyWeekView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ days: WeekViewDay[]; generatedAt: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    const now = new Date();
    const horizon = 14;

    const [windows, blackouts, lessons] = await Promise.all([
      selectRows<{
        weekday: number;
        start_minute: number;
        end_minute: number;
        station: string | null;
      }>(db, "tutor_weekly_windows", "weekday, start_minute, end_minute, station", [
        { col: "tutor_id", op: "eq", value: tutorId },
      ]),
      selectRows<{ blackout_date: string }>(db, "tutor_blackout_dates", "blackout_date", [
        { col: "tutor_id", op: "eq", value: tutorId },
      ]),
      selectRows<
        WeekLesson & {
          tutoring_cases: {
            case_code: string;
            title: string;
            district: string | null;
            mode: string | null;
          } | null;
        }
      >(
        db,
        "case_lessons",
        "id, starts_at, duration_min, status, case_id, tutoring_cases(case_code, title, district, mode)",
        [{ col: "tutor_id", op: "eq", value: tutorId }],
        { col: "starts_at", asc: true },
      ),
    ]);

    const liveLessons = lessons.filter(
      (l) => l.status === "planned" || l.status === "confirmed" || l.status === "done",
    );
    const slots: GeneratedSlot[] = generateSlots(
      windows.map((w) => ({
        weekday: w.weekday,
        startMinute: w.start_minute,
        endMinute: w.end_minute,
        station: w.station,
      })),
      blackouts,
      liveLessons.map((l) => ({
        starts_at: l.starts_at,
        duration_min: l.duration_min,
        mode: l.tutoring_cases?.mode ?? "in_person",
      })),
      now,
      now,
      { horizonDays: horizon },
    );

    const mappedLessons: (WeekLesson & { status: string })[] = liveLessons.map((l) => ({
      id: l.id,
      starts_at: l.starts_at,
      duration_min: l.duration_min,
      status: l.status,
      case_code: l.tutoring_cases?.case_code ?? null,
      student: firstNameOf(l.tutoring_cases?.title),
      station: l.tutoring_cases?.district ?? null,
      mode: l.tutoring_cases?.mode ?? null,
    }));

    const days = groupWeekByDay(mappedLessons, slots, now, horizon) as WeekViewDay[];
    return { days, generatedAt: now.toISOString() };
  });

// ---------------------------------------------------------------------------
// Tutor Plus (#204): banner state + one-row interest
// ---------------------------------------------------------------------------

export type TutorPlusState = {
  activeStudents: number;
  orgKind: "individual" | "centre" | "unknown";
  interested: boolean;
  showBanner: boolean;
};

export const getTutorPlusState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TutorPlusState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    const now = new Date();

    const cases = await selectRows<{ id: string; sor_status: SorStatus | null }>(
      db,
      "tutoring_cases",
      "id, sor_status",
      [{ col: "matched_tutor_id", op: "eq", value: tutorId }],
    );
    const sorCases = cases.filter((c) => c.sor_status !== null);
    const lessonsByCase = new Map<string, { status: string; starts_at: string }[]>();
    if (sorCases.length > 0) {
      const lessons = await selectRows<{ case_id: string; status: string; starts_at: string }>(
        db,
        "case_lessons",
        "case_id, status, starts_at",
        [{ col: "case_id", op: "in", value: sorCases.map((c) => c.id) }],
      );
      for (const l of lessons) {
        const list = lessonsByCase.get(l.case_id) ?? [];
        list.push({ status: l.status, starts_at: l.starts_at });
        lessonsByCase.set(l.case_id, list);
      }
    }
    const activeStudents = countActiveStudents(
      sorCases.map((c) => lessonsByCase.get(c.id) ?? []),
      now,
    );

    // Org kind: my owner membership -> organizations.kind (default individual).
    const orgRows = await selectRows<{ kind: string }>(
      db,
      "organisation_members",
      "organizations(kind)",
      [
        { col: "account_id", op: "eq", value: context.userId },
        { col: "role", op: "eq", value: "owner" },
      ],
    );
    const kindRaw = orgRows[0]?.kind;
    const orgKind =
      kindRaw === "centre" ? "centre" : kindRaw === "individual" ? "individual" : "unknown";

    const interestedRows = await selectRows<{ id: string }>(db, "tutor_plus_interest", "id", [
      { col: "account_id", op: "eq", value: context.userId },
    ]);
    const interested = interestedRows.length > 0;

    return {
      activeStudents,
      orgKind,
      interested,
      showBanner: orgKind === "individual" && activeStudents >= TUTOR_PLUS_THRESHOLD && !interested,
    };
  });

export const registerTutorPlusInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { error } = await db
      .from<Row>("tutor_plus_interest")
      .insert({ account_id: context.userId })
      .select("id")
      .single();
    // UNIQUE(account_id): a second click is a no-op, not an error (#204).
    if (error && !/duplicate|unique/i.test(error.message ?? "")) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// P7 (#287): tutor reviews the parent. 20–400 chars; one visible per case;
// display line is the tutor's code-side identity.
// ---------------------------------------------------------------------------

export const submitTutorReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ status: "visible" | "held" }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);

    const rows = await selectRows<{ sor_status: SorStatus | null }>(
      db,
      "tutoring_cases",
      "sor_status",
      [
        { col: "id", op: "eq", value: data.caseId },
        { col: "matched_tutor_id", op: "eq", value: tutorId },
      ],
    );
    if (rows.length === 0) throw new Error("CASE_NOT_FOUND");

    const [lessons, mine] = await Promise.all([
      selectRows<{ status: string }>(db, "case_lessons", "status", [
        { col: "case_id", op: "eq", value: data.caseId },
      ]),
      selectRows<{ id: string; status: string; author_account_id: string }>(
        db,
        "case_reviews",
        "id, status, author_account_id",
        [{ col: "case_id", op: "eq", value: data.caseId }],
      ),
    ]);

    // Same rules as the parent direction, mirrored: done lesson required,
    // 20–400 bound (#287), holds on contact details, one visible per case.
    if (!lessons.some((l) => l.status === "done")) throw new Error("NO_DONE_LESSON");
    const validity = validateReviewInput("tutor_to_parent", data.rating, data.comment);
    if (!validity.ok) throw new Error(validity.message);
    const status: "visible" | "held" = validity.heldReasons.length > 0 ? "held" : "visible";
    const heldReason =
      validity.heldReasons.length > 0 ? `held: ${validity.heldReasons.join(", ")}` : null;

    const myExisting = mine.filter((r) => r.author_account_id === context.userId);
    const held = myExisting.find((r) => r.status === "held");
    const visible = myExisting.find((r) => r.status === "visible");
    if (visible) {
      await db
        .from<Row>("case_reviews")
        .update({ status: "replaced", updated_at: new Date().toISOString() })
        .eq("id", visible.id);
    }

    const row = {
      case_id: data.caseId,
      lesson_id: null as string | null,
      direction: "tutor_to_parent" as const,
      author_account_id: context.userId,
      tutor_id: tutorId,
      rating: data.rating,
      comment: data.comment.trim(),
      author_display_line: "Tutor",
      status,
      held_reason: heldReason,
    };
    if (held) {
      const { error } = await db
        .from<Row>("case_reviews")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", held.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from<Row>("case_reviews").insert(row).select("id").single();
      if (error) throw new Error(error.message);
    }
    return { status };
  });

/** Re-exported for the components (hktFromParts used in slot sanity display). */
export { hktFromParts, isActiveStudentCase };
