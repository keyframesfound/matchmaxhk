/**
 * #784 §2.2: staff view of the weekly Monday FPS payout run.
 *
 * Read-only on purpose. The locked policy pays every seller whose released
 * net is at least HK$50 every Monday; this returns who that is today, so the
 * desk can transfer and then record the batch. Writing the batch is a
 * separate, explicitly-confirmed action (money movement is never implicit).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin, selectRows, type Db } from "@/features/cases/desk-db";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  buildPayoutPreview,
  type PayoutDetails,
  type PayoutLedgerRow,
  type PayoutPreview,
  type PayoutSeller,
} from "@/features/materials/payout-batch";

/** The preview, computed from the live ledger. Shared by the read fn and the batch write. */
async function loadPayoutPreview(db: Db): Promise<PayoutPreview> {
  const [entries, sellers, details] = await Promise.all([
    selectRows<PayoutLedgerRow>(db, "seller_balance_entries", "user_id, amount_hkd, kind", []),
    selectRows<{
      user_id: string | null;
      display_name: string | null;
      tutor_code: string | null;
    }>(db, "tutors", "user_id, display_name, tutor_code", []),
    selectRows<PayoutDetails>(
      db,
      "seller_payout_details",
      "user_id, payout_method, payee_name",
      [],
    ),
  ]);

  const sellerRows: PayoutSeller[] = sellers
    .filter((row): row is PayoutSeller => Boolean(row.user_id))
    .map((row) => ({
      user_id: row.user_id as string,
      display_name: row.display_name,
      tutor_code: row.tutor_code,
    }));

  return buildPayoutPreview(entries, sellerRows, details);
}

export const getWeeklyPayoutPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutPreview> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    return loadPayoutPreview(db);
  });

/**
 * Roles that may sign off a payout batch. The approver is always a second
 * person: the caller runs the batch, someone else holds the approval.
 */
const PAYOUT_APPROVER_ROLES = ["admin", "super_admin"] as const;

export type PayoutApprover = { id: string; label: string };

/**
 * A handle for the approver picker. Mirrors the admin user directory, which
 * shows the display name and falls back to the account email (UsersTable.tsx);
 * a row with neither gets a short id stub rather than an empty option.
 */
export function payoutApproverLabel(row: {
  id: string;
  display_name: string | null;
  email?: string | null;
}): string {
  return row.display_name?.trim() || row.email?.trim() || `#${row.id.slice(0, 8)}`;
}

/**
 * #784 money-safety: batches carrying HK$500+ of adjustments need a second
 * admin's sign-off, read from user_roles rather than a client claim. Everyone
 * with the role except the caller, so the tick-from-the-same-person fiction
 * cannot come back through the picker.
 */
