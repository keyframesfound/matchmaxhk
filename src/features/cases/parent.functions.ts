/**
 * Issues #201 + #204 + #205 — parent-side server fns: my cases, case detail
 * with lesson timeline + fee + review state, lesson confirm/cancel, slot
 * requests on fee_paid|active cases, and parent review submission.
 *
 * Ownership-gated on tutoring_cases.parent_id = auth uid. Admin-only fields
 * (contact_phone, contact_name, whatsapp_group_url, internal_note) are NEVER
 * selected here; tutor real name is never exposed (tutor_code only).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { FeeStatus, SorStatus } from "@/features/cases/sor-db";
import { cancelActionFor, canMarkDone } from "@/features/cases/sor";
import { generateSlots, lessonConflicts } from "@/features/cases/slot";
import {
  checkSlotRequest,
  decideReviewSubmit,
  parentDisplayLineFromCase,
} from "@/features/cases/parent/review-flow";
import { canPublishHeldReview, isCaseFeeSettled } from "@/features/cases/case-reviews";
import { sweepDueSessionLogs, type SessionLogRowT } from "@/features/cases/experience.functions";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;

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

async function myCase(db: Db, caseId: string, userId: string) {
  const rows = await selectRows<{
    id: string;
    parent_id: string | null;
    matched_tutor_id: string | null;
    sor_status: SorStatus | null;
  }>(db, "tutoring_cases", "id, parent_id, matched_tutor_id, sor_status", [
    { col: "id", op: "eq", value: caseId },
  ]);
  const c = rows[0];
  if (!c || c.parent_id !== userId) throw new Error("CASE_NOT_FOUND");
  return c;
}

// ---------------------------------------------------------------------------
// List + detail
// ---------------------------------------------------------------------------

export type ParentCaseListItem = {
  id: string;
  case_code: string;
  title: string;
  subject: string | null;
  exam_system: string | null;
  tutor_code: string | null;
  sor_status: SorStatus | null;
  fee_status: FeeStatus | null;
  fee_amount_hkd: number | null;
  next_lesson_at: string | null;
};

export const getMyParentCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ParentCaseListItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const cases = await selectRows<{
      id: string;
      case_code: string;
      title: string;
      subjects: string[] | null;
      exam_system: string | null;
      sor_status: SorStatus | null;
      matched_tutor_id: string | null;
      tutors: { tutor_code: string | null } | null;
      created_at: string;
    }>(
      db,
      "tutoring_cases",
      "id, case_code, title, subjects, exam_system, sor_status, matched_tutor_id, tutors(tutor_code), created_at",
      [{ col: "parent_id", op: "eq", value: context.userId }],
      { col: "created_at", asc: false, limit: 100 },
    );
    if (cases.length === 0) return [];

    const [fees, lessons] = await Promise.all([
      selectRows<{ case_id: string; status: FeeStatus; amount_hkd: number }>(
        db,
        "case_fees",
        "case_id, status, amount_hkd",
        [{ col: "case_id", op: "in", value: cases.map((c) => c.id) }],
      ),
      selectRows<{ case_id: string; starts_at: string }>(
        db,
        "case_lessons",
        "case_id, starts_at",
        [{ col: "case_id", op: "in", value: cases.map((c) => c.id) }],
        { col: "starts_at", asc: true },
      ),
    ]);
    const openFee = new Map<string, { status: FeeStatus; amount: number }>();
    for (const f of fees) {
      if ((f.status === "invoiced" || f.status === "paid") && !openFee.has(f.case_id)) {
        openFee.set(f.case_id, { status: f.status, amount: f.amount_hkd });
      }
    }
    const nextLesson = new Map<string, string>();
    const now = Date.now();
    for (const l of lessons) {
      if (Date.parse(l.starts_at) >= now && !nextLesson.has(l.case_id)) {
        nextLesson.set(l.case_id, l.starts_at);
      }
    }

    return cases.map((c) => ({
      id: c.id,
      case_code: c.case_code,
      title: c.title,
      subject: c.subjects?.[0] ?? null,
      exam_system: c.exam_system,
      tutor_code: c.tutors?.tutor_code ?? null,
      sor_status: c.sor_status,
      fee_status: openFee.get(c.id)?.status ?? null,
      fee_amount_hkd: openFee.get(c.id)?.amount ?? null,
      next_lesson_at: nextLesson.get(c.id) ?? null,
    }));
  });

export type ParentCaseDetail = {
  id: string;
  case_code: string;
  title: string;
  subjects: string[] | null;
  exam_system: string | null;
  student_level: string | null;
  tutor_code: string | null;
  sor_status: SorStatus | null;
  fee: { status: FeeStatus; amount_hkd: number } | null;
  lessons: {
    id: string;
    sequence: number;
    starts_at: string;
    duration_min: number;
    status: string;
    confirmed_by_parent_at: string | null;
    confirmed_by_tutor_at: string | null;
    location_or_link: string | null;
  }[];
  myReview: {
    id: string;
    status: string;
    rating: number;
    comment: string;
    held_reason: string | null;
  } | null;
  /** #387 tutor-logged sessions for this case (any status). */
  session_logs: SessionLogRowT[];
  canRequestSlot: boolean;
  slots: { startsAt: string; durationMin: number; station: string | null }[];
  slotDays: string[]; // HKT date keys for the picker
};

