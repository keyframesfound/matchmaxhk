import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";

/**
 * Admin order queue for the manual cashier (#203). The write actions live in
 * checkout.functions.ts; this file adds the admin LIST with the pack title
 * joined, and re-exports the actions so the desk component has one import.
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
};

export const listMaterialOrdersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOrderRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

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
          digital_materials: { title: string } | null;
        }>("material_orders")
        .select(
          "id, reference, gross_hkd, status, payment_screenshot_path, fps_reference, created_at, digital_materials(title)",
        )
        .in("status", [
          "awaiting_payment",
          "paid",
          "stamping",
          "delivered",
          "stamp_failed",
          "rejected",
          "refunded",
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
