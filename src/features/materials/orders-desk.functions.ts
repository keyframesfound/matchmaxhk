import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { sweepExpiredHolds } from "@/features/materials/escrow.functions";

/**
 * Admin order queue for the manual cashier (#203). The write actions live in
 * checkout.functions.ts; this file adds the admin LIST with the pack title
 * joined, and re-exports the actions so the desk component has one import.
 *
 * #429: the list carries the escrow state — hold_until + released_at +
 * refund_amount + the dispute fields — and runs the lazy hold-expiry sweep
 * so the desk shows released (payable) rows the moment a window lapses.
 */

export type AdminOrderRow = {
  id: string;
  reference: string | null;
  material_title: string | null;
  gross_hkd: number;
  status: string;
  has_screenshot: boolean;
  fps_reference: string | null;
  created_at: string;
  // --- #429 escrow state.
  hold_until: string | null;
  released_at: string | null;
  refund_amount: number | null;
  dispute_status: string | null;
  dispute_reason: string | null;
  dispute_detail: string | null;
  dispute_opened_at: string | null;
  has_dispute_evidence: boolean;
};

export const listMaterialOrdersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOrderRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    // #429: expired holds become released/hold_expired before the read.
    await sweepExpiredHolds(db);

    for (const role of ["admin", "super_admin"] as const) {
      const { data: ok } = await db.rpc("has_role", { _user_id: context.userId, _role: role });
      if (ok !== true) continue;

      const { data, error } = await db
        .from<{
          id: string;
          reference: string | null;
          gross_hkd: number;
          status: string;
          payment_screenshot_path: string | null;
          fps_reference: string | null;
          created_at: string;
          hold_until: string | null;
          released_at: string | null;
          refund_amount: number | null;
          dispute_status: string | null;
          dispute_reason: string | null;
          dispute_detail: string | null;
          dispute_opened_at: string | null;
          dispute_evidence_path: string | null;
          digital_materials: { title: string } | null;
        }>("material_orders")
        .select(
          "id, reference, gross_hkd, status, payment_screenshot_path, fps_reference, created_at, hold_until, released_at, refund_amount, dispute_status, dispute_reason, dispute_detail, dispute_opened_at, dispute_evidence_path, digital_materials(title)",
        )
        .in("status", [
          "awaiting_payment",
          "paid",
          "stamping",
          "delivered",
          "stamp_failed",
          "rejected",
          "refunded",
          "held",
          "released",
          "refunded_from_hold",
        ])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        reference: row.reference,
        material_title: row.digital_materials?.title ?? null,
        gross_hkd: Number(row.gross_hkd),
        status: row.status,
        has_screenshot: Boolean(row.payment_screenshot_path),
        fps_reference: row.fps_reference,
        created_at: row.created_at,
        hold_until: row.hold_until,
        released_at: row.released_at,
        refund_amount: row.refund_amount == null ? null : Number(row.refund_amount),
        dispute_status: row.dispute_status,
        dispute_reason: row.dispute_reason,
        dispute_detail: row.dispute_detail,
        dispute_opened_at: row.dispute_opened_at,
        has_dispute_evidence: Boolean(row.dispute_evidence_path),
      }));
    }
    throw new Error("Forbidden");
  });

export {
  markOrderPaid,
  releaseOrder,
  rejectOrder,
  getOrderScreenshotUrl,
} from "@/features/materials/checkout.functions";

export {
  confirmOrderReceived,
  openOrderDispute,
  getDisputeEvidenceUrl,
  decideOrderDispute,
} from "@/features/materials/escrow.functions";
