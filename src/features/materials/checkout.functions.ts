import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import { isUniqueViolation } from "@/features/materials/orders.functions";
import {
  boughtListAction,
  buildOrderReference,
  computeFolderAdjustedPrice,
  orderGrantsAccess,
  splitMaterialMoney,
} from "@/features/materials/lifecycle";
import { gigOrderBuyerAction } from "@/features/gigs/gig";
import { sweepPastDueGigOrders } from "@/features/gigs/gig-buyer.functions";

/**
 * Issues #203 + P13 (#293): the manual-cashier checkout server functions.
 * MatchMax is the seller of record; the parent pays MatchMax by FPS. The
 * checkout page shows the order reference + FPS instructions and hands the
 * parent to WhatsApp (Ryan: the purchase button opens a prefilled WhatsApp
 * message stating what they are buying). Staff mark the payment, then
 * release a per-order stamped copy; delivery is an in-account download.
 * Tutor and buyer never see each other's contact details.
 *
 * #392 shop kinds ride the same rail with two twists:
 *   - topic_folder orders are priced server-side (proration): the buyer's
 *     delivered orders on the folder's children are subtracted from the
 *     bulk price, floored at 0; a $0 remainder becomes an immediate
 *     delivered grant (no cashier round-trip) that unlocks the children.
 *   - folder/course orders carry NO listing-level file, so releaseOrder
 *     marks them delivered without stamping; folder delivery additionally
 *     grants every child (delivered is_grant rows at HK$0).
 */

const SCREENSHOTS_BUCKET = "orders-screenshots";
const ORIGINALS_BUCKET = "materials-originals";

/** #392: kinds that carry a listing-level source file (the stamp pipeline). */
export const FILE_BEARING_MATERIAL_TYPES = ["notes", "mock", "exemplar", "flashcards"] as const;

export const FOLDER_GRANT_REASON_PREFIX = "topic_folder:";
export const FOLDER_PRORATION_GRANT_REASON = "folder_proration";

/**
 * Pure factory for the folder child grants (#250 grant shape): delivered
 * is_grant rows at HK$0 across the board, one per child. Extracted for
 * tests. `grantedBy` is the releasing staff user (null on the $0 proration
 * path, no staff touched that order).
 */
export function buildFolderChildGrantRows(input: {
  folderId: string;
  childIds: string[];
  buyerAccountId: string;
  tutorId: string;
  grantedBy: string | null;
  now?: Date;
}): Array<{
  material_id: string;
  buyer_account_id: string;
  tutor_id: string;
  gross_hkd: number;
  platform_fee_hkd: number;
  tutor_net_hkd: number;
  status: string;
  is_grant: boolean;
  granted_by: string | null;
  grant_reason: string;
  delivered_at: string;
  delivered_by: string | null;
}> {
  const deliveredAt = (input.now ?? new Date()).toISOString();
  return input.childIds.map((materialId) => ({
    material_id: materialId,
    buyer_account_id: input.buyerAccountId,
    tutor_id: input.tutorId,
    gross_hkd: 0,
    platform_fee_hkd: 0,
    tutor_net_hkd: 0,
    status: "delivered",
    is_grant: true,
    granted_by: input.grantedBy,
    grant_reason: `${FOLDER_GRANT_REASON_PREFIX}${input.folderId}`,
    delivered_at: deliveredAt,
    delivered_by: input.grantedBy,
  }));
}

/**
 * Insert the folder's child grants, ignoring rows that already exist (the
 * buyer may already hold a child via a direct purchase or an earlier
 * folder). Children grants never bump child sold_count, the CALLER owns
 * the single increment_material_sold_count call for the FOLDER.
 *
 * The (material, buyer) uniqueness on material_orders is a PARTIAL unique
 * index (status <> 'refunded', 20261012153000), PostgREST's on_conflict
 * cannot infer it (42P10), so plain-insert and treat 23505 as "already
 * held". A child the buyer refunded earlier gets a fresh grant row: the
 * folder purchase re-unlocks it.
 */
async function insertFolderChildGrants(
  db: AdminDb,
  rows: ReturnType<typeof buildFolderChildGrantRows>,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db.from<never>("material_orders").insert(rows);
  if (!error) return;
  if (error.code !== "23505") throw new Error(error.message);
  for (const row of rows) {
    const { error: rowError } = await db.from<never>("material_orders").insert(row);
    if (rowError && rowError.code !== "23505") throw new Error(rowError.message);
  }
}