export const getParentCaseDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<ParentCaseDetail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const c = await myCase(db, data.caseId, context.userId);
    // #387 lazy 72h auto-verify sweep so pending logs flip before display.
    await sweepDueSessionLogs(db);

    const [full, lessons, fees, myReviews] = await Promise.all([
      selectRows<{
        case_code: string;
        title: string;
        subjects: string[] | null;
        exam_system: string | null;
        student_level: string | null;
        matched_tutor_id: string | null;
        tutors: { tutor_code: string | null } | null;
      }>(
        db,
        "tutoring_cases",
        "case_code, title, subjects, exam_system, student_level, matched_tutor_id, tutors(tutor_code)",
        [{ col: "id", op: "eq", value: c.id }],
      ),
      selectRows<{
        id: string;
        sequence: number;
        starts_at: string;
        duration_min: number;
        status: string;
        confirmed_by_parent_at: string | null;
        confirmed_by_tutor_at: string | null;
        location_or_link: string | null;
      }>(
        db,
        "case_lessons",
        "id, sequence, starts_at, duration_min, status, confirmed_by_parent_at, confirmed_by_tutor_at, location_or_link",
        [{ col: "case_id", op: "eq", value: c.id }],
        { col: "sequence", asc: true },
      ),
      selectRows<{ status: FeeStatus; amount_hkd: number }>(db, "case_fees", "status, amount_hkd", [
        { col: "case_id", op: "eq", value: c.id },
      ]),
      selectRows<{
        id: string;
        status: string;
        rating: number;
        comment: string;
        held_reason: string | null;
        direction: string;
        author_account_id: string;
      }>(
        db,
        "case_reviews",
        "id, status, rating, comment, held_reason, direction, author_account_id",
        [{ col: "case_id", op: "eq", value: c.id }],
      ),
    ]);
    const head = full[0];

    // Derived slots for the picker when the case is fee_paid|active.
    const canRequestSlot = c.sor_status === "fee_paid" || c.sor_status === "active";
    let slots: ParentCaseDetail["slots"] = [];
    if (canRequestSlot && head?.matched_tutor_id) {
      const tutorId = head.matched_tutor_id;
      const now = new Date();
      const [windows, blackouts, tutorLessons] = await Promise.all([
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
        selectRows<{
          starts_at: string;
          duration_min: number;
          tutoring_cases: { mode: string | null } | null;
        }>(db, "case_lessons", "starts_at, duration_min, tutoring_cases(mode)", [
          { col: "tutor_id", op: "eq", value: tutorId },
        ]),
      ]);
      const generated = generateSlots(
        windows.map((w) => ({
          weekday: w.weekday,
          startMinute: w.start_minute,
          endMinute: w.end_minute,
          station: w.station,
        })),
        blackouts,
        tutorLessons.map((l) => ({
          starts_at: l.starts_at,
          duration_min: l.duration_min,
          mode: l.tutoring_cases?.mode ?? "in_person",
        })),
        now,
        now,
      );
      slots = generated.map((s) => ({
        startsAt: s.startsAt.toISOString(),
        durationMin: s.durationMin,
        station: s.station,
      }));
    }
    const slotDays = [...new Set(slots.map((s) => s.startsAt.slice(0, 10)))];

    // #386 lazy publish on read (lazy-cancel precedent): once the case's
    // applicable admin fee is settled, held parent→tutor reviews that are
    // held PURELY for the fee settlement flip to visible in this request.
    // Contact-holds (phone/email/WhatsApp) never auto-publish.
    const mine = myReviews.find((r) => r.author_account_id === context.userId) ?? null;
    const openFee = fees.find((f) => f.status === "invoiced" || f.status === "paid") ?? null;
    let myReviewStatus = mine?.status ?? null;
    // #386 settled rule includes the fee-row proof (paid/waived), so reviews on
    // cases that closed AFTER settlement publish here too — see isCaseFeeSettled.
    if (isCaseFeeSettled(c.sor_status, fees)) {
      const eligible = myReviews.filter(
        (r) =>
          r.direction === "parent_to_tutor" &&
          r.status === "held" &&
          canPublishHeldReview(r.held_reason),
      );
      for (const r of eligible) {
        const { error } = await db
          .from<Row>("case_reviews")
          .update({ status: "visible", updated_at: new Date().toISOString() })
          .eq("id", r.id);
        if (error) throw new Error(error.message);
        r.status = "visible";
      }
      const mineId = mine?.id;
      if (mineId != null && eligible.some((r) => r.id === mineId)) myReviewStatus = "visible";
    }

    return {
      id: c.id,
      case_code: head?.case_code ?? "",
      title: head?.title ?? "",
      subjects: head?.subjects ?? null,
      exam_system: head?.exam_system ?? null,
      student_level: head?.student_level ?? null,
      tutor_code: head?.tutors?.tutor_code ?? null,
      sor_status: c.sor_status,
      fee: openFee ? { status: openFee.status, amount_hkd: openFee.amount_hkd } : null,
      lessons: lessons.map((l) => ({
        id: l.id,
        sequence: l.sequence,
        starts_at: l.starts_at,
        duration_min: l.duration_min,
        status: l.status,
        confirmed_by_parent_at: l.confirmed_by_parent_at,
        confirmed_by_tutor_at: l.confirmed_by_tutor_at,
        location_or_link: l.location_or_link,
      })),
      myReview: mine
        ? {
            id: mine.id,
            status: myReviewStatus ?? mine.status,
            rating: mine.rating,
            comment: mine.comment,
            held_reason: mine.held_reason,
          }
        : null,
      session_logs: await selectRows<SessionLogRowT>(
        db,
        "tutor_session_logs",
        "id, case_id, log_date, start_minute, duration_min, status, dispute_reason, created_at",
        [{ col: "case_id", op: "eq", value: c.id }],
        { col: "log_date", asc: false },
      ),
      canRequestSlot,
      slots,
      slotDays,
    };
  });

