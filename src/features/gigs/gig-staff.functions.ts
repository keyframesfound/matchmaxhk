import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import { isUniqueViolation } from "@/features/materials/orders.functions";
import { GIG_ORDER_STATUSES, gigFulfillmentDueAt, transitionGigOrder } from "@/features/gigs/gig";
import type { StatusGuardedOrderUpdate } from "@/features/gigs/gig";

/**
 * Issues #326/#328/#329, the STAFF side of freestyle gigs: the orders-desk
 * fulfillment queue, the #328 ghosting sweep + hidden ghost strikes, and the
 * FPS confirm / staff-refund actions. Mirrors the notes cashier in
 * orders-desk.functions.ts / checkout.functions.ts:
 *   - every fn is admin-checked (has_role admin/super_admin) BEFORE any
 *     service-role query;
 *   - buyer identity never crosses the surface (no phone/email/name; the
 *     buyer_account_id column is not even selected);
 *   - the money split is already on the order row from checkout, never
 *     recomputed here;
 *   - `tutor_ghost_strikes` is SELECT-locked to staff by RLS and written
 *     service-role only (no insert policy on purpose).
 */

export type GigDeskOrder = {
  id: string;
  reference: string | null;
  materialId: string;
  listingTitle: string | null;
  gigCategory: string | null;
  gigDeliveryType: string | null;
  turnaroundNote: string | null;
  turnaroundHours: number | null;
  tutorId: string;
  grossHkd: number;
  status: string;
  hasScreenshot: boolean;
  fpsReference: string | null;
  paidAt: string | null;
  inFulfillmentAt: string | null;
  fulfillmentDueAt: string | null;
  pastDueAt: string | null;
  refundRequestedAt: string | null;
  buyerSourcePath: string | null;
  completionNote: string | null;
  deliveredFilePath: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type GhostStrikeRow = {
  id: string;
  tutorId: string;
  tutorName: string | null;
  tutorCode: string | null;
  orderId: string;
  orderReference: string | null;
  reason: string;
  createdAt: string;
};

/**
 * The update patch for confirming an FPS payment on a gig order: the order
 * jumps awaiting_payment -> in_fulfillment and the #328 fail-safe clock
 * starts (paid_at + stated turnaround, 48h default). Extracted pure for
 * tests, the caller must have already validated the status transition.
 */
export function buildGigPaidPatch(input: {
  now: Date;
  turnaroundHours: number | null;
  userId: string;
  fpsReference: string;
}): {
  status: "in_fulfillment";
  fps_reference: string;
  paid_at: string;
  marked_by: string;
  in_fulfillment_at: string;
  fulfillment_due_at: string;
} {
  const nowIso = input.now.toISOString();
  return {
    status: "in_fulfillment",
    fps_reference: input.fpsReference,
    paid_at: nowIso,
    marked_by: input.userId,
    in_fulfillment_at: nowIso,
    fulfillment_due_at: gigFulfillmentDueAt(input.now, input.turnaroundHours).toISOString(),
  };
}

/**
 * The stored reason for a ghost strike: the fail-safe context ("Past-due
 * refund") plus the staff member's own words. Extracted pure for tests.
 */
export function buildGhostStrikeReason(staffReason: string): string {
  const trimmed = staffReason.trim();
  return trimmed ? `Past-due refund: ${trimmed}` : "Past-due refund";
}

/**
 * A strike is recorded ONLY when staff refund an order the sweep already
 * flipped to past_due (past_due_at set). Refunding an in_fulfillment or
 * delivered order is a normal ops decision, not ghosting. Extracted pure.
 */
export function shouldStrikeOnStaffRefund(pastDueAt: string | null): boolean {
  return pastDueAt != null;
}

/**
 * Server-side approval gate for gig listings in the review queue: a
 * document_review gig without the recorded integrity confirmation must be
 * blocked from publishing (the tutor's checkbox timestamp is the evidence).
 * Returns the human-readable blocker, or null when approval may proceed.
 * Extracted pure for tests. Notes approval never calls this, gigs only.
 */
export function gigApprovalBlocker(row: {
  materialType: string;
  gigCategory: string | null;
  integrityConfirmedAt: string | null;
}): string | null {
  if (row.materialType !== "gig") return "This listing is not a gig.";
  if (row.gigCategory === "document_review" && !row.integrityConfirmedAt) {
    return (
      "This document review gig has no academic-integrity confirmation on file. " +
      "Reject it or ask the tutor to re-submit with the confirmation."
    );
  }
  return null;
}

/** #328 lazy sweep: flips in_fulfillment gig orders past due+24h grace. */
export async function sweepPastDueGigOrders(db: AdminDb): Promise<number> {
  const { data, error } = await db.rpc("sweep_past_due_gig_orders", {});
  if (error) throw new Error(error?.message || "The gig order sweep failed.");
  return typeof data === "number" ? data : Number(data ?? 0);
}

/** Manual sweep trigger (the desk-load fns also call the helper directly). */
export const runGigOrderSweep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ flipped: number }> => {
    const db = await assertGigStaffDb(context.supabase, context.userId);
    return { flipped: await sweepPastDueGigOrders(db) };
  });

