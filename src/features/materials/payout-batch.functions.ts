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
import { requireAdmin, selectRows } from "@/features/cases/desk-db";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  buildPayoutPreview,
  type PayoutDetails,
  type PayoutLedgerRow,
  type PayoutPreview,
  type PayoutSeller,
} from "@/features/materials/payout-batch";

export const getWeeklyPayoutPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayoutPreview> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

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
  });

/**
 * Runs the Monday FPS batch: one ledger payout entry per seller, a batch row
 * and its items, all inside the run_payout_batch() RPC so a partial write can
 * never leave a seller paid twice or not at all.
 *
 * The preview is recomputed here — the client never supplies amounts. A batch
 * containing HK$500 or more of adjustments needs an explicit managerApproval
 * from an admin, matching MANAGER_APPROVAL_HKD.
 */
export const runPayoutBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        batchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string().max(500).optional(),
        managerApproval: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const preview = await getWeeklyPayoutPreview();
    const payable = preview.rows.filter((row) => row.dueHkd > 0);
    if (payable.length === 0) throw new Error("NO_SELLERS_DUE");
    if (preview.needsManagerApproval && !data.managerApproval) {
      throw new Error("MANAGER_APPROVAL_REQUIRED");
    }

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
      p_approved_by: preview.needsManagerApproval ? context.userId : null,
    });
    if (error) throw new Error(error.message);

    return {
      batchId: batchId as unknown as string,
      sellerCount: items.length,
      totalHkd: preview.dueTotalHkd,
    };
  });