// ---------------------------------------------------------------------------
// Lesson actions (parent side)
// ---------------------------------------------------------------------------

export const confirmLessonParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lessonId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ status: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const rows = await selectRows<{
      id: string;
      status: string;
      case_id: string;
      confirmed_by_tutor_at: string | null;
      tutoring_cases: { parent_id: string | null } | null;
    }>(
      db,
      "case_lessons",
      "id, status, case_id, confirmed_by_tutor_at, tutoring_cases(parent_id)",
      [{ col: "id", op: "eq", value: data.lessonId }],
    );
    const lesson = rows[0];
    if (!lesson || lesson.tutoring_cases?.parent_id !== context.userId)
      throw new Error("LESSON_NOT_FOUND");
    if (lesson.status !== "planned") throw new Error("NOT_PLANNED");

    const nextStatus = lesson.confirmed_by_tutor_at ? "confirmed" : "planned";
    const { error } = await db
      .from<Row>("case_lessons")
      .update({ confirmed_by_parent_at: new Date().toISOString(), status: nextStatus })
      .eq("id", lesson.id);
    if (error) throw new Error(error.message);
    return { status: nextStatus };
  });

export const cancelLessonParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lessonId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ status: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const rows = await selectRows<{
      id: string;
      status: string;
      starts_at: string;
      case_id: string;
      tutoring_cases: { parent_id: string | null } | null;
    }>(db, "case_lessons", "id, status, starts_at, case_id, tutoring_cases(parent_id)", [
      { col: "id", op: "eq", value: data.lessonId },
    ]);
    const lesson = rows[0];
    if (!lesson || lesson.tutoring_cases?.parent_id !== context.userId)
      throw new Error("LESSON_NOT_FOUND");
    if (lesson.status !== "planned" && lesson.status !== "confirmed") throw new Error("NOT_LIVE");

    const status = cancelActionFor(new Date(lesson.starts_at), new Date());
    const { error } = await db.from<Row>("case_lessons").update({ status }).eq("id", lesson.id);
    if (error) throw new Error(error.message);
    await db
      .from<Row>("case_audit")
      .insert({
        case_id: lesson.case_id,
        actor_id: context.userId,
        from_status: lesson.status,
        to_status: `lesson_${status}`,
        reason: "Parent cancelled",
      })
      .select("id")
      .single();
    return { status };
  });

