/**
 * Issue #201 — admin case-desk server fns: SoR transitions + audit, intro
 * lessons 1–2, admin-fee lifecycle, unpaid queue, case creation.
 *
 * Admin-gated via has_role (mirror of the orders-desk pattern). All SoR
 * tables are RLS-deny; writes run on the service-role client. Illegal status
 * jumps fail before any write (assertTransition) and again in the DB trigger.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { CaseLessonRow, FeeStatus, SorCaseRow, SorStatus } from "@/features/cases/sor-db";
import {
  ALLOWED_TRANSITIONS,
  assertTransition,
  computeFeeAmountHkd,
  feeDueAtFrom,
  hktFromParts,
  isLegalTransition,
} from "@/features/cases/sor";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;
type DbError = { message: string } | null;

async function selectRows<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: { col: string; op: "eq" | "in" | "neq"; value: unknown }[],
  order?: { col: string; asc?: boolean; limit?: number },
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) {
    if (m.op === "eq") q = q.eq(m.col, m.value);
    else if (m.op === "neq") q = q.neq(m.col, m.value);
    else q = q.in(m.col, m.value as unknown[]);
  }
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (order?.limit) q = q.limit(order.limit);
  const { data } = await q;
  return (data ?? []) as T[];
}

async function requireAdmin(db: Db, userId: string): Promise<void> {
  for (const role of ["admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

async function insertAudit(
  db: Db,
  caseId: string,
  actorId: string | null,
  fromStatus: string | null,
  toStatus: string,
  reason: string | null,
): Promise<void> {
  const { error } = await db
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
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Desk list + case detail
// ---------------------------------------------------------------------------

export type DeskCaseRow = {
  id: string;
  case_code: string;
  title: string;
  sor_status: SorStatus | null;
  hourly_rate_hkd: number | null;
  fee_status: FeeStatus | null;
  fee_amount_hkd: number | null;
  next_lesson_at: string | null;
  matched_tutor_id: string | null;
  tutor_name: string | null;
  tutor_code: string | null;
};

export const listDeskCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeskCaseRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const cases = await selectRows<
      SorCaseRow & { tutors: { display_name: string; tutor_code: string | null } | null }
    >(
      db,
      "tutoring_cases",
      "id, case_code, title, sor_status, hourly_rate_hkd, matched_tutor_id, tutors(display_name, tutor_code)",
      [{ col: "sor_status", op: "neq", value: null }],
      { col: "created_at", asc: false, limit: 200 },
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
      if (f.status === "not_due" || f.status === "invoiced" || f.status === "paid") {
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
      sor_status: c.sor_status,
      hourly_rate_hkd: c.hourly_rate_hkd,
      fee_status: openFee.get(c.id)?.status ?? null,
      fee_amount_hkd: openFee.get(c.id)?.amount ?? null,
      next_lesson_at: nextLesson.get(c.id) ?? null,
      matched_tutor_id: c.matched_tutor_id,
      tutor_name: c.tutors?.display_name ?? null,
      tutor_code: c.tutors?.tutor_code ?? null,
    }));
  });

export const getDeskCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const cases = await selectRows<
      SorCaseRow & { tutors: { display_name: string; tutor_code: string | null } | null }
    >(db, "tutoring_cases", "*, tutors(display_name, tutor_code)", [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    const c = cases[0];
    if (!c) throw new Error("CASE_NOT_FOUND");

    const [lessons, fees, audit] = await Promise.all([
      selectRows<{
        id: string;
        sequence: number;
        starts_at: string;
        duration_min: number;
        status: string;
        location_or_link: string | null;
        confirmed_by_parent_at: string | null;
        confirmed_by_tutor_at: string | null;
      }>(
        db,
        "case_lessons",
        "id, sequence, starts_at, duration_min, status, location_or_link, confirmed_by_parent_at, confirmed_by_tutor_at",
        [{ col: "case_id", op: "eq", value: c.id }],
        { col: "sequence", asc: true },
      ),
      selectRows<{
        id: string;
        status: FeeStatus;
        amount_hkd: number;
        rate_hkd: number;
        multiplier: number;
        due_at: string | null;
        paid_at: string | null;
        fps_reference: string | null;
        waive_reason: string | null;
      }>(
        db,
        "case_fees",
        "id, status, amount_hkd, rate_hkd, multiplier, due_at, paid_at, fps_reference, waive_reason",
        [{ col: "case_id", op: "eq", value: c.id }],
        { col: "created_at", asc: false },
      ),
      selectRows<{
        id: string;
        actor_id: string | null;
        from_status: string | null;
        to_status: string;
        reason: string | null;
        created_at: string;
      }>(
        db,
        "case_audit",
        "id, actor_id, from_status, to_status, reason, created_at",
        [{ col: "case_id", op: "eq", value: c.id }],
        { col: "created_at", asc: false, limit: 20 },
      ),
    ]);

    return {
      id: c.id,
      case_code: c.case_code,
      title: c.title,
      sor_status: c.sor_status,
      hourly_rate_hkd: c.hourly_rate_hkd,
      exam_system: c.exam_system,
      subjects: c.subjects,
      student_level: c.student_level,
      student_grade_current: c.student_grade_current,
      district: c.district,
      whatsapp_group_url: c.whatsapp_group_url,
      internal_note: c.internal_note,
      contact_name: c.contact_name,
      contact_phone: c.contact_phone,
      tutor_name: c.tutors?.display_name ?? null,
      tutor_code: c.tutors?.tutor_code ?? null,
      lessons,
      fees,
      audit,
      allowedTransitions: c.sor_status ? (ALLOWED_TRANSITIONS[c.sor_status] ?? []) : [],
    };
  });

// ---------------------------------------------------------------------------
// Transitions + fees
// ---------------------------------------------------------------------------

export const transitionCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        to: z.string(),
        reason: z.string().max(500).optional(),
        fpsReference: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ sor_status: SorStatus }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const rows = await selectRows<Pick<SorCaseRow, "id" | "sor_status" | "hourly_rate_hkd">>(
      db,
      "tutoring_cases",
      "id, sor_status, hourly_rate_hkd",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    const c = rows[0];
    if (!c) throw new Error("CASE_NOT_FOUND");
    if (!c.sor_status) throw new Error("NOT_A_SOR_CASE");
    const to = data.to as SorStatus;
    assertTransition(c.sor_status, to); // throws IllegalTransitionError on illegal jumps

    const nowIso = new Date().toISOString();
    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({ sor_status: to, sor_status_at: nowIso })
      .eq("id", c.id);
    if (error) throw new Error(error.message);
    await insertAudit(db, c.id, context.userId, c.sor_status, to, data.reason ?? null);

    // Side effects (#201 flow steps 8–9).
    if (to === "fee_invoiced") {
      const open = await selectRows<{ id: string }>(db, "case_fees", "id", [
        { col: "case_id", op: "eq", value: c.id },
        { col: "status", op: "in", value: ["not_due", "invoiced", "paid"] },
      ]);
      if (open.length === 0) {
        if (c.hourly_rate_hkd == null) throw new Error("NO_RATE_ON_CASE");
        const amount = computeFeeAmountHkd(Number(c.hourly_rate_hkd));
        const { error: feeError } = await db
          .from<Row>("case_fees")
          .insert({
            case_id: c.id,
            rate_hkd: c.hourly_rate_hkd,
            multiplier: 1.5,
            amount_hkd: amount,
            status: "invoiced",
            due_at: feeDueAtFrom(new Date()).toISOString(),
          })
          .select("id")
          .single();
        if (feeError) throw new Error(feeError.message);
        await insertAudit(
          db,
          c.id,
          context.userId,
          null,
          "fee_invoiced",
          `1.5 × HK$${c.hourly_rate_hkd}`,
        );
      }
    }
    if (to === "fee_paid") {
      const invoiced = await selectRows<{ id: string }>(db, "case_fees", "id", [
        { col: "case_id", op: "eq", value: c.id },
        { col: "status", op: "eq", value: "invoiced" },
      ]);
      for (const fee of invoiced) {
        await db
          .from<Row>("case_fees")
          .update({
            status: "paid",
            paid_at: nowIso,
            marked_paid_by: context.userId,
            fps_reference: data.fpsReference ?? null,
          })
          .eq("id", fee.id);
      }
    }
    return { sor_status: to };
  });

export const feeInvoiceCustom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        multiplier: z.number().positive().max(100),
        reason: z.string().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const rows = await selectRows<Pick<SorCaseRow, "id" | "hourly_rate_hkd">>(
      db,
      "tutoring_cases",
      "id, hourly_rate_hkd",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    if (!rows[0]) throw new Error("CASE_NOT_FOUND");
    if (rows[0].hourly_rate_hkd == null) throw new Error("NO_RATE_ON_CASE");

    const amount = computeFeeAmountHkd(Number(rows[0].hourly_rate_hkd), data.multiplier);
    const { error } = await db
      .from<Row>("case_fees")
      .insert({
        case_id: data.caseId,
        rate_hkd: rows[0].hourly_rate_hkd,
        multiplier: data.multiplier,
        amount_hkd: amount,
        status: "invoiced",
        due_at: feeDueAtFrom(new Date()).toISOString(),
      })
      .select("id")
      .single();
    // The partial unique index rejects a second open fee — surface it cleanly.
    if (error)
      throw new Error(/duplicate|unique/i.test(error.message) ? "OPEN_FEE_EXISTS" : error.message);
    await insertAudit(
      db,
      data.caseId,
      context.userId,
      null,
      "fee_invoiced",
      `custom ${data.multiplier}× — ${data.reason}`,
    );
    return { ok: true };
  });

/**
 * QA (#375): fee desk actions must drive the SoR status machine, not only the
 * fee row. Advances fee_invoiced → fee_paid / waived when the case sits on the
 * SoR machine and the edge is legal; legacy cases (sor_status NULL) and
 * already-advanced cases are left untouched.
 */