export const ORDER_STATUSES = [
  "awaiting_payment",
  "paid",
  "stamping",
  "delivered",
  "stamp_failed",
  "rejected",
  "refunded",
] as const;

type OrderRow = {
  id: string;
  reference: string | null;
  material_id: string;
  buyer_account_id: string;
  tutor_id: string;
  gross_hkd: number;
  platform_fee_hkd: number;
  tutor_net_hkd: number;
  status: (typeof ORDER_STATUSES)[number];
  fps_reference: string | null;
  payment_screenshot_path: string | null;
  delivered_file_path: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  receipt_sent_at: string | null;
  created_at: string;
  // #328 gig fulfillment columns (null on note orders).
  in_fulfillment_at: string | null;
  fulfillment_due_at: string | null;
  past_due_at: string | null;
  buyer_source_path: string | null;
  completion_note: string | null;
  refund_requested_at: string | null;
};

type PublicMaterialRow = {
  id: string;
  title: string;
  slug: string | null;
  price_hkd: number;
  status: string;
  original_file_path: string | null;
  material_type: string;
  page_count: number | null;
  tutor_id: string;
  gig_category: string | null;
  gig_delivery_type: string | null;
};

type OrderWithMaterial = OrderRow & { digital_materials: PublicMaterialRow | null };

async function isAdmin(db: AdminDb, userId: string): Promise<boolean> {
  for (const role of ["admin", "super_admin"] as const) {
    const { data: ok } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (ok === true) return true;
  }
  return false;
}

/**
 * A refunded order is DEAD, returning it from checkout would trap the
 * (material, buyer) pair forever, so only still-active orders are reusable.
 * Extracted pure for tests. Backed by the partial unique index
 * idx_material_orders_active_pair (status <> 'refunded').
 */
export function reusableExistingOrder(
  existing: Pick<OrderRow, "id" | "reference" | "status"> | null,
): { orderId: string; reference: string } | null {
  if (!existing || existing.status === "refunded") return null;
  return { orderId: existing.id, reference: existing.reference ?? "" };
}

/**
 * Statuses staff may move to paid: awaiting_payment, or a rejected payment
 * the buyer is re-paying. Delivered/refunded/stamping rows must never be
 * re-marked (it would overwrite paid_at / fps_reference). Extracted pure
 * for tests.
 */
export function canMarkOrderPaid(status: string): boolean {
  return status === "awaiting_payment" || status === "rejected";
}

/**
 * After a refund + re-buy there can be TWO rows for one (material, buyer)
 * pair: the dead refunded row and the live one. Pick the first still-active
 * row (server fns pass rows newest-first, so the re-buy wins over the
 * refunded original); null when every row is refunded, checkout then
 * inserts fresh. Extracted pure for tests.
 */
export function pickReusableOrder(
  rows: Pick<OrderRow, "id" | "reference" | "status">[],
): { orderId: string; reference: string } | null {
  for (const row of rows) {
    const reusable = reusableExistingOrder(row);
    if (reusable) return reusable;
  }
  return null;
}

/** Escapes untrusted text (note titles) for interpolation into HTML email. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Issue #214: record the checkout acceptance for an order. Thin wrapper so
 * all three startCheckout paths (create, reuse, race-winner) stay fail-closed
 *, a failed insert throws and the whole checkout fails.
 */
async function recordCheckoutAcceptance(userId: string, orderId: string): Promise<void> {
  const { recordTermsAcceptance } = await import("@/features/legal/terms-acceptance.server");
  await recordTermsAcceptance({ userId, surface: "checkout", subjectId: orderId });
}

