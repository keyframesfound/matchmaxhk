/**
 * Issue #459 slice 4 — parent hours review on the verified-hours ledger.
 *
 * Rows are written by the case_lessons trigger (migration 20261031160000);
 * the parent confirms or disputes a pending row within the 24h window and
 * the hourly cron auto-verifies the rest. The ledger is service-role only
 * (RLS on, no client grants), so every read/write here is scoped by
 * ownership: the row's case must have parent_id = context.userId.
 *
 * Pure guardrails live in features/hours/hours.ts and run BEFORE any write;
 * the CHECK constraints in the migration are the backstop.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { canParentReviewHours, DisputeReason } from "@/features/hours/hours";

export type HoursLedgerRowT = {
  id: string;
  case_lesson_id: string | null;
  status: string;
  duration_hours: number | string;
  occurred_at: string;
  pending_since: string;
  verified_at: string | null;
  verified_by: string | null;
  dispute_reason: string | null;
};

async function hoursDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

async function requireOwnedLedgerRow(
  db: Db,
  userId: string,
  ledgerId: string,
): Promise<HoursLedgerRowT> {
  const rows = await selectRows<{
    id: string;
    case_id: string | null;
    case_lesson_id: string | null;
    status: string;
    duration_hours: number | string;
    occurred_at: string;
    pending_since: string;
    verified_at: string | null;
    verified_by: string | null;
    dispute_reason: string | null;
  }>(
    db,
    "verified_hours_ledger",
    "id, case_id, case_lesson_id, status, duration_hours, occurred_at, pending_since, verified_at, verified_by, dispute_reason",
    [{ col: "id", op: "eq", value: ledgerId }],
  );
  const row = rows[0];
  if (!row || !row.case_id) throw new Error("HOURS_ROW_NOT_FOUND");

  const cases = await selectRows<{ parent_id: string | null }>(db, "tutoring_cases", "parent_id", [
    { col: "id", op: "eq", value: row.case_id },
  ]);
  if (!cases[0] || cases[0].parent_id !== userId) throw new Error("HOURS_ROW_NOT_FOUND");
  return row;
}

export const confirmHoursRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => z.object({ ledgerId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await hoursDb();
    const row = await requireOwnedLedgerRow(db, context.userId, data.ledgerId);
    if (!canParentReviewHours(row, new Date())) throw new Error("HOURS_NOT_PENDING");

    const { error } = await db
      .from("verified_hours_ledger")
      .update({
        status: "verified_completed",
        verified_at: new Date().toISOString(),
        verified_by: "parent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending_confirmation");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disputeHoursRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z.object({ ledgerId: z.string().uuid(), reason: DisputeReason }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await hoursDb();
    const row = await requireOwnedLedgerRow(db, context.userId, data.ledgerId);
    if (!canParentReviewHours(row, new Date())) throw new Error("HOURS_NOT_PENDING");

    const now = new Date().toISOString();
    const { error } = await db
      .from("verified_hours_ledger")
      .update({
        status: "disputed",
        disputed_by: context.userId,
        dispute_reason: data.reason,
        disputed_at: now,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("status", "pending_confirmation");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
