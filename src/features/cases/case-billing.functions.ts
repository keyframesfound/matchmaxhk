/**
 * Issue #654: Schedule & Billing, server half. Contested reschedules (the other
 * side accepts or declines) and the shared tuition statement. Every call goes
 * through partyCase. Parties are shown by role, not name, and nothing here
 * charges, holds or moves money.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, selectRows, type Db, type Row } from "@/features/cases/desk-db";
import { insertLessonLifecycleEvent } from "@/features/cases/bus.functions";
import {
  RESCHEDULE_NOTE_MAX,
  SHARE_COOLDOWN_MS,
  STATEMENT_NOTE_MAX,
  STATEMENT_STATUSES,
  canRespondToReschedule,
  isStatementMonth,
  rescheduleLessonError,
  type BillingRole,
  type MonthMark,
  type StatementLesson,
  type StatementStatus,
} from "@/features/cases/case-billing";
import { hktClock } from "@/features/cases/case-schedule";
import { occupiedFor, partyCase, type PartyCase } from "@/features/cases/case-schedule.functions";
import { isTimeClashError, scheduleLessonError } from "@/features/cases/schedule-lesson";
import { hktDateKey } from "@/features/cases/sor";
import { contactFilterError } from "@/lib/contact-filter";

type LessonRow = {
  id: string;
  case_id: string;
  starts_at: string;
  duration_min: number;
  status: string;
};

const LESSON_COLS = "id, case_id, starts_at, duration_min, status";

type RequestRow = {
  id: string;
  case_id: string;
  lesson_id: string;
  proposed_starts_at: string;
  note: string | null;
  proposer_role: BillingRole;
  status: string;
};

const REQUEST_COLS = "id, case_id, lesson_id, proposed_starts_at, note, proposer_role, status";

export type PendingReschedule = {
  id: string;
  lessonId: string;
  fromStartsAt: string | null;
  proposedStartsAt: string;
  note: string | null;
  proposerRole: BillingRole;
};

export type CaseBilling = {
  role: BillingRole;
  rateHkd: number | null;
  studentCount: number | null;
  isShortCase: boolean;
  canRequest: boolean;
  lessons: StatementLesson[];
  pending: PendingReschedule[];
  marks: MonthMark[];
};

function assertCleanNote(note: string | undefined): void {
  if (note && contactFilterError(note)) throw new Error("CONTACT_DETAILS");
}

function lessonLine(iso: string): string {
  return `${hktDateKey(new Date(iso))} ${hktClock(iso)} HKT`;
}

async function lessonOnCase(db: Db, lessonId: string, caseId: string): Promise<LessonRow> {
  const rows = await selectRows<LessonRow>(db, "case_lessons", LESSON_COLS, [
    { col: "id", op: "eq", value: lessonId },
    { col: "case_id", op: "eq", value: caseId },
  ]);
  if (!rows[0]) throw new Error("LESSON_NOT_FOUND");
  return rows[0];
}

/** Shape, status and clash checks for moving a lesson; the DB trigger is the backstop. */
async function assertMovable(
  db: Db,
  c: PartyCase,
  tutorId: string,
  lesson: LessonRow,
  proposedIso: string,
): Promise<void> {
  const now = new Date();
  const moveError = rescheduleLessonError({
    lesson: { startsAt: lesson.starts_at, status: lesson.status },
    proposedIso,
    now,
  });
  if (moveError) throw new Error(moveError);
  if (c.schedule_paused_at) throw new Error("CASE_PAUSED");
  const others = (await occupiedFor(db, c, tutorId)).filter((o) => o.id !== lesson.id);
  const error = scheduleLessonError({
    sorStatus: c.sor_status,
    startsAtIso: proposedIso,
    durationMin: lesson.duration_min,
    online: c.mode === "online",
    now,
    existing: others,
  });
  if (error) throw new Error(error);
}

async function notifyOtherSide(
  db: Db,
  c: PartyCase,
  actor: BillingRole,
  startsAt: string,
  heading: string,
  body: string,
): Promise<void> {
  // A fresh source id: each of these notifies; the bus dedupes on source id.
  await insertLessonLifecycleEvent(
    db,
    `lesson.scheduled_by_${actor}`,
    {
      case_id: c.id,
      case_code: c.case_code,
      caseCode: c.case_code,
      starts_at: startsAt,
      heading,
      body,
      lessonLine: lessonLine(startsAt),
    },
    crypto.randomUUID(),
  );
}

