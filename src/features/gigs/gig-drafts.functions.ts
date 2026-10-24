import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { contactFilterError } from "@/lib/contact-filter";
import {
  gigFreestylePrivilegePaused,
  mergeGigIntegrity,
  validateGigForSubmit,
  validateGigPartial,
} from "@/features/gigs/gig";
import {
  buildMaterialSlug,
  isAllowedNoteSubject,
  nextStatus,
  type MaterialStatus,
} from "@/features/materials/lifecycle";
import { asAdminDb, base64ToBytes, type AdminDb } from "@/features/materials/storage-helpers";

/**
 * #326/#327: tutor-side freestyle gig lifecycle server functions. A gig is
 * a SERVICE listing on the notes rails: same draft → pending_review →
 * published/rejected status machine, but material_type/document_type =
 * 'gig', no source file (cover image only), and a category + delivery type
 * + turnaround clock instead of note kinds. Ownership is re-checked on
 * every write via tutors.user_id → digital_materials.tutor_id.
 */

const PUBLIC_BUCKET = "materials-previews";

/** #326: cover images only, png/jpg/webp, 5MB (smaller than the PDF cap). */
export const MAX_GIG_COVER_BYTES = 5 * 1024 * 1024;

const GIG_COVER_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function gigCoverImageKind(fileName: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim().toLowerCase());
  const ext = match?.[1] ?? "";
  return ext in GIG_COVER_CONTENT_TYPES ? ext : null;
}

type GigRow = {
  id: string;
  tutor_id: string;
  title: string;
  slug: string | null;
  status: MaterialStatus;
  price_hkd: number;
  description: string | null;
  gig_category: string | null;
  gig_delivery_type: string | null;
  turnaround_note: string | null;
  turnaround_hours: number | null;
  cover_image_path: string | null;
  integrity_confirmed_at: string | null;
  curriculum_tag: string | null;
  subject_tag: string | null;
};

const GIG_SELECT =
  "id, tutor_id, title, slug, status, price_hkd, description, gig_category, gig_delivery_type, turnaround_note, turnaround_hours, cover_image_path, integrity_confirmed_at, curriculum_tag, subject_tag";

/**
 * Zod caps are deliberately LOOSER than the domain caps so
 * validateGigPartial / validateGigForSubmit produce the friendly errors
 * (mirrors DraftMetaInput in note-drafts.functions.ts).
 */
const GigMetaInput = z.object({
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  priceHkd: z.number().min(0).max(100_000).optional(),
  category: z.string().trim().max(60).optional(),
  deliveryType: z.string().trim().max(60).optional(),
  turnaroundNote: z.string().trim().max(200).nullish(),
  turnaroundHours: z.number().int().min(0).max(1000).nullish(),
  curriculumTag: z.enum(["IB", "DSE", "IGCSE", "A-Level", "Other"]).optional(),
  subjectTag: z.string().trim().max(160).nullish(),
  integrityConfirmed: z.boolean().optional(),
});

export type MyGigRow = {
  id: string;
  title: string;
  description: string | null;
  status: MaterialStatus;
  priceHkd: number;
  rejectionReason: string | null;
  category: string | null;
  deliveryType: string | null;
  turnaroundNote: string | null;
  turnaroundHours: number | null;
  curriculumTag: string | null;
  subjectTag: string | null;
  coverUrl: string;
  integrityConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
};

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