/**
 * #203 flow step 3: create (or return) the awaiting_payment order for this
 * buyer + pack. Unique (material, buyer) among NON-refunded orders makes
 * double-checkout impossible, the second attempt gets the existing order
 * back instead of an error, so the checkout page is idempotent across
 * refreshes. A REFUNDED order is dead: checkout inserts a fresh
 * awaiting_payment order so the buyer can re-purchase the same note
 * (partial unique index idx_material_orders_active_pair enforces it).
 */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        // Issue #214: the buy click doubles as the notes-terms acceptance
        // click, the checkbox must arrive true, and the handler records the
        // terms_acceptances row (surface checkout, subject_id = order id).
        legalAgreed: z.literal(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: material } = await db
      .from<PublicMaterialRow>("digital_materials")
      .select(
        "id, title, slug, price_hkd, status, original_file_path, material_type, page_count, tutor_id, gig_category, gig_delivery_type",
      )
      .eq("id", data.materialId)
      .maybeSingle();
    if (!material || material.status !== "published") {
      throw new Error("This note is not available right now.");
    }
    // #326 gigs have NO listing-level source file; #392 folders/courses
    // don't either (courses deliver per-lesson embeds + PDFs). Only the
    // notes kinds run the "original must exist" gate.
    if (
      (FILE_BEARING_MATERIAL_TYPES as readonly string[]).includes(material.material_type) &&
      !material.original_file_path
    ) {
      throw new Error("This note is not available right now.");
    }
    // #314: HK$0 free packs ARE purchasable, they run the same manual
    // cashier flow (staff approve + release, ban list already applied at
    // submit), the delivered order counts in the listing's bought count,
    // and the file is released inside the buyer's account.
    // No self-purchase: tutors.user_id is the listing owner's AUTH account.
    const { data: ownerTutor } = await db
      .from<{ user_id: string }>("tutors")
      .select("user_id")
      .eq("id", material.tutor_id)
      .maybeSingle();
    if (ownerTutor?.user_id && ownerTutor.user_id === context.userId) {
      throw new Error("You can't buy your own note.");
    }

    // Existing order (active statuses) wins, the unique index is the source
    // of truth. A refunded row is dead: fall through and insert a fresh
    // awaiting_payment order instead. After a refund + re-buy the pair has
    // TWO rows (refunded + active), so this is a LIST query with a status
    // filter, .maybeSingle() on the bare pair would PGRST116-error and the
    // buyer could never reach their order again. Newest-first so a re-buy
    // wins over the refunded original.
    const { data: existingRows } = await db
      .from<OrderRow>("material_orders")
      .select("*")
      .eq("material_id", data.materialId)
      .eq("buyer_account_id", context.userId)
      .neq("status", "refunded")
      .order("created_at", { ascending: false })
      .limit(2);
    const reusable = pickReusableOrder(existingRows ?? []);
    if (reusable) {
      // Issue #214: the gate fires on the reuse path too, the checkbox was
      // still clicked, so record the acceptance for the returned order.
      await recordCheckoutAcceptance(context.userId, reusable.orderId);
      return reusable;
    }

    const reference = buildOrderReference();

    // #392 folder proration: the SERVER owns the price. Sum the buyer's
    // DELIVERED orders on the folder's CURRENT children (paid or granted —
    // grants carry gross 0), subtract from the bulk price, floor at 0. The
    // listing's price_hkd is only a display hint until this runs.
    if (material.material_type === "topic_folder") {
      const { data: items } = await db
        .from<{ child_material_id: string }>("topic_folder_items")
        .select("child_material_id")
        .eq("folder_id", material.id);
      const childIds = (items ?? []).map((item) => item.child_material_id);

      let adjusted = Number(material.price_hkd);
      if (childIds.length > 0) {
        const { data: ownedOrders } = await db
          .from<{ gross_hkd: number }>("material_orders")
          .select("gross_hkd")
          .eq("buyer_account_id", context.userId)
          .eq("status", "delivered")
          .in("material_id", childIds);
        adjusted = computeFolderAdjustedPrice({
          bulkHkd: Number(material.price_hkd),
          paidChildGross: (ownedOrders ?? []).map((order) => Number(order.gross_hkd)),
        }).adjusted;
      }

      if (childIds.length === 0 || adjusted === 0) {
        // Fully prorated (or an empty folder, the submit gate forbids it,
        // but stay safe): create the folder order as an immediate delivered
        // grant at HK$0 and unlock the children right away. No cashier
        // round-trip; the buyer lands on a delivered order page.
        const grantReference = buildOrderReference();
        const grantInsert = await db
          .from<{ id: string }>("material_orders")
          .insert({
            material_id: material.id,
            buyer_account_id: context.userId,
            tutor_id: material.tutor_id,
            gross_hkd: 0,
            platform_fee_hkd: 0,
            tutor_net_hkd: 0,
            status: "delivered",
            is_grant: true,
            granted_by: null,
            grant_reason: FOLDER_PRORATION_GRANT_REASON,
            reference: grantReference,
            delivered_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (grantInsert.error || !grantInsert.data) {
          // Lost a race to the unique index? The winner's row IS the grant
          // the buyer needs, re-read and hand it back.
          const { data: winnerRows } = await db
            .from<OrderRow>("material_orders")
            .select("*")
            .eq("material_id", material.id)
            .eq("buyer_account_id", context.userId)
            .neq("status", "refunded")
            .order("created_at", { ascending: false })
            .limit(1);
          const winner = winnerRows?.[0];
          if (winner) {
            await recordCheckoutAcceptance(context.userId, winner.id);
            return { orderId: winner.id, reference: winner.reference ?? grantReference };
          }
          throw new Error(grantInsert.error?.message || "Could not create the order.");
        }

        await insertFolderChildGrants(
          db,
          buildFolderChildGrantRows({
            folderId: material.id,
            childIds,
            buyerAccountId: context.userId,
            tutorId: material.tutor_id,
            grantedBy: null,
          }),
        );
        // Sold count moves for the FOLDER only, child grants must not
        // bump the children (they were not newly sold).
        await db.rpc("increment_material_sold_count", { p_material_id: material.id });
        await recordCheckoutAcceptance(context.userId, grantInsert.data.id);
        return { orderId: grantInsert.data.id, reference: grantReference };
      }

      const { platformFeeHkd, tutorNetHkd } = splitMaterialMoney(adjusted);
      const insert = await db
        .from<{ id: string }>("material_orders")
        .insert({
          material_id: material.id,
          buyer_account_id: context.userId,
          tutor_id: material.tutor_id,
          gross_hkd: adjusted,
          platform_fee_hkd: platformFeeHkd,
          tutor_net_hkd: tutorNetHkd,
          status: "awaiting_payment",
          reference,
        })
        .select("id")
        .single();
      if (insert.error || !insert.data) {
        const { data: winnerRows } = await db
          .from<OrderRow>("material_orders")
          .select("*")
          .eq("material_id", material.id)
          .eq("buyer_account_id", context.userId)
          .neq("status", "refunded")
          .order("created_at", { ascending: false })
          .limit(2);
        const reusableWinner = pickReusableOrder(winnerRows ?? []);
        if (reusableWinner) {
          await recordCheckoutAcceptance(context.userId, reusableWinner.orderId);
          return reusableWinner;
        }
        if (isUniqueViolation(insert.error)) {
          throw new Error("Could not create the order. Please try again.");
        }
        throw new Error(insert.error?.message || "Could not create the order.");
      }
      await recordCheckoutAcceptance(context.userId, insert.data.id);
      return { orderId: insert.data.id, reference };
    }

    const { platformFeeHkd, tutorNetHkd } = splitMaterialMoney(Number(material.price_hkd));
    const insert = await db
      .from<{ id: string }>("material_orders")
      .insert({
        material_id: material.id,
        buyer_account_id: context.userId,
        tutor_id: material.tutor_id,
        gross_hkd: material.price_hkd,
        platform_fee_hkd: platformFeeHkd,
        tutor_net_hkd: tutorNetHkd,
        status: "awaiting_payment",
        reference,
      })
      .select("id")
      .single();
    if (insert.error || !insert.data) {
      // Lost a race to the unique index? Re-read and hand back the winner —
      // unless that winner is itself a refunded row (same trap as above).
      const { data: winnerRows } = await db
        .from<OrderRow>("material_orders")
        .select("*")
        .eq("material_id", data.materialId)
        .eq("buyer_account_id", context.userId)
        .neq("status", "refunded")
        .order("created_at", { ascending: false })
        .limit(2);
      const reusableWinner = pickReusableOrder(winnerRows ?? []);
      if (reusableWinner) {
        await recordCheckoutAcceptance(context.userId, reusableWinner.orderId);
        return reusableWinner;
      }
      if (isUniqueViolation(insert.error)) {
        throw new Error("Could not create the order. Please try again.");
      }
      throw new Error(insert.error?.message || "Could not create the order.");
    }
    // Issue #214: the order exists, record WHICH terms version the buyer
    // accepted (subject_id = order id). Fail-closed: an insert failure fails
    // the whole checkout, so no order is ever placed without a recorded
    // acceptance.
    await recordCheckoutAcceptance(context.userId, insert.data.id);
    return { orderId: insert.data.id, reference };
  });