async function advanceSorCaseStatus(
  db: ReturnType<typeof asAdminDb>,
  actorId: string,
  caseId: string,
  to: SorStatus,
): Promise<void> {
  const rows = await selectRows<{ sor_status: SorStatus | null }>(
    db,
    "tutoring_cases",
    "sor_status",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const from = rows[0]?.sor_status;
  if (!from || !isLegalTransition(from, to)) return;
  const { error } = await db
    .from<Row>("tutoring_cases")
    .update({ sor_status: to, sor_status_at: new Date().toISOString() })
    .eq("id", caseId);
  if (error) throw new Error(error.message);
  await insertAudit(db, caseId, actorId, from, to, `fee action → ${to}`);
}

export const feeMarkPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ feeId: z.string().uuid(), fpsReference: z.string().max(80).optional() })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const { error } = await db
      .from<Row>("case_fees")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        marked_paid_by: context.userId,
        fps_reference: data.fpsReference ?? null,
      })
      .eq("id", data.feeId);
    if (error) throw new Error(error.message);
    const feeCase = await selectRows<{ case_id: string }>(db, "case_fees", "case_id", [
      { col: "id", op: "eq", value: data.feeId },
    ]);
    if (feeCase[0]) {
      await insertAudit(
        db,
        feeCase[0].case_id,
        context.userId,
        null,
        "fee_paid",
        data.fpsReference ?? null,
      );
      // QA (#375): the fee action must also advance the SoR machine — a case
      // stuck on fee_invoiced keeps parent slot requests locked.
      await advanceSorCaseStatus(db, context.userId, feeCase[0].case_id, "fee_paid");
    }
    return { ok: true };
  });

