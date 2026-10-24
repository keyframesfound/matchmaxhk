import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb, base64ToBytes, type AdminDb } from "@/features/materials/storage-helpers";
import type { MaterialStatus } from "@/features/materials/lifecycle";

/**
 * #392: the gig cover upload (#326) generalized to EVERY listing kind —
 * the big-cover shop card needs a cover on notes, folders and courses too.
 * Same rails as uploadGigCover: PUBLIC materials-previews bucket, PNG /
 * JPG / WebP only, ≤5MB, path covers/<tutorId>/<uuid>.<ext>, the replaced
 * file is removed best-effort. Covers are staff-reviewed at listing review
 * (QR / contact info in the image is the reject path); the contact filter
 * owns the copy.
 */

const PUBLIC_BUCKET = "materials-previews";

/** #392: cover images only — png/jpg/webp, 5MB (same cap as gigs). */
export const MAX_MATERIAL_COVER_BYTES = 5 * 1024 * 1024;

const COVER_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function materialCoverImageKind(fileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim().toLowerCase());
  const ext = match?.[1] ?? "";
  return ext in COVER_CONTENT_TYPES ? ext : null;
}

type OwnedMaterialRow = {
  id: string;
  tutor_id: string;
  cover_image_path: string | null;
  status: MaterialStatus;
};

async function myTutorRow(db: AdminDb, userId: string): Promise<{ id: string }> {
  const { data, error } = await db
    .from<{ id: string }>("tutors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Failed to look up tutor account");
  if (!data) throw new Error("Your account is not linked to a tutor profile yet.");
  return data;
}

/** Owner-only load that works for every status (drafts included). */
async function loadOwnedMaterial(
  db: AdminDb,
  materialId: string,
  tutorId: string,
): Promise<OwnedMaterialRow> {
  const { data, error } = await db
    .from<OwnedMaterialRow>("digital_materials")
    .select("id, tutor_id, cover_image_path, status")
    .eq("id", materialId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Listing not found.");
  if (data.tutor_id !== tutorId) throw new Error("This listing belongs to another account.");
  return data;
}

const UploadCoverInput = z.object({
  materialId: z.string().uuid(),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/\.(png|jpe?g|webp)$/i, "Covers must be PNG, JPG, or WebP images"),
  base64Data: z.string().trim().min(100).max(10_000_000),
});

/**
 * Attach/replace a listing's cover. Works for every kind (the kind-level
 * required-ness — optional on notes, required on folders/courses — is the
 * editors' and the submit gates' job).
 */
export const uploadMaterialCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => UploadCoverInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const material = await loadOwnedMaterial(db, data.materialId, tutor.id);

    const ext = materialCoverImageKind(data.fileName);
    if (!ext) throw new Error("Covers must be PNG, JPG, or WebP images.");
    const bytes = base64ToBytes(data.base64Data);
    if (bytes.byteLength > MAX_MATERIAL_COVER_BYTES) {
      throw new Error("The cover must be 5MB or smaller.");
    }

    const path = `covers/${tutor.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage
      .from(PUBLIC_BUCKET)
      .upload(path, bytes as unknown as BlobPart, { contentType: COVER_CONTENT_TYPES[ext] });
    if (error) throw new Error(error.message);

    const { error: updateError } = await db
      .from<never>("digital_materials")
      .update({ cover_image_path: path })
      .eq("id", material.id);
    if (updateError) {
      await db.storage.from(PUBLIC_BUCKET).remove([path]);
      throw new Error(updateError.message);
    }
    if (material.cover_image_path && material.cover_image_path !== path) {
      await db.storage.from(PUBLIC_BUCKET).remove([material.cover_image_path]);
    }
    return { coverPath: path };
  });