export type MyOrder = {
  id: string;
  reference: string;
  status: string;
  grossHkd: number;
  materialTitle: string;
  materialSlug: string | null;
  materialId: string;
  fpsReference: string | null;
  hasScreenshot: boolean;
  createdAt: string;
  deliveredAt: string | null;
  action: "download" | "refunded" | "preparing" | "pay" | "awaiting_delivery" | "request_refund";
  // --- Freestyle gig fields (#328): populated only for material_type 'gig'.
  materialType: string;
  gigCategory: string | null;
  gigDeliveryType: string | null;
  fulfillmentDueAt: string | null;
  completionNote: string | null;
  hasSourceFile: boolean;
  hasDeliveredFile: boolean;
};

function orderAction(status: string, materialType?: string): MyOrder["action"] {
  if (materialType === "gig") return gigOrderBuyerAction(status);
  if (status === "awaiting_payment" || status === "rejected") return "pay";
  return boughtListAction(status);
}

/** The buyer's own order (checkout/status page). */
export const getMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    // #328 lazy sweep first: the buyer's read is the freshest chance to flip
    // an over-due in_fulfillment gig to past_due (advisory, never throws).
    await sweepPastDueGigOrders(db);

    const { data: order } = await db
      .from<OrderWithMaterial>("material_orders")
      .select(
        "id, reference, material_id, buyer_account_id, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, status, fps_reference, payment_screenshot_path, delivered_file_path, paid_at, delivered_at, created_at, buyer_source_path, completion_note, fulfillment_due_at, digital_materials(id, title, slug, price_hkd, status, original_file_path, material_type, page_count, tutor_id, gig_category, gig_delivery_type)",
      )
      .eq("id", data.orderId)
      .eq("buyer_account_id", context.userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    const material = order.digital_materials;
    return {
      id: order.id,
      reference: order.reference ?? "",
      status: order.status,
      grossHkd: Number(order.gross_hkd),
      materialTitle: material?.title ?? "Note",
      materialSlug: material?.slug ?? null,
      materialId: order.material_id,
      fpsReference: order.fps_reference,
      hasScreenshot: Boolean(order.payment_screenshot_path),
      createdAt: order.created_at,
      deliveredAt: order.delivered_at,
      action: orderAction(order.status, material?.material_type),
      materialType: material?.material_type ?? "notes",
      gigCategory: material?.gig_category ?? null,
      gigDeliveryType: material?.gig_delivery_type ?? null,
      fulfillmentDueAt: order.fulfillment_due_at ?? null,
      completionNote: order.completion_note ?? null,
      hasSourceFile: Boolean(order.buyer_source_path),
      hasDeliveredFile: Boolean(order.delivered_file_path),
    } satisfies MyOrder;
  });