/** Same admin gate as the notes cashier, returning the service-role client. */
async function assertGigStaffDb(client: unknown, userId: string): Promise<AdminDb> {
  const rpc = (client as AdminDb).rpc;
  for (const role of ["admin", "super_admin"] as const) {
    const { data: ok, error } = await rpc("has_role", { _user_id: userId, _role: role });
    if (!error && ok === true) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      return asAdminDb(supabaseAdmin);
    }
  }
  throw new Error("Forbidden");
}

type GigOrderWithListing = {
  id: string;
  reference: string | null;
  material_id: string;
  tutor_id: string;
  gross_hkd: number;
  status: string;
  fps_reference: string | null;
  payment_screenshot_path: string | null;
  paid_at: string | null;
  in_fulfillment_at: string | null;
  fulfillment_due_at: string | null;
  past_due_at: string | null;
  refund_requested_at: string | null;
  buyer_source_path: string | null;
  completion_note: string | null;
  delivered_file_path: string | null;
  delivered_at: string | null;
  created_at: string;
  digital_materials: {
    title: string;
    material_type: string;
    gig_category: string | null;
    gig_delivery_type: string | null;
    turnaround_note: string | null;
    turnaround_hours: number | null;
  } | null;
};

/**
 * The services half of the orders desk. Runs the #328 sweep FIRST (lazy
 * clock, no cron), then lists every gig order with all fulfillment
 * columns. Buyer identity is never selected.
 */
export const listGigDeskOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ swept: number; orders: GigDeskOrder[] }> => {
    const db = await assertGigStaffDb(context.supabase, context.userId);
    const swept = await sweepPastDueGigOrders(db);

    // Discriminate gigs from note orders: collect the gig listing ids first,
    // then filter orders by material_id (PostgREST embedded filters are not
    // in the Rows<T> builder subset).
    const { data: gigListings, error: listingError } = await db
      .from<{ id: string }>("digital_materials")
      .select("id")
      .eq("material_type", "gig")
      .limit(1000);
    if (listingError) throw new Error(listingError.message);
    const gigIds = (gigListings ?? []).map((row) => row.id);
    if (gigIds.length === 0) return { swept, orders: [] };

    const { data: rows, error } = await db
      .from<GigOrderWithListing>("material_orders")
      .select(
        "id, reference, material_id, tutor_id, gross_hkd, status, fps_reference, payment_screenshot_path, paid_at, in_fulfillment_at, fulfillment_due_at, past_due_at, refund_requested_at, buyer_source_path, completion_note, delivered_file_path, delivered_at, created_at, digital_materials(title, gig_category, gig_delivery_type, turnaround_note, turnaround_hours)",
      )
      .in("material_id", gigIds)
      .in("status", [...GIG_ORDER_STATUSES])
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return {
      swept,
      orders: (rows ?? []).map((row) => ({
        id: row.id,
        reference: row.reference,
        materialId: row.material_id,
        listingTitle: row.digital_materials?.title ?? null,
        gigCategory: row.digital_materials?.gig_category ?? null,
        gigDeliveryType: row.digital_materials?.gig_delivery_type ?? null,
        turnaroundNote: row.digital_materials?.turnaround_note ?? null,
        turnaroundHours: row.digital_materials?.turnaround_hours ?? null,
        tutorId: row.tutor_id,
        grossHkd: Number(row.gross_hkd),
        status: row.status,
        hasScreenshot: Boolean(row.payment_screenshot_path),
        fpsReference: row.fps_reference,
        paidAt: row.paid_at,
        inFulfillmentAt: row.in_fulfillment_at,
        fulfillmentDueAt: row.fulfillment_due_at,
        pastDueAt: row.past_due_at,
        refundRequestedAt: row.refund_requested_at,
        buyerSourcePath: row.buyer_source_path,
        completionNote: row.completion_note,
        deliveredFilePath: row.delivered_file_path,
        deliveredAt: row.delivered_at,
        createdAt: row.created_at,
      })),
    };
  });