export const getCaseBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseBilling> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await partyCase(db, data.caseId, context.userId);
    const [terms, lessons, requests, marks] = await Promise.all([
      selectRows<{
        hourly_rate_hkd: number | null;
        student_count: number | null;
        is_short_case: boolean | null;
      }>(db, "tutoring_cases", "hourly_rate_hkd, student_count, is_short_case", [
        { col: "id", op: "eq", value: c.id },
      ]),
      selectRows<LessonRow>(db, "case_lessons", LESSON_COLS, [
        { col: "case_id", op: "eq", value: c.id },
      ]),
      selectRows<RequestRow>(db, "case_reschedule_requests", REQUEST_COLS, [
        { col: "case_id", op: "eq", value: c.id },
        { col: "status", op: "eq", value: "pending" },
      ]),
      selectRows<{
        month: string;
        status: StatementStatus;
        note: string | null;
        marked_by_role: BillingRole | null;
        marked_at: string | null;
      }>(db, "case_statement_months", "month, status, note, marked_by_role, marked_at", [
        { col: "case_id", op: "eq", value: c.id },
      ]),
    ]);
    // A proposal on a lesson that has since been cancelled or passed is dead.
    const liveStart = new Map(
      lessons
        .filter(
          (l) =>
            (l.status === "planned" || l.status === "confirmed") &&
            Date.parse(l.starts_at) > Date.now(),
        )
        .map((l) => [l.id, l.starts_at]),
    );
    return {
      role,
      rateHkd: terms[0]?.hourly_rate_hkd ?? null,
      studentCount: terms[0]?.student_count ?? null,
      isShortCase: Boolean(terms[0]?.is_short_case),
      canRequest:
        !c.schedule_paused_at && (c.sor_status === "fee_paid" || c.sor_status === "active"),
      lessons: lessons.map((l) => ({
        id: l.id,
        startsAt: l.starts_at,
        durationMin: l.duration_min,
        status: l.status,
      })),
      pending: requests
        .filter((r) => liveStart.has(r.lesson_id))
        .map((r) => ({
          id: r.id,
          lessonId: r.lesson_id,
          fromStartsAt: liveStart.get(r.lesson_id) ?? null,
          proposedStartsAt: r.proposed_starts_at,
          note: r.note,
          proposerRole: r.proposer_role,
        })),
      marks: marks.map((m) => ({
        month: m.month,
        status: m.status,
        note: m.note,
        markedByRole: m.marked_by_role,
        markedAt: m.marked_at,
      })),
    };
  });

export const requestReschedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        lessonId: z.string().uuid(),
        proposedIso: z.string().datetime(),
        note: z.string().trim().max(RESCHEDULE_NOTE_MAX).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role, tutorId } = await partyCase(db, data.caseId, context.userId);
    assertCleanNote(data.note);
    const lesson = await lessonOnCase(db, data.lessonId, c.id);
    const proposedIso = new Date(data.proposedIso).toISOString();
    await assertMovable(db, c, tutorId, lesson, proposedIso);

    // A new proposal for the same lesson replaces the open one.
    const { error: supersedeError } = await db
      .from<Row>("case_reschedule_requests")
      .update({ status: "superseded" })
      .eq("lesson_id", lesson.id)
      .eq("status", "pending");
    if (supersedeError) throw new Error(supersedeError.message);

    const { data: row, error } = await db
      .from<Row>("case_reschedule_requests")
      .insert({
        case_id: c.id,
        lesson_id: lesson.id,
        proposed_starts_at: proposedIso,
        note: data.note || null,
        proposed_by: context.userId,
        proposer_role: role,
      })
      .select("id")
      .single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error("REQUEST_BUSY");
      throw new Error(error.message);
    }
    await insertAudit(db, c.id, context.userId, "reschedule_requested", null);
    await notifyOtherSide(
      db,
      c,
      role,
      proposedIso,
      "Reschedule requested",
      "A new lesson time was proposed. Accept or decline it in Case Manager.",
    );
    return { id: String((row as { id: string }).id) };
  });