/** P13: the Bought library, paid notes on the Account page. */
export const getBoughtMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    // #328 lazy sweep first (advisory) so the library shows fresh past_due.
    await sweepPastDueGigOrders(db);

    const { data, error } = await db
      .from<OrderWithMaterial>("material_orders")
      .select(
        "id, reference, material_id, buyer_account_id, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, status, fps_reference, payment_screenshot_path, delivered_file_path, paid_at, delivered_at, created_at, digital_materials(id, title, slug, price_hkd, status, original_file_path, material_type, page_count, tutor_id, gig_category, gig_delivery_type)",
      )
      .eq("buyer_account_id", context.userId)
      .in("status", [
        "awaiting_payment",
        "paid",
        "stamping",
        "in_fulfillment",
        "past_due",
        "delivered",
        "stamp_failed",
        "rejected",
        "refunded",
      ])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((order) => {
      const material = order.digital_materials;
      return {
        orderId: order.id,
        materialId: order.material_id,
        title: material?.title ?? "Note",
        slug: material?.slug ?? null,
        grossHkd: Number(order.gross_hkd),
        status: order.status,
        isGrant: false,
        materialType: material?.material_type ?? "notes",
        deliveredAt: order.delivered_at,
        createdAt: order.created_at,
        action: orderAction(order.status, material?.material_type),
        grantsAccess: orderGrantsAccess(order.status),
      };
    });
  });

