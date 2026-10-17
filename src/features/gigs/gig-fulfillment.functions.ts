import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import {
  GIG_DELIVERY_TYPES,
  MAX_GIG_FILE_BYTES,
  transitionGigOrder,
  validateCompletionNote,
} from "@/features/gigs/gig";
import { asAdminDb, base64ToBytes, type AdminDb } from "@/features/materials/storage-helpers";

/**
 * #328: tutor-side fulfillment for paid gig orders. Orders live on
 * material_orders with tutor_id denormalized at creation, so ownership is
 * one eq() — and the SELECT columns never include buyer_account_id: the
 * tutor sees the gig, the money and the deadline, NEVER the buyer's
 * identity. The ghosting fail-safe sweep runs before every read/write so
 * deadlines are enforced lazily (no cron dependency).
 */

const PRIVATE_BUCKET = "materials-originals";

type GigOrderRow = {
  id: string;
  material_id: string;
  tutor_id: string;
  status: string;
  gross_hkd: number;
  in_fulfillment_at: string | null;
  fulfillment_due_at: string | null;
  past_due_at: string | null;
  created_at: string | null;
};

type GigMaterialRow = {
  id: string;
  title: string;
  material_type: string | null;
  gig_category: string | null;
  gig_delivery_type: string | null;
};

export type MyGigOrderRow = {
  orderId: string;
  materialId: string;
  title: string;
  category: string | null;
  deliveryType: string;
  grossHkd: number;
  status: "in_fulfillment" | "past_due";
  fulfillmentDueAt: string | null;
  pastDueAt: string | null;
  /** #328 file_back: the buyer has uploaded their source document. */
  hasSourceFile: boolean;
  createdAt: string;
};

/** file_back returns: PDF or DOCX (same 20MB cap as listing files). */
const GIG_RETURN_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function gigReturnFileKind(fileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim().toLowerCase());
  const ext = match?.[1] ?? "";
  return ext in GIG_RETURN_CONTENT_TYPES ? ext : null;
}

async function myTutorRow(
  db: AdminDb,
  userId: string,
): Promise<{ id: string; display_name: string }> {
  const { data, error } = await db
    .from<{ id: string; display_name: string }>("tutors")
    .select("id, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Failed to look up tutor account");
  if (!data) throw new Error("Your account is not linked to a tutor profile yet.");
  return data;
}

/** #328 lazy sweep: flips in_fulfillment gig orders past due + grace. */
async function sweepPastDueOrders(db: AdminDb): Promise<void> {
  const { error } = await db.rpc("sweep_past_due_gig_orders", {});
  if (error) throw new Error(error.message || "Failed to check fulfillment deadlines.");
}

/**
 * #328: the tutor's open gig orders (in_fulfillment + past_due) with the
 * listing title and delivery type. Buyer identity is never selected.
 */
export const getMyGigOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyGigOrderRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    await sweepPastDueOrders(db);

    const { data: orders, error } = await db
      .from<GigOrderRow & { buyer_source_path: string | null }>("material_orders")
      .select(
        "id, material_id, tutor_id, status, gross_hkd, in_fulfillment_at, fulfillment_due_at, past_due_at, created_at, buyer_source_path",
      )
      .eq("tutor_id", tutor.id)
      .in("status", ["in_fulfillment", "past_due"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = orders ?? [];
    if (rows.length === 0) return [];

    const { data: materials, error: materialsError } = await db
      .from<GigMaterialRow>("digital_materials")
      .select("id, title, material_type, gig_category, gig_delivery_type")
      .in(
        "id",
        rows.map((row) => row.material_id),
      );
    if (materialsError) throw new Error(materialsError.message);

    const byId = new Map((materials ?? []).map((material) => [material.id, material]));
    return rows.map((row) => {
      const material = byId.get(row.material_id);
      return {
        orderId: row.id,
        materialId: row.material_id,
        title: material?.title ?? "Service order",
        category: material?.gig_category ?? null,
        deliveryType: material?.gig_delivery_type ?? "",
        grossHkd: Number(row.gross_hkd ?? 0),
        status: row.status === "past_due" ? "past_due" : "in_fulfillment",
        fulfillmentDueAt: row.fulfillment_due_at ?? null,
        pastDueAt: row.past_due_at ?? null,
        hasSourceFile: Boolean(row.buyer_source_path),
        createdAt: row.created_at ?? "",
      };
    });
  });

const DeliverGigInput = z.object({
  orderId: z.string().uuid(),
  // session_confirm / package_handoff only; validateCompletionNote owns the
  // 300-char cap + contact filter (looser zod cap so those errors surface).
  completionNote: z.string().trim().max(1000).nullish(),
  base64Data: z.string().trim().min(100).max(60_000_000).optional(),
  fileName: z.string().trim().min(1).max(200).optional(),
});

/**
 * #328: tutor delivers a paid gig order. Sweep → ownership → legal
 * transition → payload validation → status flip → sold-count increment.
 * file_back stores the return file in the PRIVATE materials-originals
 * bucket at gigs-orders/<orderId>/return.<ext> (the buyer later gets a
 * signed URL off delivered status, exactly like notes).
 */
