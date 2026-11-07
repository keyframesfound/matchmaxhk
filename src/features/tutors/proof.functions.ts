import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Row } from "@/features/cases/desk-db";
import { looksLikeHkid } from "@/features/tutors/grades";

/**
 * Issue #575 — public photo proofs on achievements.
 *
 * Tutors attach a PUBLIC photo (certificate / medal / graduation photo) to
 * an achievement item. Storage: the PUBLIC materials-previews bucket
 * (gig/cover precedent) under tutor-proofs/; the private grade-slips and
 * credential-evidence buckets are never touched, and identity cards are
 * rejected server-side. The UI warns the tutor the photo becomes public.
 */

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const ProofFile = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(100),
  size: z.number().int().positive(),
  content: z.string().min(1),
});

export const uploadAchievementProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProofFile.parse(input))
  .handler(async ({ data, context }) => {
    if (looksLikeHkid(data.filename)) {
      throw new Error("Do not upload an identity card. Show a certificate or award photo.");
    }
    if (!ACCEPTED_TYPES.has(data.contentType)) {
      throw new Error("Upload an image (JPG, PNG, WebP).");
    }
    const bytes = Buffer.from(data.content, "base64");
    if (bytes.length === 0 || bytes.length !== data.size) throw new Error("Invalid file data.");
    if (bytes.length > MAX_PROOF_BYTES) throw new Error("Files must be 10 MB or smaller.");

    const ext =
      data.contentType === "image/png" ? "png" : data.contentType === "image/webp" ? "webp" : "jpg";
    const path = `tutor-proofs/${context.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("materials-previews")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) throw new Error(error.message);
    return { path };
  });

const AchievementSchema = z.object({
  short_text: z.string().trim().min(1).max(120),
  detail_text: z.string().trim().max(600).optional(),
  proof_image_path: z
    .string()
    .trim()
    .max(300)
    .regex(/^[a-zA-Z0-9/._-]+$/)
    .optional(),
});

export const saveMyAchievementProofs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ achievements: z.array(AchievementSchema).max(3) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = asAdminDb((await import("@/integrations/supabase/client.server")).supabaseAdmin);
    const rows = await selectRows<{ id: string; achievements: unknown }>(
      db,
      "tutors",
      "id, achievements",
      [{ col: "user_id", op: "eq", value: context.userId }],
    );
    const tutor = rows[0];
    if (!tutor) throw new Error("NO_TUTOR_CARD");
    // Keep the stored text fields intact for items the form did not carry,
    // and only the proof path may change — proofs attach to EXISTING items.
    const existing = Array.isArray(tutor.achievements) ? tutor.achievements : [];
    const merged = data.achievements.map((item, i) => {
      const prev = existing[i] as Record<string, unknown> | null | undefined;
      return {
        short_text: prev?.short_text ?? item.short_text,
        detail_text: prev?.detail_text ?? item.detail_text ?? undefined,
        ...(item.proof_image_path ? { proof_image_path: item.proof_image_path } : {}),
      };
    });
    const { error } = await db
      .from<Row>("tutors")
      .update({ achievements: merged })
      .eq("id", tutor.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