export const respondReschedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ caseId: z.string().uuid(), requestId: z.string().uuid(), accept: z.boolean() })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ status: "accepted" | "declined" }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role, tutorId } = await partyCase(db, data.caseId, context.userId);
    const rows = await selectRows<RequestRow>(db, "case_reschedule_requests", REQUEST_COLS, [
      { col: "id", op: "eq", value: data.requestId },
      { col: "case_id", op: "eq", value: c.id },
    ]);
    const request = rows[0];
    if (!request) throw new Error("REQUEST_NOT_FOUND");
    if (
      !canRespondToReschedule({ status: request.status, proposerRole: request.proposer_role }, role)
    ) {
      throw new Error("CANNOT_RESPOND");
    }

    if (data.accept) {
      const lesson = await lessonOnCase(db, request.lesson_id, c.id);
      await assertMovable(db, c, tutorId, lesson, request.proposed_starts_at);
      const stamp = new Date().toISOString();
      const { error } = await db
        .from<Row>("case_lessons")
        .update({
          starts_at: request.proposed_starts_at,
          status: "confirmed",
          confirmed_by_tutor_at: stamp,
          confirmed_by_parent_at: stamp,
          no_request_expiry: true,
        })
        .eq("id", lesson.id);
      if (error) {
        if (isTimeClashError(error.message)) throw new Error("SLOT_CONFLICT");
        throw new Error(error.message);
      }
    }

    const status = data.accept ? "accepted" : "declined";
    const { error: closeError } = await db
      .from<Row>("case_reschedule_requests")
      .update({ status, responded_by: context.userId, responded_at: new Date().toISOString() })
      .eq("id", request.id)
      .eq("status", "pending");
    if (closeError) throw new Error(closeError.message);
    await insertAudit(db, c.id, context.userId, `reschedule_${status}`, null);
    await notifyOtherSide(
      db,
      c,
      role,
      request.proposed_starts_at,
      data.accept ? "Reschedule accepted" : "Reschedule declined",
      data.accept
        ? "The new lesson time is on both Case Manager calendars."
        : "The lesson stays at its original time.",
    );
    return { status };
  });

const monthSchema = z.string().refine(isStatementMonth, "BAD_MONTH");

/** Shared paid status with who marked it. Either party may change it; no money moves. */
export const setStatementMonthStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        month: monthSchema,
        status: z.enum(STATEMENT_STATUSES),
        note: z.string().trim().max(STATEMENT_NOTE_MAX).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ status: StatementStatus }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await partyCase(db, data.caseId, context.userId);
    assertCleanNote(data.note);
    const { error } = await db.from<Row>("case_statement_months").upsert(
      {
        case_id: c.id,
        month: data.month,
        status: data.status,
        note: data.note || null,
        marked_by: context.userId,
        marked_by_role: role,
        marked_at: new Date().toISOString(),
      },
      { onConflict: "case_id,month" },
    );
    if (error) throw new Error(error.message);
    return { status: data.status };
  });

/** In-app and email notice to the other side, at most once an hour per month. */
export const shareStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid(), month: monthSchema }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ sharedAt: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await partyCase(db, data.caseId, context.userId);
    const existing = await selectRows<{ shared_at: string | null }>(
      db,
      "case_statement_months",
      "shared_at",
      [
        { col: "case_id", op: "eq", value: c.id },
        { col: "month", op: "eq", value: data.month },
      ],
    );
    const last = existing[0]?.shared_at;
    if (last && Date.now() - Date.parse(last) < SHARE_COOLDOWN_MS) {
      throw new Error("SHARED_RECENTLY");
    }
    const sharedAt = new Date().toISOString();
    const { error } = await db
      .from<Row>("case_statement_months")
      .upsert(
        { case_id: c.id, month: data.month, shared_at: sharedAt },
        { onConflict: "case_id,month" },
      );
    if (error) throw new Error(error.message);
    await notifyOtherSide(
      db,
      c,
      role,
      sharedAt,
      "Tuition statement shared",
      `The ${data.month} statement is ready to view in Case Manager. MatchMax does not collect this tuition.`,
    );
    return { sharedAt };
  });