/** P14/checkout support: buyer attaches the one optional FPS proof screenshot. */
export const uploadPaymentScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        base64Data: z.string().trim().min(50).max(8_000_000), // ≤5MB image
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: order } = await db
      .from<OrderRow>("material_orders")
      .select("*")
      .eq("id", data.orderId)
      .eq("buyer_account_id", context.userId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.status !== "awaiting_payment") {
      throw new Error("This order is already being processed.");
    }

    const bytes = Buffer.from(data.base64Data, "base64");
    if (bytes.byteLength > 5 * 1024 * 1024) {
      throw new Error("Screenshot is too large. Maximum is 5MB.");
    }
    const ext =
      data.contentType === "image/png" ? "png" : data.contentType === "image/webp" ? "webp" : "jpg";
    const path = `screenshots/${order.id}-${Date.now().toString(36)}.${ext}`;
    const { error } = await db.storage
      .from(SCREENSHOTS_BUCKET)
      .upload(path, bytes, { contentType: data.contentType });
    if (error) throw new Error(error.message);

    const { error: updateError } = await db
      .from<never>("material_orders")
      .update({ payment_screenshot_path: path })
      .eq("id", order.id);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });

/** Staff view of the attached screenshot (admin-only, signed, 10 minutes). */
export const getOrderScreenshotUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    if (!(await isAdmin(db, context.userId))) throw new Error("Forbidden");

    const { data: order } = await db
      .from<OrderRow>("material_orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order?.payment_screenshot_path) throw new Error("No screenshot attached.");
    const { data: signed, error } = await db.storage
      .from(SCREENSHOTS_BUCKET)
      .createSignedUrl(order.payment_screenshot_path, 600);
    if (error || !signed) throw new Error(error?.message || "Failed to sign URL");
    return { signedUrl: signed.signedUrl };
  });

/**
 * Stamp the per-order footer onto a copy of the original (#203: order id +
 * buyer account id). Failure must NOT deliver, the caller parks the order
 * at stamp_failed.
 */
export async function buildDeliveredFile(
  originalBytes: Uint8Array,
  order: { id: string; reference: string | null; buyer_account_id: string },
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const footer = `Order ${order.reference || order.id.slice(0, 8)} · Buyer ${order.buyer_account_id.slice(0, 8)} · Licensed to one student · matchmax.hk`;
  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    const fontSize = 7.5;
    const textWidth = font.widthOfTextAtSize(footer, fontSize);
    page.drawText(footer, {
      x: Math.max(8, width - textWidth - 8),
      y: 6,
      size: fontSize,
      font,
      color: rgb(0.33, 0.4, 0.47),
    });
  }
  return doc.save();
}

/**
 * #203 flow step 4: staff confirms the FPS transfer, enters the reference,
 * and releases. Release stamps the per-order copy; success sets delivered
 * and mints nothing (the buyer's Download button calls #291's
 * getOwnedMaterialUrl, extended below to prefer the stamped copy).
 */