/**
 * Staff confirm the FPS transfer on a gig order: awaiting_payment ->
 * in_fulfillment, with the fail-safe clock stamped from the LISTING's
 * turnaround hours (48h default). The money split already sits on the row
 * from checkout and is left untouched.
 */
export const markGigOrderPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ orderId: z.string().uuid(), fpsReference: z.string().trim().min(3).max(80) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await assertGigStaffDb(context.supabase, context.userId);

    const { data: order, error } = await db
      .from<GigOrderWithListing>("material_orders")
      .select(
        "id, reference, material_id, tutor_id, gross_hkd, status, fps_reference, payment_screenshot_path, paid_at, in_fulfillment_at, fulfillment_due_at, past_due_at, refund_requested_at, buyer_source_path, completion_note, delivered_file_path, delivered_at, created_at, digital_materials(title, material_type, gig_category, gig_delivery_type, turnaround_note, turnaround_hours)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");
    if (!order.digital_materials) {
      // Join safety: the listing vanished, refuse rather than guess.
      throw new Error("The listing for this order could not be found.");
    }
    if (order.digital_materials.material_type !== "gig") {
      throw new Error("This action only applies to service (gig) orders.");
    }
    const next = transitionGigOrder(order.status, "mark_paid");
    if (!next) {
      throw new Error(`Order in status "${order.status}" cannot be marked paid.`);
    }

    const patch = buildGigPaidPatch({
      now: new Date(),
      turnaroundHours: order.digital_materials.turnaround_hours,
      userId: context.userId,
      fpsReference: data.fpsReference,
    });
    const { data: updatedRows, error: updateError } = await (
      db.from<never>("material_orders") as unknown as StatusGuardedOrderUpdate
    )
      .update(patch)
      .eq("id", order.id)
      // #374: lose the race, not the state, a concurrent desk action that
      // already moved the status makes this 0 rows and the call fails loudly.
      .eq("status", order.status)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error("The order was just updated elsewhere, refresh the desk and retry.");
    }
    return { ok: true, status: next, fulfillmentDueAt: patch.fulfillment_due_at };
  });

/**
 * Staff refund at any pre-refunded gig stage. When the order was past_due
 * (the sweep had already flipped it) the tutor ALSO receives a hidden ghost
 * strike, one per order, enforced by the UNIQUE(order_id) plus the
 * unique-violation swallow below, so re-refunding can never double-strike.
 * The refund itself is not gated on the strike insert succeeding beyond
 * real DB errors: a duplicate strike is success (already struck).
 */