export const feeWaive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ feeId: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const { error } = await db
      .from<Row>("case_fees")
      .update({ status: "waived", waive_reason: data.reason })
      .eq("id", data.feeId);
    if (error) throw new Error(error.message);
    const feeCase = await selectRows<{ case_id: string }>(db, "case_fees", "case_id", [
      { col: "id", op: "eq", value: data.feeId },
    ]);
    if (feeCase[0]) {
      await insertAudit(db, feeCase[0].case_id, context.userId, null, "fee_waived", data.reason);
      await advanceSorCaseStatus(db, context.userId, feeCase[0].case_id, "waived");
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Lessons 1–2 (admin logs; both sides confirm; done/no_show/cancelled)
// ---------------------------------------------------------------------------

const lessonInput = z.object({
  caseId: z.string().uuid(),
  sequence: z.number().int().min(1).max(2),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().int().min(0).max(23).default(10),
  durationMin: z.number().int().min(15).max(480).default(60),
  locationOrLink: z.string().max(300).nullable().optional(),
});

export const lessonAdminLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => lessonInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const cases = await selectRows<{ matched_tutor_id: string | null }>(
      db,
      "tutoring_cases",
      "matched_tutor_id",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    if (!cases[0]) throw new Error("CASE_NOT_FOUND");

    const existing = await selectRows<{ sequence: number }>(db, "case_lessons", "sequence", [
      { col: "case_id", op: "eq", value: data.caseId },
      { col: "sequence", op: "eq", value: data.sequence },
    ]);
    if (existing.length > 0) throw new Error("LESSON_EXISTS");

    const startsAt = hktFromParts(data.dateKey, data.hour * 60).toISOString();
    const { error } = await db
      .from<Row>("case_lessons")
      .insert({
        case_id: data.caseId,
        sequence: data.sequence,
        tutor_id: cases[0].matched_tutor_id,
        starts_at: startsAt,
        duration_min: data.durationMin,
        location_or_link: data.locationOrLink ?? null,
        status: "planned",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await insertAudit(
      db,
      data.caseId,
      context.userId,
      null,
      `lesson_${data.sequence}_logged`,
      startsAt,
    );
    return { ok: true };
  });

export const lessonAdminConfirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ lessonId: z.string().uuid(), side: z.enum(["parent", "tutor"]) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ status: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const rows = await selectRows<CaseLessonRow>(db, "case_lessons", "*", [
      { col: "id", op: "eq", value: data.lessonId },
    ]);
    const lesson = rows[0];
    if (!lesson) throw new Error("LESSON_NOT_FOUND");
    if (lesson.status !== "planned") throw new Error("NOT_PLANNED");

    const patch: Row = {
      [data.side === "parent" ? "confirmed_by_parent_at" : "confirmed_by_tutor_at"]:
        new Date().toISOString(),
    };
    if (
      (data.side === "parent" && lesson.confirmed_by_tutor_at) ||
      (data.side === "tutor" && lesson.confirmed_by_parent_at)
    ) {
      patch.status = "confirmed";
    }
    const { error } = await db.from<Row>("case_lessons").update(patch).eq("id", lesson.id);
    if (error) throw new Error(error.message);
    await insertAudit(
      db,
      lesson.case_id,
      context.userId,
      lesson.status,
      String(patch.status ?? lesson.status),
      `admin confirmed for ${data.side}`,
    );
    return { status: String(patch.status ?? lesson.status) };
  });