export const markOrderPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ orderId: z.string().uuid(), fpsReference: z.string().trim().min(3).max(80) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    if (!(await isAdmin(db, context.userId))) throw new Error("Forbidden");

    // Status precondition (review fix): only an awaiting_payment order, or
    // a rejected payment the buyer is re-paying, may be marked paid. This
    // stops staff from clobbering delivered/refunded/stamping rows and
    // overwriting paid_at / fps_reference, mirroring releaseOrder's gate.
    const { data: order } = await db
      .from<{
        id: string;
        status: string;
        digital_materials: { material_type: string } | null;
      }>("material_orders")
      .select("id, status, digital_materials(material_type)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (!canMarkOrderPaid(order.status)) {
      throw new Error(`Order in status "${order.status}" cannot be marked paid.`);
    }
    // Grok review 2026-10-17 (soft): gig orders have their own fulfillment
    // machine, a wrong-desk call here would park one at notes-only "paid"
    // with no fulfillment_due_at. Send staff to markGigOrderPaid instead.
    if (order.digital_materials?.material_type === "gig") {
      throw new Error("This order is for a service listing, mark it paid from the Services desk.");
    }

    const { error } = await db
      .from<never>("material_orders")
      .update({
        status: "paid",
        fps_reference: data.fpsReference,
        paid_at: new Date().toISOString(),
        marked_by: context.userId,
      })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const releaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    if (!(await isAdmin(db, context.userId))) throw new Error("Forbidden");

    const { data: order } = await db
      .from<OrderWithMaterial>("material_orders")
      .select(
        "id, reference, material_id, buyer_account_id, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, status, fps_reference, payment_screenshot_path, delivered_file_path, paid_at, delivered_at, created_at, digital_materials(id, title, slug, price_hkd, status, original_file_path, material_type, page_count, tutor_id)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.status !== "paid" && order.status !== "stamp_failed") {
      throw new Error("Only paid orders can be released.");
    }
    const material = order.digital_materials;
    if (!material) throw new Error("The note file is missing.");

    // #392: folder and course orders carry NO listing-level file, there is
    // nothing to stamp. They flip straight to delivered: courses unlock
    // per-lesson embeds + PDFs via getCourseAccess, folders grant their
    // children here. Notes/gigs keep the stamp pipeline below untouched.
    if (
      material.material_type === "topic_folder" ||
      material.material_type === "video_course" ||
      material.material_type === "general_course"
    ) {
      try {
        const deliveredAt = new Date().toISOString();
        const { error: deliveredError } = await db
          .from<never>("material_orders")
          .update({
            status: "delivered",
            delivered_at: deliveredAt,
            delivered_by: context.userId,
          })
          .eq("id", order.id);
        if (deliveredError) throw new Error(deliveredError.message);

        if (material.material_type === "topic_folder") {
          // One delivered is_grant row per child (already-held children are
          // skipped by ON CONFLICT). granted_by = the releasing staff user.
          const { data: items } = await db
            .from<{ child_material_id: string }>("topic_folder_items")
            .select("child_material_id")
            .eq("folder_id", order.material_id);
          await insertFolderChildGrants(
            db,
            buildFolderChildGrantRows({
              folderId: order.material_id,
              childIds: (items ?? []).map((item) => item.child_material_id),
              buyerAccountId: order.buyer_account_id,
              tutorId: order.tutor_id,
              grantedBy: context.userId,
            }),
          );
        }

        // Sold count moves for the LISTING only, never for the children.
        await db.rpc("increment_material_sold_count", { p_material_id: order.material_id });

        // P12 marketplace bell v1: receipt email (order id, title, amount —
        // no file, no tutor contact). Best-effort; delivery already succeeded.
        void sendOrderReceipt(order.id).catch(() => undefined);
        return { ok: true, status: "delivered" as const };
      } catch (err) {
        await db
          .from<never>("material_orders")
          .update({ status: "stamp_failed" })
          .eq("id", order.id);
        throw err;
      }
    }

    if (!material.original_file_path) throw new Error("The note file is missing.");

    const { error: stampingError } = await db
      .from<never>("material_orders")
      .update({ status: "stamping" })
      .eq("id", order.id);
    if (stampingError) throw new Error(stampingError.message);

    try {
      const { data: signed, error: signError } = await db.storage
        .from(ORIGINALS_BUCKET)
        .createSignedUrl(material.original_file_path, 60);
      if (signError || !signed) throw new Error(signError?.message || "Could not read original");
      const res = await fetch(signed.signedUrl);
      if (!res.ok) throw new Error("Could not read original");
      const originalBytes = new Uint8Array(await res.arrayBuffer());

      // #314: a PDF gets the per-order stamp; an .apkg deck has no pages to
      // stamp (and pdf-lib cannot read it), so the deck itself is released
      // as the per-order copy. Either way delivery stays in-account and the
      // tutor never sees the buyer.
      const isApkg = /\.apkg$/i.test(material.original_file_path);
      const ext = isApkg ? "apkg" : "pdf";
      const deliveredBytes = isApkg
        ? originalBytes
        : await buildDeliveredFile(originalBytes, order);

      const path = `delivered/${order.id}.${ext}`;
      const { error: uploadError } = await db.storage
        .from(ORIGINALS_BUCKET)
        .upload(path, deliveredBytes as unknown as BlobPart, {
          contentType: isApkg ? "application/octet-stream" : "application/pdf",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);

      const deliveredAt = new Date().toISOString();
      const { error: deliveredError } = await db
        .from<never>("material_orders")
        .update({
          status: "delivered",
          delivered_file_path: path,
          delivered_at: deliveredAt,
          delivered_by: context.userId,
        })
        .eq("id", order.id);
      if (deliveredError) throw new Error(deliveredError.message);

      // Keep sold_count on the listing in sync (#203 owner stats, P9).
      await db.rpc("increment_material_sold_count", { p_material_id: order.material_id });

      // P12 marketplace bell v1: receipt email (order id, title, amount —
      // no file, no tutor contact). Best-effort; delivery already succeeded.
      void sendOrderReceipt(order.id).catch(() => undefined);
      return { ok: true, status: "delivered" as const };
    } catch (err) {
      await db.from<never>("material_orders").update({ status: "stamp_failed" }).eq("id", order.id);
      throw err;
    }
  });

