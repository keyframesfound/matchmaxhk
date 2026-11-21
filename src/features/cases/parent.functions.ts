/**
 * Issues #201 + #204 + #205, parent-side server fns: my cases, case detail
 * with lesson timeline + fee + review state, lesson confirm/cancel, slot
 * requests on fee_paid|active cases, and parent review submission.
 *
 * Ownership-gated on tutoring_cases.parent_id = auth uid. Admin-only fields
 * (contact_phone, contact_name, whatsapp_group_url, internal_note) are NEVER
 * selected here; tutor real name is never exposed (tutor_code only).
 */

import { format } from "date-fns";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canRevealCaseContact,
  parentContactView,
  type ParentContactView,
} from "@/features/trust/trust";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { FeeStatus, SorStatus } from "@/features/cases/sor-db";
import { cancelActionFor, canMarkDone } from "@/features/cases/sor";
import { shortCaseOverrunError } from "@/features/cases/short-case";
import { generateSlots, lessonConflicts } from "@/features/cases/slot";
import { checkSlotRequest } from "@/features/cases/parent/review-flow";
import { saveCaseRatingCore } from "@/features/cases/rating-core.server";
import {
  FEE_SETTLEMENT_HOLD_REASON,
  PENDING_LESSON_HOLD_REASON,
  publicRatingLessonEligible,
} from "@/features/cases/case-reviews";
import { sweepDueSessionLogs, type SessionLogRowT } from "@/features/cases/experience.functions";
import { insertLessonLifecycleEvent } from "@/features/cases/bus.functions";
import type { HoursLedgerRowT } from "@/features/hours/hours.functions";
import { selectRowsOrEmpty } from "@/features/cases/desk-db";
import {
  matchedTutorCard,
  type MatchedTutorCardView,
  type MatchedTutorRow,
} from "@/features/cases/parent/matched-tutor";

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
    status: string;
    case_code: string | null;
  }>(db, "tutoring_cases", "id, parent_id, matched_tutor_id, sor_status, status, case_code", [
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
  status: string;
  matched_tutor_id: string | null;
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
      status: string;
      sor_status: SorStatus | null;
      matched_tutor_id: string | null;
      tutors: { tutor_code: string | null } | null;
      created_at: string;
      student_id: string | null;
    }>(
      db,
      "tutoring_cases",
      "id, case_code, title, subjects, exam_system, status, sor_status, matched_tutor_id, tutors(tutor_code), created_at, student_id",
      [{ col: "parent_id", op: "eq", value: context.userId }],
      { col: "created_at", asc: false, limit: 100 },
    );
    // #459 §4.4: claimed children whose parent switched schedule view off
    // drop out of the parent's list (a parent-set preference).
    const hidden = await selectRows<{ id: string }>(db, "students", "id", [
      { col: "parent_user_id", op: "eq", value: context.userId },
      { col: "status", op: "eq", value: "claimed_independent" },
      { col: "can_view_schedule", op: "eq", value: false },
    ]);
    const hiddenIds = new Set(hidden.map((row) => row.id));
    const visible = cases.filter((c) => !c.student_id || !hiddenIds.has(c.student_id));
    if (visible.length === 0) return [];

    const [fees, lessons] = await Promise.all([
      selectRows<{ case_id: string; status: FeeStatus; amount_hkd: number }>(
        db,
        "case_fees",
        "case_id, status, amount_hkd",
        [{ col: "case_id", op: "in", value: visible.map((c) => c.id) }],
      ),
      selectRows<{ case_id: string; starts_at: string }>(
        db,
        "case_lessons",
        "case_id, starts_at",
        [{ col: "case_id", op: "in", value: visible.map((c) => c.id) }],
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

    return visible.map((c) => ({
      id: c.id,
      case_code: c.case_code,
      title: c.title,
      subject: c.subjects?.[0] ?? null,
      exam_system: c.exam_system,
      tutor_code: c.tutors?.tutor_code ?? null,
      status: c.status,
      matched_tutor_id: c.matched_tutor_id,
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
  status: string;
  matched_tutor_id: string | null;
  /** #529 bait-and-switch card: who was matched, on the case's locked terms. */
  matched_tutor: MatchedTutorCardView | null;
  /** #650 share-sheet context: case mode + district-level area only. */
  mode: string | null;
  district: string | null;
  parentDisplayName: string | null;
  /** #650 per-case first-visit share lifecycle (null = table pre-migration). */
  safetyShare: {
    prompt_seen_at: string | null;
    dismissed_at: string | null;
    shared_at: string | null;
  } | null;
  sor_status: SorStatus | null;
  /** #503 bilateral End Case: per-side markers (null until that side taps). */
  ended_by_parent_at: string | null;
  ended_by_tutor_at: string | null;
  fee: { status: FeeStatus; amount_hkd: number } | null;
  /** #783 §2.5: the matched tutor's phone, masked until the fee is paid. */
  tutor_contact: ParentContactView;
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
    /** #794: last save (the 14-day edit window anchor). */
    updated_at: string | null;
    /** #794: completed lessons at the last save (a new lesson reopens edits). */
    completed_lessons_at_write: number | null;
  } | null;
  /** #794: when the case ended — the flat 14-day post-end window starts here. */
  case_ended_at: string | null;
  /** #794: the tutor's private rating of this family (other party + desk only). */
  tutorReview: { rating: number; comment: string } | null;
  /** #387 tutor-logged sessions for this case (any status). */
  session_logs: SessionLogRowT[];
  /** #459 verified-hours rows for this case (parent review queue). */
  hoursLedger: HoursLedgerRowT[];
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

    const [full, lessons, fees, myReviews, parentNameRows, safetyShareRows] = await Promise.all([
      selectRows<{
        case_code: string;
        title: string;
        subjects: string[] | null;
        exam_system: string | null;
        student_level: string | null;
        status: string;
        matched_tutor_id: string | null;
        ended_by_parent_at: string | null;
        ended_by_tutor_at: string | null;
        hourly_rate_hkd: number | null;
        student_count: number | null;
        district: string | null;
        mode: string | null;
        tutors: MatchedTutorRow | null;
      }>(
        db,
        "tutoring_cases",
        "case_code, title, subjects, exam_system, student_level, status, matched_tutor_id, ended_by_parent_at, ended_by_tutor_at, hourly_rate_hkd, student_count, district, mode, tutors(tutor_code, display_name, photo_url, undergrad_university)",
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
        updated_at: string | null;
        completed_lessons_at_write: number | null;
      }>(
        db,
        "case_reviews",
        "id, status, rating, comment, held_reason, direction, author_account_id, updated_at, completed_lessons_at_write",
        [{ col: "case_id", op: "eq", value: c.id }],
      ),
      // #650: the parent's display name for the share template.
      selectRows<{ display_name: string | null }>(db, "profiles", "display_name", [
        { col: "id", op: "eq", value: context.userId },
      ]),
      // #650: per-case share lifecycle; tolerant read so a pre-migration
      // deploy renders the manual share control without the soft prompt.
      selectRowsOrEmpty<{
        prompt_seen_at: string | null;
        dismissed_at: string | null;
        shared_at: string | null;
      }>(db, "case_safety_shares", "prompt_seen_at, dismissed_at, shared_at", [
        { col: "case_id", op: "eq", value: c.id },
      ]),
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

    // #794 §2.1 lazy publish on read: a LEGACY held row (pending_fee_settlement
    // / pending_lesson_threshold) flips as soon as the case has one eligible
    // COMPLETED lesson. Fee settlement is no longer a gate, and a contact hold
    // (`held: …` / `comment_held: …`) never auto-publishes. The public RPC
    // applies the same rule — this keeps the parent's own view in step.
    const mine = myReviews.find((r) => r.author_account_id === context.userId) ?? null;
    const openFee = fees.find((f) => f.status === "invoiced" || f.status === "paid") ?? null;

    // #783 §2.5: the tutor's phone, shown to the parent on THIS case only
    // once the admin fee is PAID (same gate as the tutor side; a waive,
    // refund, closed case or blocking risk flag hides it again).
    let tutorContact: ParentContactView = {
      revealed: false,
      name: null,
      phone: null,
      reason: "NOT_MATCHED",
    };
    const tutorRowId = head?.matched_tutor_id ?? null;
    if (tutorRowId) {
      const [riskFlags, tutorRows] = await Promise.all([
        selectRows<{ flag_type: string; resolved_at: string | null }>(
          db,
          "case_risk_flags",
          "flag_type, resolved_at",
          [{ col: "case_id", op: "eq", value: c.id }],
        ),
        selectRows<{ user_id: string | null; display_name: string | null }>(
          db,
          "tutors",
          "user_id, display_name",
          [{ col: "id", op: "eq", value: tutorRowId }],
        ),
      ]);
      const gate = canRevealCaseContact({
        isCaseParty: true,
        caseClosed: c.sor_status === "closed" || c.sor_status === "replaced",
        openFlagTypes: riskFlags.filter((f) => f.resolved_at === null).map((f) => f.flag_type),
        introFeePaid: fees.some((f) => f.status === "paid"),
      });
      const tutorUserId = tutorRows[0]?.user_id ?? null;
      // Only read the phone when the gate is open, so it never leaves the DB otherwise.
      const phoneRows =
        gate.reveal && tutorUserId
          ? await selectRows<{ phone: string | null }>(db, "profiles", "phone", [
              { col: "id", op: "eq", value: tutorUserId },
            ])
          : [];
      tutorContact = parentContactView(
        { name: tutorRows[0]?.display_name ?? null, phone: phoneRows[0]?.phone ?? null },
        gate,
      );
    }
    let myReviewStatus = mine?.status ?? null;
    // #794: one eligible completed lesson is the only publication condition.
    if (publicRatingLessonEligible(lessons)) {
      const eligible = myReviews.filter(
        (r) =>
          r.direction === "parent_to_tutor" &&
          r.status === "held" &&
          (r.held_reason === FEE_SETTLEMENT_HOLD_REASON ||
            r.held_reason === PENDING_LESSON_HOLD_REASON),
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

    // #794: the tutor's rating OF THIS FAMILY is readable by the parent (the
    // other party) on the private case page — never on any public parent page.
    const tutorReviewRow =
      myReviews.find((r) => r.direction === "tutor_to_parent" && r.status === "visible") ?? null;

    return {
      id: c.id,
      case_code: head?.case_code ?? "",
      title: head?.title ?? "",
      subjects: head?.subjects ?? null,
      exam_system: head?.exam_system ?? null,
      student_level: head?.student_level ?? null,
      tutor_code: head?.tutors?.tutor_code ?? null,
      status: head?.status ?? c.status,
      matched_tutor_id: head?.matched_tutor_id ?? null,
      matched_tutor: head?.matched_tutor_id
        ? matchedTutorCard({
            tutor: head.tutors,
            hourlyRateHkd: head.hourly_rate_hkd,
            studentCount: head.student_count,
          })
        : null,
      sor_status: c.sor_status,
      // #650 share-sheet context (district-level area only, never an address).
      mode: head?.mode ?? null,
      district: head?.district ?? null,
      parentDisplayName: parentNameRows[0]?.display_name ?? null,
      safetyShare: safetyShareRows[0]
        ? {
            prompt_seen_at: safetyShareRows[0].prompt_seen_at,
            dismissed_at: safetyShareRows[0].dismissed_at,
            shared_at: safetyShareRows[0].shared_at,
          }
        : null,
      // #503 bilateral End Case state (who has tapped; the control derives
      // eligibility from sor_status via canEndCase).
      ended_by_parent_at: head?.ended_by_parent_at ?? null,
      ended_by_tutor_at: head?.ended_by_tutor_at ?? null,
      fee: openFee ? { status: openFee.status, amount_hkd: openFee.amount_hkd } : null,
      tutor_contact: tutorContact,
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
            updated_at: mine.updated_at ?? null,
            completed_lessons_at_write: mine.completed_lessons_at_write ?? null,
          }
        : null,
      case_ended_at:
        c.sor_status === "closed"
          ? ([head?.ended_by_parent_at, head?.ended_by_tutor_at]
              .filter((v): v is string => typeof v === "string")
              .sort()
              .pop() ?? null)
          : null,
      tutorReview: tutorReviewRow
        ? { rating: tutorReviewRow.rating, comment: tutorReviewRow.comment }
        : null,
      session_logs: await selectRows<SessionLogRowT>(
        db,
        "tutor_session_logs",
        "id, case_id, log_date, start_minute, duration_min, status, dispute_reason, created_at",
        [{ col: "case_id", op: "eq", value: c.id }],
        { col: "log_date", asc: false },
      ),
      // #459 verified-hours review queue; tolerant read so a pre-migration
      // deploy hides the section instead of failing the whole case page.
      // Sorted newest-first here (selectRowsOrEmpty takes no order).
      hoursLedger: (
        await selectRowsOrEmpty<HoursLedgerRowT>(
          db,
          "verified_hours_ledger",
          "id, case_lesson_id, status, duration_hours, occurred_at, pending_since, verified_at, verified_by, dispute_reason",
          [{ col: "case_id", op: "eq", value: c.id }],
        )
      ).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
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
    // #428 Phase 1: bilateral L1/L2 confirmation milestone.
    try {
      const { logFunnelEvent } = await import("@/features/cases/funnel-events");
      await logFunnelEvent(
        db,
        { case_id: lesson.case_id, event_type: "lesson_1_confirmed" },
        context.userId,
      );
    } catch (funnelError) {
      console.warn("[parent] funnel log failed:", funnelError);
    }
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
      tutoring_cases: { parent_id: string | null; case_code: string | null } | null;
    }>(db, "case_lessons", "id, status, starts_at, case_id, tutoring_cases(parent_id, case_code)", [
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
    // #461 addendum Trigger 8: notify the counterparty (tutor bell + email).
    await insertLessonLifecycleEvent(
      db,
      "lesson.cancelled_by_parent",
      {
        case_id: lesson.case_id,
        starts_at: lesson.starts_at,
        heading: "Lesson cancelled",
        body: "The parent cancelled this lesson.",
        lessonLine: format(new Date(lesson.starts_at), "EEE d MMM, HH:mm"),
        caseCode: lesson.tutoring_cases?.case_code ?? undefined,
      },
      lesson.id,
    );
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

    // #760 overrun gate: a declared short package (≤5 lessons @ 20%) caps at
    // its N lessons; the desk converts the case to ongoing to unlock more.
    const shortRow = await selectRows<{
      is_short_case: boolean;
      scheduled_lesson_count: number | null;
    }>(db, "tutoring_cases", "is_short_case, scheduled_lesson_count", [
      { col: "id", op: "eq", value: c.id },
    ]);
    const caseLive = await selectRows<{ id: string }>(db, "case_lessons", "id", [
      { col: "case_id", op: "eq", value: c.id },
      { col: "status", op: "in", value: ["planned", "confirmed", "done"] },
    ]);
    const overrun = shortCaseOverrunError({
      isShortCase: shortRow[0]?.is_short_case === true,
      scheduledLessonCount: shortRow[0]?.scheduled_lesson_count ?? null,
      liveLessonCount: caseLive.length,
    });
    if (overrun) throw new Error(overrun);

    const all = await selectRows<{ sequence: number }>(db, "case_lessons", "sequence", [
      { col: "case_id", op: "eq", value: c.id },
    ]);
    const sequence = all.reduce((max, l) => Math.max(max, l.sequence), 0) + 1;
    const { data: lessonRow, error } = await db
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
    // #461 addendum Trigger 9: notify the counterparty (tutor bell + email).
    if (lessonRow?.id) {
      await insertLessonLifecycleEvent(
        db,
        "lesson.scheduled_by_parent",
        {
          case_id: c.id,
          starts_at: data.startsAt,
          heading: "New lesson scheduled",
          body: "The parent requested a lesson slot; please confirm or cancel it.",
          lessonLine: format(new Date(data.startsAt), "EEE d MMM, HH:mm"),
          caseCode: c.case_code ?? undefined,
        },
        String(lessonRow.id),
      );
      // #561 AR-11/AR-3: a scheduled lesson resolves any open reschedule or
      // intro-confirmation action on the case.
      try {
        const { completeActionsFor } = await import("@/features/cases/action-required.functions");
        await completeActionsFor(db, "lesson_reschedule", c.id);
        await completeActionsFor(db, "intro_confirm", c.id);
      } catch (arError) {
        console.warn("[parent] action completion failed:", arError);
      }
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Review submission (#205 parent→tutor + P7 gating)
// ---------------------------------------------------------------------------

/**
 * #794 §2.1 parent→tutor review. Kept as a thin compatibility wrapper over the
 * shared core (the rating sheet calls saveCaseRating directly) so any older
 * caller still goes through the CEO-lock gates: one eligible completed lesson,
 * one row per case, 14-day edit window, private desk note.
 */
export const submitParentReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().default(""),
        deskNote: z.string().max(500).default(""),
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
      const result = await saveCaseRatingCore(db, context.userId, {
        caseId: data.caseId,
        direction: "parent_to_tutor",
        rating: data.rating,
        comment: data.comment,
        deskNote: data.deskNote,
      });
      if (result.status === "visible" && result.heldReason === null) {
        // #428 Phase 1: verified review milestone (published only).
        try {
          const { logFunnelEvent } = await import("@/features/cases/funnel-events");
          await logFunnelEvent(
            db,
            { case_id: data.caseId, event_type: "verified_review_published" },
            context.userId,
          );
        } catch (funnelError) {
          console.warn("[parent] funnel log failed:", funnelError);
        }
      }
      return { status: result.status, heldReason: result.heldReason };
    },
  );

/** Mark-done window gate reused by the UI (parent confirm hints). */
export { canMarkDone };