/** Owner-only load that works for every status (drafts included). */
async function loadOwnedGig(db: AdminDb, gigId: string, tutorId: string): Promise<GigRow> {
  const { data, error } = await db
    .from<GigRow>("digital_materials")
    .select(GIG_SELECT)
    .eq("id", gigId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Service not found.");
  if (data.tutor_id !== tutorId) throw new Error("This service belongs to another account.");
  return data;
}

function assertCleanGigCopy(fields: {
  title?: string;
  description?: string;
  turnaroundNote?: string | null;
}) {
  for (const text of Object.values(fields)) {
    if (!text) continue;
    const problem = contactFilterError(text);
    if (problem) throw new Error(problem);
  }
}

/**
 * #330: upheld contact-detail reports pause the freestyle privilege after the
 * threshold (gig.ts), no new gig drafts or submissions until staff clear the
 * reports. Runs on create AND submit so a paused tutor cannot round-trip an
 * existing draft through the submit gate either.
 */
async function assertFreestylePrivilege(db: AdminDb, tutorId: string) {
  const { data, error } = await db
    .from<{ id: string }>("reports")
    .select("id")
    .eq("tutor_id", tutorId)
    .eq("reason", "contact_details")
    .eq("status", "upheld");
  if (error) throw new Error(error.message);
  if (gigFreestylePrivilegePaused(data?.length ?? 0)) {
    throw new Error(
      "Your freestyle listing privilege is paused after repeated contact-detail reports. Contact MatchMax to restore it.",
    );
  }
}

/** #346 pattern: the form can only send catalog subjects, allowlist server-side. */
function assertGigSubjectAllowed(
  curriculumTag: string | undefined,
  subjectTag: string | null | undefined,
  storedSubject?: string | null,
) {
  const subject = subjectTag?.trim();
  if (!subject) return;
  if (!isAllowedNoteSubject(curriculumTag || undefined, subject, storedSubject)) {
    throw new Error("Subject must be selected from the list for the chosen curriculum.");
  }
}

async function generateUniqueSlug(db: AdminDb, title: string, excludeId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = buildMaterialSlug(title, attempt === 0 ? undefined : `${attempt + 1}`);
    const { data } = await db
      .from<{ id: string }>("digital_materials")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === excludeId) return candidate;
  }
  return buildMaterialSlug(title, `${Date.now().toString(36)}`);
}

/** #326: create the signed-in tutor's gig draft. Any subset of fields. */
export const createGigDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => GigMetaInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    await assertFreestylePrivilege(db, tutor.id);

    const partialErrors = validateGigPartial({
      title: data.title,
      description: data.description,
      priceHkd: data.priceHkd,
      category: data.category,
      deliveryType: data.deliveryType,
      turnaroundNote: data.turnaroundNote ?? null,
      turnaroundHours: data.turnaroundHours ?? null,
    });
    if (partialErrors.length > 0) throw new Error(partialErrors.join(" "));
    assertCleanGigCopy({
      title: data.title,
      description: data.description,
      turnaroundNote: data.turnaroundNote ?? null,
    });
    assertGigSubjectAllowed(data.curriculumTag, data.subjectTag ?? null);

    const integrity = mergeGigIntegrity({
      category: data.category ?? null,
      integrityConfirmed: data.integrityConfirmed ?? null,
    });

    const { data: inserted, error } = await db
      .from<{ id: string }>("digital_materials")
      .insert({
        tutor_id: tutor.id,
        title: data.title?.trim() || "Untitled service",
        description: data.description ?? null,
        price_hkd: data.priceHkd ?? 0,
        curriculum_tag: data.curriculumTag ?? "",
        subject_tag: data.subjectTag?.trim() || null,
        material_type: "gig",
        document_type: "gig",
        gig_category: integrity.category || null,
        gig_delivery_type: data.deliveryType?.trim() || null,
        turnaround_note: data.turnaroundNote?.trim() || null,
        turnaround_hours: data.turnaroundHours ?? null,
        integrity_confirmed_at: integrity.integrityConfirmedAt,
        cover_image_path: null,
        status: "draft",
        original_file_path: null,
        watermarked_preview_url: "",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { gigId: inserted.id };
  });

const UpdateGigDraftInput = GigMetaInput.extend({ gigId: z.string().uuid() });