/** Staff rejects a payment (bad screenshot / wrong amount). Buyer re-pays. */
export const rejectOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ orderId: z.string().uuid(), reason: z.string().trim().max(400) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    if (!(await isAdmin(db, context.userId))) throw new Error("Forbidden");
    const { error } = await db
      .from<never>("material_orders")
      .update({ status: "rejected", rejected_at: new Date().toISOString() })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** WhatsApp deep link for the checkout handoff, concierge number, order stated. */
export const getOrderWhatsAppUrl = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        reference: z.string().trim().min(1).max(40),
        title: z.string().trim().min(1).max(160),
        grossHkd: z.number().min(0),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await asAdminDb(supabaseAdmin)
      .from<{ value: unknown }>("app_settings")
      .select("value")
      .eq("key", "whatsapp_number")
      .maybeSingle();
    const number = typeof row?.value === "string" ? row.value.replace(/[^\d]/g, "") : "";
    if (!number) return { url: "" };
    const message = `Hi MatchMax, I want to buy "${data.title}" (order ${data.reference}, HK$${data.grossHkd}).`;
    return { url: `https://wa.me/${number}?text=${encodeURIComponent(message)}` };
  });

/** Receipt email (#203 acceptance): order id, title, amount. No file/link. */
export async function sendOrderReceipt(orderId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = asAdminDb(supabaseAdmin);
  const { data: order } = await db
    .from<OrderWithMaterial>("material_orders")
    .select(
      "id, reference, material_id, buyer_account_id, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, status, fps_reference, payment_screenshot_path, delivered_file_path, paid_at, delivered_at, receipt_sent_at, created_at, digital_materials(id, title, slug, price_hkd, status, original_file_path, material_type, page_count, tutor_id)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.receipt_sent_at) return;
  const { data: profile } = await db
    .from<{ email: string | null }>("profiles")
    .select("email")
    .eq("id", order.buyer_account_id)
    .maybeSingle();
  if (!profile?.email) return;

  const { default: Resend } = await import("resend");
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new (
    Resend as unknown as new (key: string) => {
      emails: {
        send: (payload: {
          from: string;
          to: string;
          subject: string;
          html: string;
          text: string;
        }) => Promise<{ error?: { message: string } | null }>;
      };
    }
  )(apiKey);
  const title = order.digital_materials?.title ?? "Your note";
  // Tutor-authored title → untrusted: escape before it goes into the HTML
  // body (the plain-text part needs no escaping).
  const titleHtml = escapeHtml(title);
  const safeReference = escapeHtml(order.reference || order.id.slice(0, 8));
  const { error } = await resend.emails.send({
    from: "MatchMax <noreply@matchmax.hk>",
    to: profile.email,
    subject: `MatchMax order ${order.reference || order.id.slice(0, 8)}, ${title}`,
    html: `<p>Your payment for <strong>${titleHtml}</strong> was confirmed.</p>
<p>Order ${safeReference} · HK$${Number(order.gross_hkd).toFixed(0)}</p>
<p>Download it anytime from Account → Bought on matchmax.hk.</p>`,
    text: `Your payment for ${title} was confirmed. Order ${
      order.reference || order.id.slice(0, 8)
    } · HK$${Number(order.gross_hkd).toFixed(0)}. Download it anytime from Account → Bought on matchmax.hk.`,
  });
  if (error) throw new Error(error.message);
  await db
    .from<never>("material_orders")
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq("id", orderId);
}