export const deliverGigOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => DeliverGigInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);

    // Sweep BEFORE the transition check: a stale in_fulfillment row whose
    // deadline passed must be past_due first (still deliverable, but the
    // strike/refund state machine sees the truth).
    await sweepPastDueOrders(db);

    const { data: order, error } = await db
      .from<GigOrderRow>("material_orders")
      .select(
        "id, material_id, tutor_id, status, in_fulfillment_at, fulfillment_due_at, past_due_at, created_at",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");
    if (order.tutor_id !== tutor.id) throw new Error("This order belongs to another tutor.");

    const { data: material, error: materialError } = await db
      .from<GigMaterialRow>("digital_materials")
      .select("id, title, material_type, gig_category, gig_delivery_type")
      .eq("id", order.material_id)
      .maybeSingle();
    if (materialError) throw new Error(materialError.message);
    if (!material || material.material_type !== "gig") {
      throw new Error("This order is not a service gig.");
    }
    const deliveryType = material.gig_delivery_type ?? "";
    if (!(GIG_DELIVERY_TYPES as readonly string[]).includes(deliveryType)) {
      throw new Error("This service has no valid delivery type.");
    }

    const next = transitionGigOrder(order.status, "deliver");
    if (!next) throw new Error("This order cannot be delivered right now.");

    let deliveredFilePath: string | null = null;
    let completionNote: string | null = null;
    if (deliveryType === "file_back") {
      if (!data.base64Data || !data.fileName) {
        throw new Error("Upload the return file to deliver this order.");
      }
      const ext = gigReturnFileKind(data.fileName);
      if (!ext) throw new Error("The return file must be a PDF or DOCX.");
      const bytes = base64ToBytes(data.base64Data);
      if (bytes.byteLength > MAX_GIG_FILE_BYTES) {
        throw new Error("The return file must be 20MB or smaller.");
      }
      const path = `gigs-orders/${order.id}/return.${ext}`;
      const { error: uploadError } = await db.storage
        .from(PRIVATE_BUCKET)
        .upload(path, bytes as unknown as BlobPart, { contentType: GIG_RETURN_CONTENT_TYPES[ext] });
      if (uploadError) throw new Error(uploadError.message);
      deliveredFilePath = path;
    } else if (data.completionNote?.trim()) {
      const noteErrors = validateCompletionNote(data.completionNote);
      if (noteErrors.length > 0) throw new Error(noteErrors.join(" "));
      completionNote = data.completionNote.trim();
    }

    const { error: deliverError } = await db
      .from<never>("material_orders")
      .update({
        status: next,
        delivered_at: new Date().toISOString(),
        ...(deliveredFilePath ? { delivered_file_path: deliveredFilePath } : {}),
        ...(completionNote ? { completion_note: completionNote } : {}),
      })
      .eq("id", order.id);
    if (deliverError) {
      if (deliveredFilePath) await db.storage.from(PRIVATE_BUCKET).remove([deliveredFilePath]);
      throw new Error(deliverError.message);
    }

    // #329: bought counts count DELIVERED orders only — keep sold_count in
    // sync exactly like the notes release path (checkout.functions.ts).
    await db.rpc("increment_material_sold_count", { p_material_id: order.material_id });

    return { orderId: order.id, status: next };
  });

const GigSourceUrlInput = z.object({ orderId: z.string().uuid() });

/**
 * #328 file_back: the tutor's signed-URL read of the buyer's uploaded
 * source document. Grok review 2026-10-17 (merge-blocking): fulfillment
 * was upload-only — the tutor could return an annotated file but never
 * download the one they are supposed to annotate. Owner gate (tutor_id),
 * state gate (in_fulfillment | past_due — the same windows uploadGigSourceFile
 * accepts), and the order's gig must be file_back. materials-originals is
 * PRIVATE: this fn is the only tutor-side door, and it never exposes the
 * buyer's identity.
 */
export const getGigBuyerSourceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GigSourceUrlInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    await sweepPastDueOrders(db);

    const { data: order, error } = await db
      .from<{
        id: string;
        tutor_id: string;
        status: string;
        buyer_source_path: string | null;
        digital_materials: { gig_delivery_type: string | null } | null;
      }>("material_orders")
      .select("id, tutor_id, status, buyer_source_path, digital_materials(gig_delivery_type)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");
    if (order.tutor_id !== tutor.id) throw new Error("This order belongs to another tutor.");
    if (order.status !== "in_fulfillment" && order.status !== "past_due") {
      throw new Error("This order is not open for fulfillment.");
    }
    if (order.digital_materials?.gig_delivery_type !== "file_back") {
      throw new Error("This service does not use a source file.");
    }
    if (!order.buyer_source_path) {
      throw new Error("The buyer has not uploaded a source file yet.");
    }

    const { data: signed, error: signError } = await db.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(order.buyer_source_path, 600);
    if (signError || !signed) throw new Error(signError?.message || "Failed to sign URL");
    return { signedUrl: signed.signedUrl };
  });