export const staffRefundGigOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ orderId: z.string().uuid(), reason: z.string().trim().min(3).max(400) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await assertGigStaffDb(context.supabase, context.userId);

    const { data: order, error } = await db
      .from<GigOrderWithListing>("material_orders")
      .select(
        "id, reference, material_id, tutor_id, gross_hkd, status, fps_reference, payment_screenshot_path, paid_at, in_fulfillment_at, fulfillment_due_at, past_due_at, refund_requested_at, buyer_source_path, completion_note, delivered_file_path, delivered_at, created_at, digital_materials(title, material_type, gig_category, gig_delivery_type, turnaround_note, turnaround_hours)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");
    if (order.digital_materials?.material_type !== "gig") {
      throw new Error("This action only applies to service (gig) orders.");
    }
    const next = transitionGigOrder(order.status, "staff_refund");
    if (!next) {
      throw new Error(`Order in status "${order.status}" cannot be refunded.`);
    }

    const { data: updatedRows, error: updateError } = await (
      db.from<never>("material_orders") as unknown as StatusGuardedOrderUpdate
    )
      .update({ status: next })
      .eq("id", order.id)
      // #374: status guard, a concurrent refund/deliver makes this 0 rows
      // and the desk call fails loudly instead of silently re-refunding.
      .eq("status", order.status)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error("The order was just updated elsewhere, refresh the desk and retry.");
    }

    let struck = false;
    if (shouldStrikeOnStaffRefund(order.past_due_at)) {
      const { error: strikeError } = await db.from<never>("tutor_ghost_strikes").insert({
        tutor_id: order.tutor_id,
        order_id: order.id,
        reason: buildGhostStrikeReason(data.reason),
        created_by: context.userId,
      });
      if (strikeError && !isUniqueViolation(strikeError as { code?: string; message?: string })) {
        throw new Error(strikeError.message);
      }
      struck = !strikeError;
    }
    return { ok: true, status: next, struck };
  });

/**
 * The hidden ghost-strike ledger, staff/ops visibility only (RLS enforces
 * the same restriction on the client side). Optional tutor filter for the
 * tutor-admin surface; defaults to the 100 most recent.
 */
export const listGhostStrikes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ tutorId: z.string().uuid().optional() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<GhostStrikeRow[]> => {
    const db = await assertGigStaffDb(context.supabase, context.userId);

    let query = db
      .from<{
        id: string;
        tutor_id: string;
        order_id: string;
        reason: string;
        created_at: string;
        tutors: { display_name: string; tutor_code: string } | null;
        material_orders: { reference: string | null } | null;
      }>("tutor_ghost_strikes")
      .select(
        "id, tutor_id, order_id, reason, created_at, tutors(display_name, tutor_code), material_orders(reference)",
      );
    if (data.tutorId) query = query.eq("tutor_id", data.tutorId);
    const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => ({
      id: row.id,
      tutorId: row.tutor_id,
      tutorName: row.tutors?.display_name ?? null,
      tutorCode: row.tutors?.tutor_code ?? null,
      orderId: row.order_id,
      orderReference: row.material_orders?.reference ?? null,
      reason: row.reason,
      createdAt: row.created_at,
    }));
  });

/** materials-originals is PRIVATE, the buyer's file_back source lives at
 * gigs-orders/<orderId>/source.<pdf|docx> (written by uploadGigSourceFile). */
const GIG_SOURCE_BUCKET = "materials-originals";

/**
 * #328 file_back: staff signed-URL read of the buyer's uploaded source
 * document (grok re-review 2026-10-17: the desk could see that a source
 * exists but could never open it). Admin-gated like every fn here; the
 * URL is short-lived (10 min) and exposes no buyer identity.
 */
export const getGigOrderSourceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await assertGigStaffDb(context.supabase, context.userId);
    // #374: mirror the tutor gate's shape, the order must belong to a gig
    // listing, the gig must be file_back, and the order must sit in an open
    // fulfillment state before the buyer's source document is signed.
    const { data: order, error } = await db
      .from<{
        buyer_source_path: string | null;
        status: string;
        digital_materials: { material_type: string; gig_delivery_type: string | null } | null;
      }>("material_orders")
      .select("buyer_source_path, status, digital_materials(material_type, gig_delivery_type)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");
    if (order.digital_materials?.material_type !== "gig") {
      throw new Error("This order is not a service (gig) order.");
    }
    if (order.digital_materials.gig_delivery_type !== "file_back") {
      throw new Error("This service does not use a source file.");
    }
    if (order.status !== "in_fulfillment" && order.status !== "past_due") {
      throw new Error("This order is not open for fulfillment.");
    }
    if (!order.buyer_source_path) throw new Error("No source file attached.");
    const { data: signed, error: signError } = await db.storage
      .from(GIG_SOURCE_BUCKET)
      .createSignedUrl(order.buyer_source_path, 600);
    if (signError || !signed) throw new Error(signError?.message || "Failed to sign URL");
    return { signedUrl: signed.signedUrl };
  });