export const lessonAdminMark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        lessonId: z.string().uuid(),
        status: z.enum(["done", "no_show", "cancelled"]),
        reason: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const rows = await selectRows<CaseLessonRow>(db, "case_lessons", "*", [
      { col: "id", op: "eq", value: data.lessonId },
    ]);
    const lesson = rows[0];
    if (!lesson) throw new Error("LESSON_NOT_FOUND");
    if (lesson.status === "done") throw new Error("ALREADY_DONE");

    const patch: Row = { status: data.status };
    if (data.status === "done") {
      patch.marked_done_by = context.userId;
      patch.done_at = new Date().toISOString();
    }
    const { error } = await db.from<Row>("case_lessons").update(patch).eq("id", lesson.id);
    if (error) throw new Error(error.message);
    // no_show/cancelled never create fees (#201) — no side effect here by design.
    await insertAudit(
      db,
      lesson.case_id,
      context.userId,
      lesson.status,
      data.status,
      data.reason ?? null,
    );
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Unpaid queue + audit + create
// ---------------------------------------------------------------------------

export type UnpaidQueueRow = {
  fee_id: string;
  case_id: string;
  case_code: string;
  contact_name: string | null;
  amount_hkd: number;
  due_at: string | null;
  whatsapp_group_url: string | null;
  tutor_name: string | null;
  tutor_code: string | null;
};

