/**
 * Issue #443 — Short-Case desk server fns.
 *
 * Admin-gated (mirror of admin-desk.functions.ts): every read/write runs on
 * the service-role client after a has_role admin/super_admin check, so the
 * INTERNAL short-case fields (short_case_fee, short_case_confirmed_by/_at)
 * and hourly_rate_hkd never need authenticated column grants.
 *
 * Fee math lives in short-case.ts (pure, vitest-covered); this file only
 * orchestrates DB state:
 *  - getShortCaseState      — one round-trip feeding the whole panel
 *  - setShortCase           — toggle + package inputs + REQUIRED confirm gate;
 *                             keeps package_type in sync with is_short_case
 *                             (#430 reconciliation: is_short_case is the
 *                             fee-math source of truth). Duration rides on the
 *                             EXISTING session_length_minutes column (shared
 *                             duration lock — no hours_per_lesson column);
 *                             hours are derived as minutes / 60.
 *  - invoiceShortCaseFee    — the 20% fee as a real case_fees row (manual op:
 *                             after Lesson 1 confirmed, or on booking when
 *                             count = 1 — the UI gates it, no automation)
 *  - convertShortCaseToStandard — #443 convert action: standard 1.5-lesson
 *                             fee on the same rate basis (#385 math), balance
 *                             = max(0, standard − already billed), invoice the
 *                             balance only when > 0 ("No balance due" at 0)
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { FeeStatus } from "@/features/cases/sor-db";
import { feeDueAtFrom } from "@/features/cases/sor";
import { fullAdminFeeAmount } from "@/features/cases/fee-breakdown";
import {
  buildShortCaseConfirmNote,
  convertBalanceAmountHkd,
  hoursPerLessonFromMinutes,
  shortCaseConfirmationError,
  shortCaseFeeAmount,
  shortCaseFeeMultiplier,
  shouldInvoiceShortFee,
  sumBilledFeeHkd,
  validateShortCaseInputs,
  type BilledFeeRow,
} from "@/features/cases/short-case";

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

/**
 * Squad-shaped backstops (no squad marker column exists — documented gap in
 * the migration): group-cohort cases (#391) and any row carrying a squad-ish
 * tag must never take the short flag (CEO 2026-10-13 — squads stay 1.5-lesson).
 */
function squadBlocked(row: { group_cohort_id: string | null; tags: unknown }): boolean {
  if (row.group_cohort_id != null) return true;
  if (!Array.isArray(row.tags)) return false;
  return row.tags.some((tg) => typeof tg === "string" && /squad/i.test(tg));
}