/** #326: partial draft update, validateGigPartial + mergeGigIntegrity. */
export const updateGigDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => UpdateGigDraftInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const existing = await loadOwnedGig(db, data.gigId, tutor.id);

    const partialErrors = validateGigPartial({
      title: data.title,
      description: data.description,
      priceHkd: data.priceHkd,
      category: data.category,
      deliveryType: data.deliveryType,
      turnaroundNote: data.turnaroundNote ?? null,
      turnaroundHours: data.turnaroundHours ?? null,
    });
    if (partialErrors.length > 0) throw new Error(partialErrors.join(" "));
    assertCleanGigCopy({
      title: data.title,
      description: data.description,
      turnaroundNote: data.turnaroundNote ?? null,
    });
    assertGigSubjectAllowed(data.curriculumTag, data.subjectTag ?? null, existing.subject_tag);

    // Category/integrity transitions: confirming stamps the timestamp,
    // withdrawing clears it, and leaving document_review drops it entirely.
    const integrity = mergeGigIntegrity(
      { category: data.category ?? null, integrityConfirmed: data.integrityConfirmed ?? null },
      {
        category: existing.gig_category,
        integrityConfirmedAt: existing.integrity_confirmed_at,
      },
    );

    const { error } = await db
      .from<never>("digital_materials")
      .update({
        ...(data.title != null ? { title: data.title } : {}),
        ...(data.description != null ? { description: data.description } : {}),
        ...(data.priceHkd != null ? { price_hkd: data.priceHkd } : {}),
        gig_category: integrity.category || null,
        gig_delivery_type:
          data.deliveryType !== undefined
            ? data.deliveryType.trim() || null
            : existing.gig_delivery_type,
        turnaround_note:
          data.turnaroundNote !== undefined
            ? data.turnaroundNote || null
            : existing.turnaround_note,
        turnaround_hours:
          data.turnaroundHours !== undefined
            ? (data.turnaroundHours ?? null)
            : existing.turnaround_hours,
        curriculum_tag: data.curriculumTag ?? existing.curriculum_tag ?? "",
        subject_tag: data.subjectTag !== undefined ? data.subjectTag || null : existing.subject_tag,
        integrity_confirmed_at: integrity.integrityConfirmedAt,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { gigId: existing.id };
  });

const SubmitGigInput = GigMetaInput.extend({ gigId: z.string().uuid() });

/**
 * #326 submit gate: full validation, contact filter on title AND
 * description, cover required on the row, then draft/rejected →
 * pending_review with the slug + integrity timestamp + submitted_at.
 * The cover itself rides uploadGigCover (the form saves the draft first).
 */
export const submitGig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => SubmitGigInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    await assertFreestylePrivilege(db, tutor.id);
    const existing = await loadOwnedGig(db, data.gigId, tutor.id);

    const integrity = mergeGigIntegrity(
      { category: data.category ?? null, integrityConfirmed: data.integrityConfirmed ?? null },
      {
        category: existing.gig_category,
        integrityConfirmedAt: existing.integrity_confirmed_at,
      },
    );
    const merged = {
      title: data.title ?? existing.title,
      description: data.description ?? existing.description,
      priceHkd: data.priceHkd ?? Number(existing.price_hkd ?? 0),
      category: integrity.category,
      deliveryType: data.deliveryType ?? existing.gig_delivery_type,
      turnaroundNote:
        data.turnaroundNote !== undefined
          ? (data.turnaroundNote ?? null)
          : existing.turnaround_note,
      turnaroundHours:
        data.turnaroundHours !== undefined
          ? (data.turnaroundHours ?? null)
          : existing.turnaround_hours,
      hasCover: Boolean(existing.cover_image_path),
      integrityConfirmed:
        data.integrityConfirmed ?? (existing.integrity_confirmed_at != null ? true : null),
    };

    const errors = validateGigForSubmit(merged);
    if (errors.length > 0) throw new Error(errors.join(" "));

    const title = (merged.title ?? "").trim();
    const titleProblem = contactFilterError(title);
    if (titleProblem) throw new Error(titleProblem);
    const description = (merged.description ?? "").trim();
    const descriptionProblem = contactFilterError(description);
    if (descriptionProblem) throw new Error(descriptionProblem);

    const subjectTag =
      data.subjectTag !== undefined ? data.subjectTag || null : existing.subject_tag;
    assertGigSubjectAllowed(data.curriculumTag, subjectTag, existing.subject_tag);

    const next = nextStatus(existing.status, "submit");
    if (!next) throw new Error("This service cannot be submitted right now.");

    const { error } = await db
      .from<never>("digital_materials")
      .update({
        ...(data.title != null ? { title: data.title } : {}),
        ...(data.description != null ? { description: data.description } : {}),
        ...(data.priceHkd != null ? { price_hkd: data.priceHkd } : {}),
        gig_category: integrity.category || null,
        gig_delivery_type: merged.deliveryType ?? null,
        turnaround_note: merged.turnaroundNote,
        turnaround_hours: merged.turnaroundHours,
        curriculum_tag: data.curriculumTag ?? existing.curriculum_tag ?? "",
        subject_tag: subjectTag,
        integrity_confirmed_at: integrity.integrityConfirmedAt,
        status: next,
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);

    // Slug assigned at first submit (public-ready), uniqueness-checked.
    if (!existing.slug) {
      const slug = await generateUniqueSlug(db, title, existing.id);
      const { error: slugError } = await db
        .from<never>("digital_materials")
        .update({ slug })
        .eq("id", existing.id);
      if (slugError) throw new Error(slugError.message);
    }

    return { gigId: existing.id };
  });