// ---------------------------------------------------------------------------
// Slot request (#204): first confirm wins on the tutor side; requests expire
// in 12h (expiry surfaced by the tutor view).
// ---------------------------------------------------------------------------

export const requestSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid(), startsAt: z.string() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const c = await myCase(db, data.caseId, context.userId);
    if (!c.matched_tutor_id) throw new Error("NO_TUTOR");

    // Re-derive the offered slots server-side (never trust the client list).
    const now = new Date();
    const [windows, blackouts, tutorLessons] = await Promise.all([
      selectRows<{
        weekday: number;
        start_minute: number;
        end_minute: number;
        station: string | null;
      }>(db, "tutor_weekly_windows", "weekday, start_minute, end_minute, station", [
        { col: "tutor_id", op: "eq", value: c.matched_tutor_id },
      ]),
      selectRows<{ blackout_date: string }>(db, "tutor_blackout_dates", "blackout_date", [
        { col: "tutor_id", op: "eq", value: c.matched_tutor_id },
      ]),
      selectRows<{
        starts_at: string;
        duration_min: number;
        tutoring_cases: { mode: string | null } | null;
      }>(db, "case_lessons", "starts_at, duration_min, tutoring_cases(mode)", [
        { col: "tutor_id", op: "eq", value: c.matched_tutor_id },
      ]),
    ]);
    const generated = generateSlots(
      windows.map((w) => ({
        weekday: w.weekday,
        startMinute: w.start_minute,
        endMinute: w.end_minute,
        station: w.station,
      })),
      blackouts,
      tutorLessons.map((l) => ({
        starts_at: l.starts_at,
        duration_min: l.duration_min,
        mode: l.tutoring_cases?.mode ?? "in_person",
      })),
      now,
      now,
    );

    const check = checkSlotRequest(
      c.sor_status,
      data.startsAt,
      generated.map((s) => ({ startsAt: s.startsAt })),
    );
    if (!check.ok) throw new Error(check.reason);

    // Belt-and-braces conflict check against live lessons.
    if (
      lessonConflicts(
        new Date(data.startsAt),
        60,
        tutorLessons.map((l) => ({
          starts_at: l.starts_at,
          duration_min: l.duration_min,
          mode: l.tutoring_cases?.mode ?? "in_person",
        })),
      )
    ) {
      throw new Error("SLOT_CONFLICT");
    }

    const all = await selectRows<{ sequence: number }>(db, "case_lessons", "sequence", [
      { col: "case_id", op: "eq", value: c.id },
    ]);
    const sequence = all.reduce((max, l) => Math.max(max, l.sequence), 0) + 1;
    const { error } = await db
      .from<Row>("case_lessons")
      .insert({
        case_id: c.id,
        sequence,
        tutor_id: c.matched_tutor_id,
        starts_at: data.startsAt,
        duration_min: 60,
        status: "planned",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Review submission (#205 parent→tutor + P7 gating)
// ---------------------------------------------------------------------------

export const submitParentReview = createServerFn({ method: "POST" })
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
  .handler(
    async ({
      context,
      data,
    }): Promise<{ status: "visible" | "held"; heldReason: string | null }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      const c = await myCase(db, data.caseId, context.userId);
      if (!c.matched_tutor_id) throw new Error("NO_TUTOR");

      const [lessons, headRows, mine, feeRows] = await Promise.all([
        selectRows<{ status: string }>(db, "case_lessons", "status", [
          { col: "case_id", op: "eq", value: c.id },
        ]),
        selectRows<{
          student_level: string | null;
          student_grade_current: string | null;
          exam_system: string | null;
          subjects: string[] | null;
        }>(db, "tutoring_cases", "student_level, student_grade_current, exam_system, subjects", [
          { col: "id", op: "eq", value: c.id },
        ]),
        selectRows<{ id: string; status: string; author_account_id: string }>(
          db,
          "case_reviews",
          "id, status, author_account_id",
          [{ col: "case_id", op: "eq", value: c.id }],
        ),
        // #386: a settled fee row (paid/waived) proves settlement even when the
        // case has moved on to 'closed' — see isCaseFeeSettled in case-reviews.
        selectRows<{ status: string }>(db, "case_fees", "status", [
          { col: "case_id", op: "eq", value: c.id },
        ]),
      ]);

      const decision = decideReviewSubmit({
        lessons,
        rating: data.rating,
        comment: data.comment,
        feeSettled: isCaseFeeSettled(c.sor_status, feeRows),
        existingMine: mine
          .filter((r) => r.author_account_id === context.userId)
          .map((r) => ({
            id: r.id,
            status: r.status as "visible" | "held" | "hidden" | "replaced",
            author_account_id: r.author_account_id,
          })),
      });
      if (decision.action === "reject") throw new Error(decision.message);

      if (decision.action === "replace") {
        await db
          .from<Row>("case_reviews")
          .update({ status: "replaced", updated_at: new Date().toISOString() })
          .eq("id", decision.oldReviewId);
      }

      const displayLine = parentDisplayLineFromCase(headRows[0] ?? {});
      const row = {
        case_id: c.id,
        lesson_id: null as string | null,
        direction: "parent_to_tutor" as const,
        author_account_id: context.userId,
        tutor_id: c.matched_tutor_id,
        rating: data.rating,
        comment: data.comment.trim(),
        author_display_line: displayLine,
        status: decision.status,
        held_reason: decision.heldReason ?? null,
      };

      if (decision.action === "update") {
        const { error } = await db
          .from<Row>("case_reviews")
          .update({ ...row, updated_at: new Date().toISOString() })
          .eq("id", decision.reviewId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await db.from<Row>("case_reviews").insert(row).select("id").single();
        if (error) throw new Error(error.message);
      }
      return { status: decision.status, heldReason: decision.heldReason ?? null };
    },
  );

/** Mark-done window gate reused by the UI (parent confirm hints). */
export { canMarkDone };