/** "1.5h" for fractional hours, "1h" for whole — audit + UI label helper. */
function hoursLabel(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${Math.round(hours * 100) / 100}h`;
}

type ShortCaseRow = {
  id: string;
  case_code: string;
  package_type: string;
  student_count: number;
  hourly_rate_hkd: number | null;
  session_length_minutes: number | null;
  is_short_case: boolean;
  scheduled_lesson_count: number | null;
  short_case_fee: number | null;
  short_case_confirmed_by: string | null;
  short_case_confirmed_at: string | null;
  group_cohort_id: string | null;
  tags: string[] | null;
};

export type ShortCaseState = {
  caseCode: string;
  packageType: string;
  hourlyRateHkd: number | null;
  studentCount: number;
  isShortCase: boolean;
  scheduledLessonCount: number | null;
  /** Existing case column — the ONLY duration store (no hours_per_lesson DB column). */
  sessionLengthMinutes: number | null;
  /** Derived for display/math: session_length_minutes / 60. */
  hoursPerLesson: number | null;
  shortCaseFee: number | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  lesson1Status: string | null;
  invoiceReady: boolean;
  invoicedTotalHkd: number;
  openFee: { id: string; status: FeeStatus; amountHkd: number } | null;
  standardFeeHkd: number | null;
  convertBalanceHkd: number | null;
  cohortBlocked: boolean;
};

async function loadShortCase(db: Db, caseId: string): Promise<ShortCaseRow> {
  const rows = await selectRows<ShortCaseRow>(
    db,
    "tutoring_cases",
    "id, case_code, package_type, student_count, hourly_rate_hkd, session_length_minutes, is_short_case, scheduled_lesson_count, short_case_fee, short_case_confirmed_by, short_case_confirmed_at, group_cohort_id, tags",
    [{ col: "id", op: "eq", value: caseId }],
  );
  if (!rows[0]) throw new Error("CASE_NOT_FOUND");
  return rows[0];
}

async function loadFees(
  db: Db,
  caseId: string,
): Promise<Array<{ id: string; status: FeeStatus; amount_hkd: number }>> {
  return selectRows<{ id: string; status: FeeStatus; amount_hkd: number }>(
    db,
    "case_fees",
    "id, status, amount_hkd",
    [{ col: "case_id", op: "eq", value: caseId }],
  );
}

export const getShortCaseState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<ShortCaseState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const c = await loadShortCase(db, data.caseId);
    const [fees, lessons] = await Promise.all([
      loadFees(db, data.caseId),
      selectRows<{ sequence: number; status: string }>(
        db,
        "case_lessons",
        "sequence, status",
        [{ col: "case_id", op: "eq", value: data.caseId }],
        { col: "sequence", asc: true, limit: 1 },
      ),
    ]);
    const lesson1Status = lessons[0]?.status ?? null;
    const openFeeRow = fees.find((f) => f.status === "not_due" || f.status === "invoiced") ?? null;
    const billed = sumBilledFeeHkd(fees as BilledFeeRow[]);
    // The standard 1.5-lesson admin fee on the SAME rate basis the desk uses
    // (#385 pure helper: rate × 1.5 × students) — null when no rate is locked.
    const standardFeeHkd =
      c.hourly_rate_hkd != null
        ? fullAdminFeeAmount(Number(c.hourly_rate_hkd), c.student_count)
        : null;
    return {
      caseCode: c.case_code,
      packageType: c.package_type,
      hourlyRateHkd: c.hourly_rate_hkd == null ? null : Number(c.hourly_rate_hkd),
      studentCount: c.student_count,
      isShortCase: c.is_short_case,
      scheduledLessonCount: c.scheduled_lesson_count,
      sessionLengthMinutes:
        c.session_length_minutes == null ? null : Number(c.session_length_minutes),
      hoursPerLesson: hoursPerLessonFromMinutes(c.session_length_minutes),
      shortCaseFee: c.short_case_fee == null ? null : Number(c.short_case_fee),
      confirmedBy: c.short_case_confirmed_by,
      confirmedAt: c.short_case_confirmed_at,
      lesson1Status,
      // The desk button mirrors the pure trigger rule; the count=1 booking
      // case is allowed straight away, otherwise Lesson 1 must be confirmed.
      invoiceReady:
        c.is_short_case &&
        (c.scheduled_lesson_count != null
          ? shouldInvoiceShortFee({ scheduledLessonCount: c.scheduled_lesson_count, lesson1Status })
          : false),
      invoicedTotalHkd: billed,
      openFee: openFeeRow
        ? { id: openFeeRow.id, status: openFeeRow.status, amountHkd: Number(openFeeRow.amount_hkd) }
        : null,
      standardFeeHkd,
      convertBalanceHkd:
        c.is_short_case && standardFeeHkd != null
          ? convertBalanceAmountHkd(standardFeeHkd, billed)
          : null,
      cohortBlocked: squadBlocked(c),
    };
  });

const setShortCaseInput = z.object({
  caseId: z.string().uuid(),
  isShortCase: z.boolean(),
  scheduledLessonCount: z.number().int().min(1).max(5).optional().nullable(),
  // Duration input = the EXISTING session_length_minutes column (minutes).
  // Admin-editable while short, per the issue — we write it back to the case.
  sessionLengthMinutes: z.number().positive().optional().nullable(),
  confirmedBy: z.enum(["parent_wa", "org_wa", "cs_note"]).optional().nullable(),
  confirmedNote: z.string().max(2000).optional().nullable(),
});

export const setShortCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setShortCaseInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean; shortCaseFee: number | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const c = await loadShortCase(db, data.caseId);

    if (!data.isShortCase) {
      // Toggle off (or convert will handle the invoice side) — clear the
      // package inputs per the DB shape CHECK and reconcile package_type
      // back to the ongoing rule (never clobber pro_bono). Duration stays on
      // session_length_minutes — it is a standard-case column, not package
      // state, so converting back must not blank it.
      const { error } = await db
        .from<Row>("tutoring_cases")
        .update({
          is_short_case: false,
          scheduled_lesson_count: null,
          short_case_fee: null,
          short_case_confirmed_by: null,
          short_case_confirmed_at: null,
          ...(c.package_type === "short_20" ? { package_type: "ongoing_1_5" } : {}),
        } as Row)
        .eq("id", c.id);
      if (error) throw new Error(error.message);
      await insertAudit(db, c.id, context.userId, "short_case", "short_case_off", null);
      return { ok: true, shortCaseFee: null };
    }

    // Guard 1 — squad-shaped cases: no squad marker column exists on
    // tutoring_cases (documented gap), so the closest safe backstops are the
    // group-cohort case shape (#391 group classes bill 1.5 × per-student) and
    // squad-ish tags.
    if (squadBlocked(c)) throw new Error("SQUAD_CASE_NOT_ALLOWED");

    // Guard 2 — $0 Pro-Bono wins over the short 20%.
    if (c.package_type === "pro_bono") throw new Error("PRO_BONO_NOT_ALLOWED");

    // Guard 3 — package shape (count 1–5, positive session length).
    const shapeError = validateShortCaseInputs({
      scheduledLessonCount: data.scheduledLessonCount,
      sessionLengthMinutes: data.sessionLengthMinutes,
    });
    if (shapeError) throw new Error(shapeError);

    // Guard 4 — REQUIRED confirmation (parent WA B2C / org WA B2B / CS note).
    const confirmError = shortCaseConfirmationError({
      confirmedBy: data.confirmedBy,
      confirmedNote: data.confirmedNote,
    });
    if (confirmError) throw new Error(confirmError);

    const rateHkd = c.hourly_rate_hkd;
    if (rateHkd == null) throw new Error("NO_RATE_ON_CASE");
    const count = data.scheduledLessonCount as number;
    const minutes = Number(data.sessionLengthMinutes);
    const hours = hoursPerLessonFromMinutes(minutes) as number;
    const fee = shortCaseFeeAmount({
      rateHkd: Number(rateHkd),
      hoursPerLesson: hours,
      scheduledLessonCount: count,
      packageType: c.package_type,
    });

    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({
        is_short_case: true,
        scheduled_lesson_count: count,
        session_length_minutes: minutes,
        short_case_fee: fee,
        short_case_confirmed_by: data.confirmedBy,
        short_case_confirmed_at: new Date().toISOString(),
        package_type: "short_20",
      } as Row)
      .eq("id", c.id);
    if (error) throw new Error(error.message);

    // The pasted WA text is stored as a case note (existing storage) with a
    // greppable prefix — no new column, full audit trail.
    const { error: noteError } = await db
      .from<Row>("case_notes")
      .insert({
        case_id: c.id,
        author_id: context.userId,
        author_name: "Short-case confirm",
        body: buildShortCaseConfirmNote(
          data.confirmedBy as "parent_wa" | "org_wa" | "cs_note",
          data.confirmedNote ?? "",
        ),
      } as Row)
      .select("id")
      .single();
    if (noteError) throw new Error(noteError.message);

    await insertAudit(
      db,
      c.id,
      context.userId,
      "short_case",
      "short_case_on",
      `${count} × ${minutes}min (${hoursLabel(hours)}) @ HK$${Number(rateHkd)} → 20% = HK$${fee} (${data.confirmedBy})`,
    );
    return { ok: true, shortCaseFee: fee };
  });

export const invoiceShortCaseFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean; amountHkd: number | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const c = await loadShortCase(db, data.caseId);

    if (!c.is_short_case) throw new Error("NOT_SHORT_CASE");
    if (c.package_type === "pro_bono") throw new Error("PRO_BONO_NOT_ALLOWED");
    if (c.hourly_rate_hkd == null) throw new Error("NO_RATE_ON_CASE");
    const shapeError = validateShortCaseInputs({
      scheduledLessonCount: c.scheduled_lesson_count,
      sessionLengthMinutes: c.session_length_minutes,
    });
    if (shapeError) throw new Error(shapeError);
    const hours = hoursPerLessonFromMinutes(c.session_length_minutes) as number;

    const fees = await loadFees(db, data.caseId);
    if (fees.some((f) => f.status === "invoiced" || f.status === "paid")) {
      throw new Error("OPEN_FEE_EXISTS");
    }

    const amount = shortCaseFeeAmount({
      rateHkd: Number(c.hourly_rate_hkd),
      hoursPerLesson: hours,
      scheduledLessonCount: Number(c.scheduled_lesson_count),
      packageType: c.package_type,
    });
    const multiplier = shortCaseFeeMultiplier(hours, Number(c.scheduled_lesson_count));

    const { error } = await db
      .from<Row>("case_fees")
      .insert({
        case_id: c.id,
        rate_hkd: c.hourly_rate_hkd,
        multiplier,
        amount_hkd: amount,
        status: "invoiced",
        due_at: feeDueAtFrom(new Date()).toISOString(),
      } as Row)
      .select("id")
      .single();
    if (error) {
      throw new Error(/duplicate|unique/i.test(error.message) ? "OPEN_FEE_EXISTS" : error.message);
    }
    await insertAudit(
      db,
      c.id,
      context.userId,
      null,
      "fee_invoiced",
      `short case 20% — ${c.scheduled_lesson_count} × ${c.session_length_minutes}min (${hoursLabel(hours)}) @ HK$${Number(c.hourly_rate_hkd)} = HK$${amount}`,
    );
    return { ok: true, amountHkd: amount };
  });

export const convertShortCaseToStandard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ ok: boolean; balanceHkd: number; invoicedBalance: boolean }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      await requireAdmin(db, context.userId);
      const c = await loadShortCase(db, data.caseId);
      if (!c.is_short_case) throw new Error("NOT_SHORT_CASE");
      if (c.hourly_rate_hkd == null) throw new Error("NO_RATE_ON_CASE");

      // Standard 1.5-lesson admin fee on the SAME rate×basis the codebase
      // uses for ongoing cases (#385 pure helper: rate × 1.5 × students).
      // NEVER rate × (minutes/60) × 1.5 — mixing the package-hour basis into
      // the standard target is the documented drift bug (issue #443 convert
      // lock). Duration is NOT re-multiplied here.
      const standardFee = fullAdminFeeAmount(Number(c.hourly_rate_hkd), c.student_count);

      const fees = await loadFees(db, data.caseId);
      const billed = sumBilledFeeHkd(fees as BilledFeeRow[]);
      const balance = convertBalanceAmountHkd(standardFee, billed);

      // Flip the case off short FIRST; package_type reconciles back to the
      // ongoing rule unless the case is pro-bono ($0 wins — leave that).
      // session_length_minutes is untouched: standard cases carry it too.
      const { error } = await db
        .from<Row>("tutoring_cases")
        .update({
          is_short_case: false,
          scheduled_lesson_count: null,
          short_case_fee: null,
          short_case_confirmed_by: null,
          short_case_confirmed_at: null,
          ...(c.package_type === "short_20" ? { package_type: "ongoing_1_5" } : {}),
        } as Row)
        .eq("id", c.id);
      if (error) throw new Error(error.message);

      // An open short-case invoice (not_due/invoiced, unpaid) is replaced by
      // the standard rule — waive it with the documented reason so the desk's
      // existing waive path semantics apply (#425: waived = obligation met).
      for (const fee of fees) {
        if (fee.status === "not_due" || fee.status === "invoiced") {
          const { error: waiveError } = await db
            .from<Row>("case_fees")
            .update({
              status: "waived",
              waive_reason: "Short case converted to standard fee rule",
            } as Row)
            .eq("id", fee.id);
          if (waiveError) throw new Error(waiveError.message);
          await insertAudit(
            db,
            c.id,
            context.userId,
            "fee_invoiced",
            "fee_waived",
            "short case converted to standard",
          );
        }
      }

      // Only a POSITIVE balance invoices — 0 means "No balance due" and must
      // never create a row (never over-invoice).
      let invoicedBalance = false;
      if (balance > 0) {
        const { error: feeError } = await db
          .from<Row>("case_fees")
          .insert({
            case_id: c.id,
            rate_hkd: c.hourly_rate_hkd,
            multiplier: 1.5,
            amount_hkd: balance,
            status: "invoiced",
            due_at: feeDueAtFrom(new Date()).toISOString(),
          } as Row)
          .select("id")
          .single();
        if (feeError) throw new Error(feeError.message);
        await insertAudit(
          db,
          c.id,
          context.userId,
          null,
          "fee_invoiced",
          `convert to standard: 1.5× HK$${Number(c.hourly_rate_hkd)} = HK$${standardFee} − billed HK$${billed} = balance HK$${balance}`,
        );
        invoicedBalance = true;
      } else {
        await insertAudit(
          db,
          c.id,
          context.userId,
          "short_case",
          "short_case_off",
          `converted to standard — balance HK$0 (standard HK$${standardFee} − billed HK$${billed}), no invoice`,
        );
      }
      return { ok: true, balanceHkd: balance, invoicedBalance };
    },
  );