export const listPayoutApprovers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutApprover[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const roleRows = await selectRows<{ user_id: string }>(db, "user_roles", "user_id", [
      { col: "role", op: "in", value: [...PAYOUT_APPROVER_ROLES] },
    ]);
    const ids = [...new Set(roleRows.map((row) => row.user_id))].filter(
      (id) => id && id !== context.userId,
    );
    if (ids.length === 0) return [];

    const profiles = await selectRows<{
      id: string;
      display_name: string | null;
      email: string | null;
    }>(db, "profiles", "id, display_name, email", [{ col: "id", op: "in", value: ids }]);

    return profiles
      .map((row) => ({ id: row.id, label: payoutApproverLabel(row) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

const round2 = (value: number) => Math.round(value * 100) / 100;

/** A payout row can only be sent when a transfer target is actually known. */
export function hasPayoutTarget(row: { method: string | null; payeeName: string | null }): boolean {
  return Boolean(row.method?.trim()) && Boolean(row.payeeName?.trim());
}

/**
 * The rows that may enter a batch: due, and with a transfer target. A seller
 * with no FPS/bank details is held back rather than debited with nowhere to
 * send the money — the admin screen already reports them as missing details.
 */
export function selectBatchPayable<
  T extends { dueHkd: number; method: string | null; payeeName: string | null },
>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.dueHkd > 0 && hasPayoutTarget(row));
}

export type PayoutApprovalErrorCode =
  "APPROVER_REQUIRED" | "SELF_APPROVAL_FORBIDDEN" | "APPROVER_NOT_ADMIN";

export type PayoutApproval =
  { ok: true; approvedBy: string } | { ok: false; code: PayoutApprovalErrorCode };

/**
 * Who signs off this batch. Below the HK$500 adjustment threshold the run is
 * self-approved by the caller; at or above it a different, real admin must be
 * named. `approverRoles` is the role set read from user_roles for that user —
 * never a value the client sent — so a forged approverId fails closed.
 */
export function resolvePayoutApproval(input: {
  callerId: string;
  approverId?: string | null;
  needsApproval: boolean;
  approverRoles?: readonly string[];
}): PayoutApproval {
  if (!input.needsApproval) return { ok: true, approvedBy: input.callerId };

  const approverId = input.approverId?.trim() ?? "";
  if (!approverId) return { ok: false, code: "APPROVER_REQUIRED" };
  if (approverId === input.callerId) return { ok: false, code: "SELF_APPROVAL_FORBIDDEN" };
  const roles = input.approverRoles ?? [];
  if (!roles.some((role) => (PAYOUT_APPROVER_ROLES as readonly string[]).includes(role))) {
    return { ok: false, code: "APPROVER_NOT_ADMIN" };
  }
  return { ok: true, approvedBy: approverId };
}

/** Admin roles actually held by `userId`, straight from user_roles. */
async function readApproverRoles(db: Db, userId: string): Promise<string[]> {
  const rows = await selectRows<{ role: string }>(db, "user_roles", "role", [
    { col: "user_id", op: "eq", value: userId },
    { col: "role", op: "in", value: [...PAYOUT_APPROVER_ROLES] },
  ]);
  return rows.map((row) => row.role);
}

/**
 * Runs the Monday FPS batch: one ledger payout entry per seller, a batch row
 * and its items, all inside the run_payout_batch() RPC so a partial write can
 * never leave a seller paid twice or not at all.
 *
 * The preview is recomputed here — the client never supplies amounts. A batch
 * containing HK$500 or more of adjustments needs a second admin's sign-off,
 * named by approverId and verified against user_roles here, at the same
 * MANAGER_APPROVAL_HKD threshold the preview reports.
 *
 * Two money-safety rules are load-bearing:
 *
 *   * A seller with no payout method/payee is excluded, not paid-and-wiped.
 *     The rest of the run still goes out so ops are never blocked by one
 *     missing row; the response reports how many were held back.
 *   * The RPC re-checks each seller's live ledger balance under an advisory
 *     lock, so a stale preview or a double POST cannot pay the same balance
 *     twice.
 */
export const runPayoutBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        batchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string().max(500).optional(),
        /** The second admin signing off a HK$500+ adjustment batch. */
        approverId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const preview = await loadPayoutPreview(db);
    const dueCount = preview.rows.filter((row) => row.dueHkd > 0).length;
    const payable = selectBatchPayable(preview.rows);
    const heldCount = dueCount - payable.length;
    if (payable.length === 0) {
      throw new Error(heldCount > 0 ? "MISSING_PAYOUT_DETAILS" : "NO_SELLERS_DUE");
    }

    // Two-person control: the approver's roles come from user_roles, so a
    // pasted uuid cannot stand in for a real second admin.
    const approverId = data.approverId?.trim() || null;
    const approverRoles =
      approverId && preview.needsManagerApproval
        ? await readApproverRoles(db, approverId)
        : ([] as string[]);
    const approval = resolvePayoutApproval({
      callerId: context.userId,
      approverId,
      needsApproval: preview.needsManagerApproval,
      approverRoles,
    });
    if (!approval.ok) throw new Error(approval.code);

    const items = payable.map((row) => ({
      userId: row.userId,
      sellerName: row.sellerName,
      tutorCode: row.tutorCode,
      balanceHkd: row.balanceHkd,
      paidHkd: row.dueHkd,
      method: row.method,
      payeeName: row.payeeName,
    }));

    const { data: batchId, error } = await db.rpc("run_payout_batch", {
      p_batch_date: data.batchDate,
      p_note: data.note ?? null,
      p_items: items,
      p_created_by: context.userId,
      p_approved_by: approval.approvedBy,
    });
    if (error) throw new Error(error.message);

    return {
      batchId: batchId as unknown as string,
      sellerCount: items.length,
      // Sum of what was actually sent, not the preview total: rows held back
      // for missing details must not inflate the reported batch value.
      totalHkd: round2(items.reduce((sum, item) => sum + item.paidHkd, 0)),
      /** Due sellers left out of this run because they have no transfer target. */
      heldCount,
    };
  });
