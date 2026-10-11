import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import {
  boughtListAction,
  buildOrderReference,
  orderGrantsAccess,
  splitMaterialMoney,
} from "@/features/materials/lifecycle";

/**
 * Issues #203 + P13 (#293): the manual-cashier checkout server functions.
 * MatchMax is the seller of record; the parent pays MatchMax by FPS. The
 * checkout page shows the order reference + FPS instructions and hands the
 * parent to WhatsApp (Ryan: the purchase button opens a prefilled WhatsApp
 * message stating what they are buying). Staff mark the payment, then
 * release a per-order stamped copy; delivery is an in-account download.
 * Tutor and buyer never see each other's contact details.
 */

const SCREENSHOTS_BUCKET = "orders-screenshots";
const ORIGINALS_BUCKET = "materials-originals";

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
};

type PublicMaterialRow = {
  id: string;
  title: string;
  slug: string | null;
  price_hkd: number;
  status: string;
  original_file_path: string | null;
  page_count: number | null;
  tutor_id: string;
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
 * #203 flow step 3: create (or return) the awaiting_payment order for this
 * buyer + pack. Unique (material, buyer) makes double-checkout impossible —
 * the second attempt gets the existing order back instead of an error, so
 * the checkout page is idempotent across refreshes.
 */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: material } = await db
      .from<PublicMaterialRow>("digital_materials")
      .select("id, title, slug, price_hkd, status, original_file_path, page_count, tutor_id")
      .eq("id", data.materialId)
      .maybeSingle();
    if (!material || material.status !== "published") {
      throw new Error("This note is not available right now.");
    }
    if (!material.original_file_path) {
      throw new Error("This note is not available right now.");
    }
    if (material.price_hkd <= 0) {
      throw new Error("This note is not purchasable right now.");
    }

    // Existing order (any status) wins — the unique index is the source of truth.
    const { data: existing } = await db
      .from<OrderRow>("material_orders")
      .select("*")
      .eq("material_id", data.materialId)
      .eq("buyer_account_id", context.userId)
      .maybeSingle();
    if (existing) return { orderId: existing.id, reference: existing.reference ?? "" };

    const reference = buildOrderReference();
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
      // Lost a race to the unique index? Re-read and hand back the winner.
      const { data: winner } = await db
        .from<OrderRow>("material_orders")
        .select("*")
        .eq("material_id", data.materialId)
        .eq("buyer_account_id", context.userId)
        .maybeSingle();
      if (winner) return { orderId: winner.id, reference: winner.reference ?? "" };
      throw new Error(insert.error?.message || "Could not create the order.");
    }
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
  action: "download" | "refunded" | "preparing" | "pay";
};

function orderAction(status: string): MyOrder["action"] {
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

    const { data: order } = await db
      .from<OrderWithMaterial>("material_orders")
      .select(
        "id, reference, material_id, buyer_account_id, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, status, fps_reference, payment_screenshot_path, delivered_file_path, paid_at, delivered_at, created_at, digital_materials(id, title, slug, price_hkd, status, original_file_path, page_count, tutor_id)",
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
      action: orderAction(order.status),
    } satisfies MyOrder;
  });

/** P13: the Bought library — paid notes on the Account page. */
export const getBoughtMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data, error } = await db
      .from<OrderWithMaterial>("material_orders")
      .select(
        "id, reference, material_id, buyer_account_id, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, status, fps_reference, payment_screenshot_path, delivered_file_path, paid_at, delivered_at, created_at, digital_materials(id, title, slug, price_hkd, status, original_file_path, page_count, tutor_id)",
      )
      .eq("buyer_account_id", context.userId)
      .in("status", [
        "awaiting_payment",
        "paid",
        "stamping",
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
        deliveredAt: order.delivered_at,
        createdAt: order.created_at,
        action: orderAction(order.status),
        grantsAccess: orderGrantsAccess(order.status),
      };
    });
  });

/** P14/checkout support: buyer attaches the one optional FPS proof screenshot. */
export const uploadPaymentScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
 * buyer account id). Failure must NOT deliver — the caller parks the order
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
        "id, reference, material_id, buyer_account_id, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, status, fps_reference, payment_screenshot_path, delivered_file_path, paid_at, delivered_at, created_at, digital_materials(id, title, slug, price_hkd, status, original_file_path, page_count, tutor_id)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.status !== "paid" && order.status !== "stamp_failed") {
      throw new Error("Only paid orders can be released.");
    }
    const material = order.digital_materials;
    if (!material?.original_file_path) throw new Error("The note file is missing.");

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
      const stamped = await buildDeliveredFile(originalBytes, order);

      const path = `delivered/${order.id}.pdf`;
      const { error: uploadError } = await db.storage
        .from(ORIGINALS_BUCKET)
        .upload(path, stamped as unknown as BlobPart, {
          contentType: "application/pdf",
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

/** WhatsApp deep link for the checkout handoff — concierge number, order stated. */
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
      "id, reference, material_id, buyer_account_id, tutor_id, gross_hkd, platform_fee_hkd, tutor_net_hkd, status, fps_reference, payment_screenshot_path, delivered_file_path, paid_at, delivered_at, receipt_sent_at, created_at, digital_materials(id, title, slug, price_hkd, status, original_file_path, page_count, tutor_id)",
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
  const { error } = await resend.emails.send({
    from: "MatchMax <noreply@matchmax.hk>",
    to: profile.email,
    subject: `MatchMax order ${order.reference || order.id.slice(0, 8)} — ${title}`,
    html: `<p>Your payment for <strong>${title}</strong> was confirmed.</p>
<p>Order ${order.reference || order.id.slice(0, 8)} · HK$${Number(order.gross_hkd).toFixed(0)}</p>
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
