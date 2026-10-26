import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import {
  canOpenDispute,
  disputeRefundTarget,
  disputeRejectTarget,
  holdWindowHours,
  isHoldExpired,
  splitRefundMoney,
  validateDisputeRefundAmount,
  HOLD_HISTORY_STATUSES,
} from "@/features/materials/lifecycle";

/**
 * Issue #429 (V1 core): escrow hold + seller-funded refunds.
 *
 * After staff release, the order sits in 'held' with hold_until =
 * delivered_at + window (72h new seller / 48h established). The buyer can
 * tap "Received / No issue" to release early; a lazy sweep (called on the
 * desk + buyer reads, the #328 no-cron pattern) flips expired holds to
 * released; staff decide disputes FROM THE HOLD ONLY — refund (full or
 * partial, money recomputed) or reject (releases normally). MatchMax never
 * refunds from corporate cash, and no payout job exists: the desk is the
 * gate (a held row is never payable).
 */

const SCREENSHOTS_BUCKET = "orders-screenshots";

async function isAdmin(db: AdminDb, userId: string): Promise<boolean> {
  for (const role of ["admin", "super_admin"] as const) {
    const { data: ok } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (ok === true) return true;
  }
  return false;
}

/**
 * Lazy hold-expiry sweep: held rows past their hold_until flip to
 * released/hold_expired so the desk + payout export see them as payable.
 * Rows with an OPEN dispute are skipped: the dispute freezes the release
 * until staff decide (a refund is only possible from still-held funds).
 * Advisory (never throws) exactly like the #328 gig sweep.
 */
export async function sweepExpiredHolds(db: AdminDb): Promise<void> {
  try {
    await db
      .from<never>("material_orders")
      .update({
        status: "released",
        released_at: new Date().toISOString(),
        released_reason: "hold_expired",
      })
      .eq("status", "held")
      .lte("hold_until", new Date().toISOString())
      .or("dispute_status.is.null,dispute_status.neq.open");
  } catch {
    // Advisory: pre-migration env or a hiccup must not break the read.
  }
}

/**
 * The seller's hold window in hours, from their completed (non-grant)
 * delivery history: newest rule needs the count and the OLDEST delivery.
 * Plain async helper so releaseOrder (checkout.functions) can call it —
 * TanStart server fns cannot call each other from a handler.
 */
export async function getTutorHoldWindowHours(db: AdminDb, tutorId: string): Promise<number> {
  const { data: rows } = await db
    .from<{ delivered_at: string }>("material_orders")
    .select("delivered_at")
    .eq("tutor_id", tutorId)
    .in("status", [...HOLD_HISTORY_STATUSES])
    .eq("is_grant", false)
    .order("delivered_at", { ascending: true })
    .limit(3);
  const list = rows ?? [];
  return holdWindowHours(list.length, list[0]?.delivered_at ?? null, new Date());
}

