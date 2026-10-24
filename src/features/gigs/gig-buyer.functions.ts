import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  MAX_GIG_FILE_BYTES,
  canParentRequestRefund,
  transitionGigOrder,
} from "@/features/gigs/gig";

/**
 * Issues #328/#329: buyer-side controls for gig fulfillment orders — the
 * public gig's delivered count, the file_back source upload, and the
 * parent's past-due self-serve refund. Server-side service role throughout;
 * ownership is re-checked on every call (RLS does not apply to the service
 * client). No staff columns and no tutor contact ever cross this surface.
 */

/** #328 lazy sweep: flips in_fulfillment gig orders past due+24h grace. */
export async function sweepPastDueGigOrders(db: ReturnType<typeof asAdminDb>): Promise<void> {
  try {
    await db.rpc("sweep_past_due_gig_orders", {});
  } catch {
    // The sweep is advisory — if the RPC is missing (pre-migration env) or
    // hiccups, the read still returns and staff desk shows real statuses.
  }
}

/** #329: delivered orders ONLY count toward the public bought figure. */
export const getGigBoughtCount = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { data: rows } = await db
      .from<{ id: string }>("material_orders")
      .select("id")
      .eq("material_id", data.materialId)
      .eq("status", "delivered");
    return { count: rows?.length ?? 0 };
  });

const SOURCE_BUCKET = "materials-originals";

const GIG_SOURCE_MIME = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

type GigOrderRow = {
  id: string;
  status: string;
  tutor_id: string;
  buyer_account_id: string;
  material_type: string | null;
  gig_delivery_type: string | null;
};

/**
 * #328 file_back upload: the buyer's ONE source document (PDF or DOCX, ≤
 * MAX_GIG_FILE_BYTES). Stored in the PRIVATE materials-originals bucket
 * under gigs-orders/<orderId>/ so only the service role (and the tutor's
 * fulfillment fn) can read it. Re-uploads replace the file (upsert) — the
 * tutor's desk always reads the latest source.
 */
export const uploadGigSourceFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        base64Data: z.string().trim().min(50).max(28_000_000), // ≈20MB decoded
        contentType: z.enum([
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: order } = await db
      .from<GigOrderRow>("material_orders")
      .select(
        "id, status, tutor_id, buyer_account_id, digital_materials(material_type, gig_delivery_type)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.buyer_account_id !== context.userId) throw new Error("Order not found.");

    const material = (
      order as unknown as {
        digital_materials?: { material_type?: string; gig_delivery_type?: string } | null;
      }
    ).digital_materials;
    if (material?.material_type !== "gig") throw new Error("This order is not a service.");
    if (material.gig_delivery_type !== "file_back") {
      throw new Error("This service does not take a source file.");
    }
    if (order.status !== "in_fulfillment" && order.status !== "past_due") {
      throw new Error("This order is not waiting for your file.");
    }

    const bytes = Buffer.from(data.base64Data, "base64");
    if (bytes.byteLength > MAX_GIG_FILE_BYTES) {
      throw new Error("File is too large. Maximum is 20MB.");
    }
    const ext = GIG_SOURCE_MIME[data.contentType];
    const path = `gigs-orders/${order.id}/source.${ext}`;
    const { error } = await db.storage.from(SOURCE_BUCKET).upload(path, bytes, {
      contentType: data.contentType,
      upsert: true,
    });
    if (error) throw new Error(error.message);

    const { error: updateError } = await db
      .from<never>("material_orders")
      .update({ buyer_source_path: path })
      .eq("id", order.id);
    if (updateError) throw new Error(updateError.message);
    return { ok: true, path };
  });

/**
 * #328 parent self-serve refund: allowed ONLY from past_due
 * (canParentRequestRefund). Marks the order refunded through the state
 * machine (transitionGigOrder), stamps refund_requested_at, and files one
 * tutor_ghost_strikes row (service-role insert; the table has no INSERT
 * policy on purpose). Idempotent-ish by status guard: a concurrent refund
 * makes the guarded UPDATE affect zero rows and the call fails loudly
 * instead of double-striking.
 */
export const requestGigRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: order } = await db
      .from<GigOrderRow>("material_orders")
      .select("id, status, tutor_id, buyer_account_id, digital_materials(material_type)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.buyer_account_id !== context.userId) throw new Error("Order not found.");

    const material = (order as unknown as { digital_materials?: { material_type?: string } | null })
      .digital_materials;
    if (material?.material_type !== "gig") throw new Error("This order is not a service.");
    if (!canParentRequestRefund(order.status)) {
      throw new Error("A refund can only be requested after the delivery is past due.");
    }
    const nextStatus = transitionGigOrder(order.status, "request_refund");
    if (nextStatus !== "refunded") throw new Error("This refund is not allowed right now.");

    const { error: updateError } = await (
      db.from<never>("material_orders") as unknown as {
        update: (row: unknown) => {
          eq: (
            c: string,
            v: unknown,
          ) => {
            eq: (c: string, v: unknown) => Promise<{ error: { message: string } | null }>;
          };
        };
      }
    )
      .update({
        status: nextStatus,
        refund_requested_at: new Date().toISOString(),
      })
      // Status guard: the past_due -> refunded flip happens exactly once.
      .eq("id", order.id)
      .eq("status", order.status);
    if (updateError) throw new Error(updateError.message);

    // One strike per refunded past-due order (order_id UNIQUE in the table).
    const { error: strikeError } = await db.from<never>("tutor_ghost_strikes").insert({
      tutor_id: order.tutor_id,
      order_id: order.id,
      reason: "Past-due refund — parent requested",
      created_by: context.userId,
    });
    if (strikeError) throw new Error(strikeError.message);

    return { ok: true, status: nextStatus };
  });
