import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Row } from "@/features/cases/desk-db";
import { looksLikeHkid } from "@/features/tutors/grades";
import { contactFilterError } from "@/lib/contact-filter";

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

/** The only folder a caller may publish a proof from. */
export function proofPrefix(userId: string): string {
  return `tutor-proofs/${userId}/`;
}

/**
 * Normalise a bucket key: fold `//`, drop a leading `/`, resolve `.` and
 * `..` segments. null = not a key in our bucket (empty, absolute URL,
 * protocol-relative, Windows separators, or a path escaping the bucket root).
 * The case-files.functions.ts `ownedPath` precedent, tightened because a proof
 * path is published in the tutor's public achievements JSON.
 */
export function normalizeProofPath(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null; // absolute URL
  if (value.startsWith("//")) return null; // protocol-relative URL
  if (value.includes("\\")) return null;
  const segments: string[] = [];
  for (const segment of value.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null; // escapes the bucket root
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.length > 0 ? segments.join("/") : null;
}

/**
 * #575 ownership guard: the upload writes `tutor-proofs/<userId>/…`, so the
 * save must accept nothing but a FILE inside that prefix. Without this a tutor
 * could re-point an achievement at another tutor's certificate (or at a
 * generated `previews/…` asset) and publish it as their own credential.
 */
export function ownedProofPath(userId: string, raw: string): boolean {
  if (!userId) return false;
  const normalized = normalizeProofPath(raw);
  if (!normalized) return false;
  const prefix = proofPrefix(userId);
  return normalized.startsWith(prefix) && normalized.length > prefix.length;
}

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

/**
 * #712 AC-1 — the caption fields (`short_text` / `detail_text`) are rendered
 * verbatim on the public profile, so they must not carry a direct-contact
 * channel: the concierge flow only works while MatchMax sits between parent and
 * tutor. Same rule vocabulary as every other public tutor text (contact-filter
 * is the single source of truth); a stable code is returned instead of the
 * regex detail so the response never says which pattern matched.
 */
export const PROOF_CONTACT_BLOCKED = "PROOF_CONTACT_BLOCKED";

/**
 * Screen the caption fields that end up in the public achievements JSON.
 * Returns `PROOF_CONTACT_BLOCKED` when any field leaks a phone number,
 * WhatsApp/WeChat/Instagram-style channel, email or link; null when clean.
 */
export function proofContactViolation(
  items: ReadonlyArray<{ short_text?: unknown; detail_text?: unknown }>,
): string | null {
  for (const item of items) {
    for (const value of [item.short_text, item.detail_text]) {
      if (typeof value !== "string" || !value.trim()) continue;
      if (contactFilterError(value)) return PROOF_CONTACT_BLOCKED;
    }
  }
  return null;
}

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
    // #575: validate every path before any DB work. `proof_image_path` is a
    // public bucket key, so it must sit inside the caller's own upload prefix —
    // the upload handler above is the only legitimate producer of such a path.
    for (const item of data.achievements) {
      if (item.proof_image_path && !ownedProofPath(context.userId, item.proof_image_path)) {
        throw new Error("That proof photo is not yours. Upload your own certificate or award.");
      }
    }

    // #712 AC-1: screen every caption BEFORE any DB work. One code for both
    // fields, so a caller cannot probe which pattern fired.
    const blocked = proofContactViolation(data.achievements);
    if (blocked) throw new Error(blocked);

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