export const unpaidQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UnpaidQueueRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const fees = await selectRows<{
      id: string;
      case_id: string;
      amount_hkd: number;
      due_at: string | null;
    }>(
      db,
      "case_fees",
      "id, case_id, amount_hkd, due_at",
      [{ col: "status", op: "eq", value: "invoiced" }],
      { col: "due_at", asc: true },
    );
    if (fees.length === 0) return [];

    const cases = await selectRows<
      SorCaseRow & { tutors: { display_name: string; tutor_code: string | null } | null }
    >(
      db,
      "tutoring_cases",
      "id, case_code, contact_name, whatsapp_group_url, tutors(display_name, tutor_code)",
      [{ col: "id", op: "in", value: fees.map((f) => f.case_id) }],
    );
    const caseById = new Map(cases.map((c) => [c.id, c]));
    return fees.map((f) => {
      const c = caseById.get(f.case_id);
      return {
        fee_id: f.id,
        case_id: f.case_id,
        case_code: c?.case_code ?? "",
        contact_name: c?.contact_name ?? null,
        amount_hkd: f.amount_hkd,
        due_at: f.due_at,
        whatsapp_group_url: c?.whatsapp_group_url ?? null,
        tutor_name: c?.tutors?.display_name ?? null,
        tutor_code: c?.tutors?.tutor_code ?? null,
      };
    });
  });

export const createSorCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        assignedTutorId: z.string().uuid(),
        parentAccountId: z.string().uuid().nullable().optional(),
        studentDisplayName: z.string().max(120).optional(),
        curriculum: z.string().max(60).nullable().optional(),
        subject: z.string().max(60).nullable().optional(),
        level: z.string().max(60).nullable().optional(),
        station: z.string().max(60).nullable().optional(),
        lessonMode: z.enum(["f2f", "online"]).nullable().optional(),
        hourlyRateHkd: z.number().positive().nullable().optional(),
        whatsappGroupUrl: z.string().max(300).nullable().optional(),
        internalNote: z.string().max(1000).nullable().optional(),
        source: z.string().max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ caseId: string; caseCode: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const { data: caseId, error } = await db.rpc("admin_create_sor_case", {
      _payload: {
        assigned_tutor_id: data.assignedTutorId,
        parent_account_id: data.parentAccountId ?? null,
        concierge_id: context.userId,
        student_display_name: data.studentDisplayName ?? null,
        curriculum: data.curriculum ?? null,
        subject: data.subject ?? null,
        level: data.level ?? null,
        station: data.station ?? null,
        lesson_mode: data.lessonMode ?? null,
        hourly_rate_hkd: data.hourlyRateHkd ?? null,
        whatsapp_group_url: data.whatsappGroupUrl ?? null,
        internal_note: data.internalNote ?? null,
        source: data.source ?? "whatsapp",
      },
    });
    if (error) throw new Error(error.message ?? "create failed");
    const id = caseId as string;
    const rows = await selectRows<{ case_code: string }>(db, "tutoring_cases", "case_code", [
      { col: "id", op: "eq", value: id },
    ]);
    return { caseId: id, caseCode: rows[0]?.case_code ?? "" };
  });