const UploadCoverInput = z.object({
  gigId: z.string().uuid(),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/\.(png|jpe?g|webp)$/i, "Covers must be PNG, JPG, or WebP images"),
  base64Data: z.string().trim().min(100).max(10_000_000),
});

/**
 * #326: cover image → PUBLIC materials-previews bucket at
 * gigs/<tutorId>/<uuid>.<ext>; the path lands in cover_image_path. The
 * replaced cover is removed best-effort so previews don't pile up.
 */
export const uploadGigCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => UploadCoverInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const gig = await loadOwnedGig(db, data.gigId, tutor.id);

    const ext = gigCoverImageKind(data.fileName);
    if (!ext) throw new Error("Covers must be PNG, JPG, or WebP images.");
    const bytes = base64ToBytes(data.base64Data);
    if (bytes.byteLength > MAX_GIG_COVER_BYTES) {
      throw new Error("The cover must be 5MB or smaller.");
    }

    const path = `gigs/${tutor.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage
      .from(PUBLIC_BUCKET)
      .upload(path, bytes as unknown as BlobPart, { contentType: GIG_COVER_CONTENT_TYPES[ext] });
    if (error) throw new Error(error.message);

    const { error: updateError } = await db
      .from<never>("digital_materials")
      .update({ cover_image_path: path })
      .eq("id", gig.id);
    if (updateError) {
      await db.storage.from(PUBLIC_BUCKET).remove([path]);
      throw new Error(updateError.message);
    }
    if (gig.cover_image_path && gig.cover_image_path !== path) {
      await db.storage.from(PUBLIC_BUCKET).remove([gig.cover_image_path]);
    }
    return { coverPath: path };
  });

/** #326: the tutor's gigs, newest first, every status (drafts included). */
export const getMyGigs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyGigRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);

    const { data, error } = await db
      .from<{
        id: string;
        title: string;
        description: string | null;
        status: MaterialStatus;
        price_hkd: number;
        rejection_reason: string | null;
        gig_category: string | null;
        gig_delivery_type: string | null;
        turnaround_note: string | null;
        turnaround_hours: number | null;
        curriculum_tag: string | null;
        subject_tag: string | null;
        cover_image_path: string | null;
        integrity_confirmed_at: string | null;
        created_at: string;
        updated_at: string;
      }>("digital_materials")
      .select(
        "id, title, description, status, price_hkd, rejection_reason, gig_category, gig_delivery_type, turnaround_note, turnaround_hours, curriculum_tag, subject_tag, cover_image_path, integrity_confirmed_at, created_at, updated_at",
      )
      .eq("tutor_id", tutor.id)
      .eq("material_type", "gig")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title || "Untitled service",
      description: row.description ?? null,
      status: row.status ?? "draft",
      priceHkd: Number(row.price_hkd ?? 0),
      rejectionReason: row.rejection_reason ?? null,
      category: row.gig_category ?? null,
      deliveryType: row.gig_delivery_type ?? null,
      turnaroundNote: row.turnaround_note ?? null,
      turnaroundHours: row.turnaround_hours ?? null,
      curriculumTag: row.curriculum_tag ?? null,
      subjectTag: row.subject_tag ?? null,
      coverUrl: row.cover_image_path
        ? (db.storage.from(PUBLIC_BUCKET).getPublicUrl(row.cover_image_path).data?.publicUrl ?? "")
        : "",
      integrityConfirmed: row.integrity_confirmed_at != null,
      createdAt: row.created_at ?? "",
      updatedAt: row.updated_at ?? "",
    }));
  });