/** Buyer taps "Received / No issue": the held funds release early. */
export const confirmOrderReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: order } = await db
      .from<{
        id: string;
        status: string;
        buyer_account_id: string;
        dispute_status: string | null;
      }>("material_orders")
      .select("id, status, buyer_account_id, dispute_status")
      .eq("id", data.orderId)
      .eq("buyer_account_id", context.userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.status !== "held") {
      throw new Error("This order is not on hold.");
    }
    // An open dispute freezes the hold: staff decide it (refund or reject),
    // so the buyer cannot self-release the funds mid-dispute.
    if (order.dispute_status === "open") {
      throw new Error("A dispute is open on this order. Our team will review it.");
    }

    const { error } = await db
      .from<never>("material_orders")
      .update({
        status: "released",
        released_at: new Date().toISOString(),
        released_reason: "buyer_confirmed",
      })
      .eq("id", order.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Buyer opens the dispute (window = the hold period): reason enum + free
 * text + optional evidence image into the PRIVATE orders-screenshots
 * bucket (disputes/<order id>-<stamp>.<ext>), same pattern as the FPS proof.
 * One dispute per order in V1.
 */
export const openOrderDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.enum(["file_defective", "materially_different", "not_as_described"]),
        detail: z.string().trim().min(10).max(1000),
        base64Data: z.string().trim().min(50).max(8_000_000).optional(), // ≤5MB image
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
      })
      .refine((v) => !v.base64Data || Boolean(v.contentType), {
        message: "contentType is required with evidence",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: order } = await db
      .from<{
        id: string;
        status: string;
        buyer_account_id: string;
        dispute_status: string | null;
        hold_until: string | null;
      }>("material_orders")
      .select("id, status, buyer_account_id, dispute_status, hold_until")
      .eq("id", data.orderId)
      .eq("buyer_account_id", context.userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (!canOpenDispute(order.status)) {
      throw new Error("The dispute window for this order has closed.");
    }
    // Belt-and-braces: an expired hold the sweep has not flipped yet is a
    // closed window (refunds come from STILL-HELD funds only).
    if (order.status === "held" && isHoldExpired(order.hold_until)) {
      throw new Error("The dispute window for this order has closed.");
    }
    if (order.dispute_status) {
      throw new Error("A dispute was already opened on this order.");
    }

    let evidencePath: string | null = null;
    if (data.base64Data && data.contentType) {
      const bytes = Buffer.from(data.base64Data, "base64");
      if (bytes.byteLength > 5 * 1024 * 1024) {
        throw new Error("Screenshot is too large. Maximum is 5MB.");
      }
      const ext =
        data.contentType === "image/png"
          ? "png"
          : data.contentType === "image/webp"
            ? "webp"
            : "jpg";
      evidencePath = `disputes/${order.id}-${Date.now().toString(36)}.${ext}`;
      const { error: uploadError } = await db.storage
        .from(SCREENSHOTS_BUCKET)
        .upload(evidencePath, bytes, { contentType: data.contentType });
      if (uploadError) throw new Error(uploadError.message);
    }

    const { error } = await db
      .from<never>("material_orders")
      .update({
        dispute_status: "open",
        dispute_reason: data.reason,
        dispute_detail: data.detail,
        dispute_evidence_path: evidencePath,
        dispute_opened_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Staff view of the buyer's dispute evidence (admin-only, signed, 10 minutes). */
export const getDisputeEvidenceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    if (!(await isAdmin(db, context.userId))) throw new Error("Forbidden");

    const { data: order } = await db
      .from<{ dispute_evidence_path: string | null }>("material_orders")
      .select("dispute_evidence_path")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order?.dispute_evidence_path) throw new Error("No evidence attached.");
    const { data: signed, error } = await db.storage
      .from(SCREENSHOTS_BUCKET)
      .createSignedUrl(order.dispute_evidence_path, 600);
    if (error || !signed) throw new Error(error?.message || "Failed to sign URL");
    return { signedUrl: signed.signedUrl };
  });

/**
 * Staff dispute decision (admin-gated, service-role). refund: FROM THE HOLD
 * ONLY — the amount must be > 0 and ≤ gross; the money is recomputed
 * (MatchMax keeps 20% of the non-refunded portion, $0 fee + $0 net on a full
 * refund) and the row shows refund_amount + decided_at/by. reject: a held
 * order releases normally; a legacy delivered row just closes the dispute.
 */
export const decideOrderDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        decision: z.enum(["refund", "reject"]),
        refundAmountHkd: z.number().positive().optional(),
      })
      .refine((v) => v.decision !== "refund" || v.refundAmountHkd != null, {
        message: "refundAmountHkd is required for a refund decision",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    if (!(await isAdmin(db, context.userId))) throw new Error("Forbidden");

    const { data: order } = await db
      .from<{ id: string; status: string; gross_hkd: number; dispute_status: string | null }>(
        "material_orders",
      )
      .select("id, status, gross_hkd, dispute_status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.dispute_status !== "open") {
      throw new Error("No open dispute on this order.");
    }

    const now = new Date().toISOString();

    if (data.decision === "refund") {
      if (disputeRefundTarget(order.status) === null) {
        throw new Error("Refunds are only possible while the payment is still held.");
      }
      const gross = Number(order.gross_hkd);
      const amount = Number(data.refundAmountHkd);
      const invalid = validateDisputeRefundAmount(amount, gross);
      if (invalid) throw new Error(invalid);
      const split = splitRefundMoney(gross, amount);
      const { error } = await db
        .from<never>("material_orders")
        .update({
          status: "refunded_from_hold",
          refund_amount: split.refundedHkd,
          platform_fee_hkd: split.platformFeeHkd,
          tutor_net_hkd: split.tutorNetHkd,
          dispute_status: "refunded",
          decided_at: now,
          decided_by: context.userId,
        })
        .eq("id", order.id);
      if (error) throw new Error(error.message);
      return { ok: true, status: "refunded_from_hold" as const };
    }

    const target = disputeRejectTarget(order.status);
    if (target === null) {
      throw new Error(`Order in status "${order.status}" cannot resolve a dispute.`);
    }
    const update =
      target === "released"
        ? {
            status: "released",
            released_at: now,
            released_reason: "dispute_rejected",
            dispute_status: "rejected",
            decided_at: now,
            decided_by: context.userId,
          }
        : {
            dispute_status: "rejected",
            decided_at: now,
            decided_by: context.userId,
          };
    const { error } = await db.from<never>("material_orders").update(update).eq("id", order.id);
    if (error) throw new Error(error.message);
    return { ok: true, status: target };
  });
