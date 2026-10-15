import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findContactViolations } from "@/lib/contact-filter";
import {
  MIN_PRICE_HKD,
  buildMaterialSlug,
  checkSubmitReadiness,
  extendedPreviewPageLimit,
  mergeNoteKinds,
  nextStatus,
  validateNoteKindsForSubmit,
  validateNoteKindsPartial,
  type MaterialStatus,
  type MaterialType,
} from "@/features/materials/lifecycle";
import {
  asAdminDb,
  base64ToBytes,
  buildMaterialStorageName,
  previewPathFor,
  assertPdfNotEncrypted,
  type AdminDb,
} from "@/features/materials/storage-helpers";
import { watermarkPdfPreview } from "@/features/materials/watermark";

/**
 * P8 (#288) / P9 (#289): the tutor-side notes lifecycle server functions.
 * A note starts as a draft owned by the Google account, is submitted to
 * staff review, and publishes only on approval. Live edits of title /
 * price / description go out after the contact filter; a replaced PDF is
 * staged (pending_original_file_path + edit_status) until staff approve the
 * swap — the old file stays on sale in the meantime.
 */

const PRIVATE_BUCKET = "materials-originals";
const PUBLIC_BUCKET = "materials-previews";

type MaterialRow = {
  id: string;
  tutor_id: string;
  title: string;
  slug: string | null;
  status: MaterialStatus;
  price_hkd: number;
  original_file_path: string | null;
  edit_status: string | null;
  curriculum_tag: string;
  subject_tag: string | null;
  material_type: MaterialType;
  topic: string | null;
  grade_achieved: string | null;
  exemplar_permission: boolean;
};

const DraftMetaInput = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  priceHkd: z.number().min(0).max(100_000).optional(),
  // #313 note kinds: curriculum is the site's canonical list, type is the
  // 3-way notes/mock/exemplar split, topic is a free 40-char filter.
  // nullish topic/grade/subject = explicit clear (null) vs keep (absent).
  curriculumTag: z.enum(["IB", "DSE", "IGCSE", "A-Level", "Other"]).optional(),
  subjectTag: z.string().trim().max(160).nullish(),
  materialType: z.enum(["notes", "mock", "exemplar"]).optional(),
  topic: z.string().trim().max(40).nullish(),
  gradeAchieved: z.string().trim().max(20).nullish(),
  exemplarPermission: z.boolean().optional(),
  yearTag: z.string().trim().max(20).optional(),
});

const SaveDraftInput = DraftMetaInput.extend({
  materialId: z.string().uuid().optional(),
});

const SubmitInput = DraftMetaInput.extend({
  materialId: z.string().uuid().optional(),
  base64Data: z.string().trim().min(100).max(60_000_000).optional(),
  fileName: z.string().trim().max(200).optional(),
});

const EditLiveInput = DraftMetaInput.extend({
  materialId: z.string().uuid(),
  base64Data: z.string().trim().min(100).max(60_000_000).optional(),
  fileName: z.string().trim().max(200).optional(),
});

export type MyMaterialsRow = {
  id: string;
  title: string;
  status: MaterialStatus;
  priceHkd: number;
  rejectionReason: string | null;
  editStatus: string | null;
  editRejectionReason: string | null;
  viewCount: number;
  soldCount: number;
  previewUrl: string;
  updatedAt: string;
  curriculumTag: string;
  subjectTag: string | null;
  materialType: MaterialType;
  topic: string | null;
  gradeAchieved: string | null;
  exemplarPermission: boolean;
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

function assertCleanCopy(fields: {
  title?: string;
  description?: string;
  topic?: string;
  gradeAchieved?: string;
}) {
  const labels: Record<string, string> = {
    title: "Title",
    description: "Description",
    topic: "Topic",
    gradeAchieved: "Grade achieved",
  };
  for (const [field, text] of Object.entries(fields)) {
    if (!text) continue;
    const violations = findContactViolations(text);
    if (violations.length > 0) {
      throw new Error(
        `${labels[field]} contains contact details (${violations
          .map((v) => v.match)
          .slice(0, 2)
          .join(", ")}). Remove them to save.`,
      );
    }
  }
}

/** Owner-only load that works for every status (drafts included). */
async function loadOwnedMaterial(
  db: AdminDb,
  materialId: string,
  tutorId: string,
): Promise<MaterialRow> {
  const { data, error } = await db
    .from<MaterialRow>("digital_materials")
    .select(
      "id, tutor_id, title, slug, status, price_hkd, original_file_path, edit_status, curriculum_tag, subject_tag, material_type, topic, grade_achieved, exemplar_permission",
    )
    .eq("id", materialId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Note not found.");
  if (data.tutor_id !== tutorId) throw new Error("This note belongs to another account.");
  return data;
}

async function generateUniqueSlug(db: AdminDb, title: string, excludeId?: string): Promise<string> {
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

const UNLOCKED_FILE_ERROR = "This PDF is password-protected. Please upload an unlocked file.";

/**
 * Shared PDF staging used by uploadNotePdf, submitNoteForReview and
 * editLiveNote. Server functions cannot call each other's fetchers
 * server-side, so the pipeline lives in this plain helper instead.
 * Returns whether the file was staged as a pending edit (live doc) or
 * attached directly (draft).
 */
async function stagePdfForMaterial(
  db: AdminDb,
  tutor: { id: string; display_name: string },
  material: MaterialRow,
  fileName: string,
  base64Data: string,
): Promise<{ staged: boolean }> {
  const bytes = base64ToBytes(base64Data);
  const isLiveDoc = material.status === "published" || material.status === "hidden";
  // Live docs skip preview generation until approval — the staged file is
  // not public, and stamping the wrong version onto the live preview URL
  // would leak the replacement before staff sign it off.
  const preview = isLiveDoc ? null : await buildExtendedPreview(bytes);

  const path = buildMaterialStorageName(fileName, tutor.display_name);
  const { error } = await db.storage
    .from(PRIVATE_BUCKET)
    .upload(path, bytes as unknown as BlobPart, { contentType: "application/pdf" });
  if (error) throw new Error(error.message);

  if (preview) {
    const previewPath = previewPathFor(path);
    const { error: previewError } = await db.storage
      .from(PUBLIC_BUCKET)
      .upload(previewPath, preview.previewBytes as unknown as BlobPart, {
        contentType: "application/pdf",
      });
    if (previewError) {
      await db.storage.from(PRIVATE_BUCKET).remove([path]);
      throw new Error(previewError.message);
    }
    const { data: url } = db.storage.from(PUBLIC_BUCKET).getPublicUrl(previewPath);
    const { error: updateError } = await db
      .from<never>("digital_materials")
      .update({
        original_file_path: path,
        watermarked_preview_url: url?.publicUrl ?? "",
        preview_pages: preview.previewPages,
        page_count: preview.pageCount,
      })
      .eq("id", material.id);
    if (updateError) {
      await db.storage.from(PRIVATE_BUCKET).remove([path]);
      throw new Error(updateError.message);
    }
  } else {
    const { error: updateError } = await db
      .from<never>("digital_materials")
      .update({ pending_original_file_path: path, edit_status: "pending_review" })
      .eq("id", material.id);
    if (updateError) {
      await db.storage.from(PRIVATE_BUCKET).remove([path]);
      throw new Error(updateError.message);
    }
  }
  return { staged: isLiveDoc };
}

/**
 * Validate the PDF and produce the extended watermarked preview (Ryan:
 * ~30% of pages, cap 12; first 3 render crisp on the note page, the rest
 * blur client-side). Returns everything the listing row needs.
 */
async function buildExtendedPreview(bytes: Uint8Array): Promise<{
  pageCount: number;
  previewPages: number;
  previewBytes: Uint8Array;
}> {
  const pageCount = await assertPdfNotEncrypted(bytes).catch(() => {
    throw new Error(UNLOCKED_FILE_ERROR);
  });
  const limit = extendedPreviewPageLimit(pageCount);
  const { bytes: previewBytes, pageCount: previewPages } = await watermarkPdfPreview(bytes, {
    pageLimit: limit,
  });
  return { pageCount, previewPages, previewBytes };
}

type DraftKindInput = {
  curriculumTag?: string | null;
  subjectTag?: string | null;
  materialType?: MaterialType | null;
  topic?: string | null;
  gradeAchieved?: string | null;
  exemplarPermission?: boolean | null;
};

type StoredKindRow = Pick<
  MaterialRow,
  | "curriculum_tag"
  | "subject_tag"
  | "material_type"
  | "topic"
  | "grade_achieved"
  | "exemplar_permission"
>;

/**
 * #340: tutor draft/submit zod fields are `curriculumTag` / `subjectTag`.
 * `mergeNoteKinds` reads `curriculum` / `subject`, so passing the zod object
 * through treats a filled curriculum as "keep stored" (empty on a new note).
 * Both save and submit go through this remap. `undefined` still means keep;
 * `null` / empty still means clear.
 */
export function mergeDraftNoteKinds(data: DraftKindInput, existing?: StoredKindRow | null) {
  return mergeNoteKinds(
    {
      curriculum: data.curriculumTag,
      subject: data.subjectTag,
      materialType: data.materialType,
      topic: data.topic,
      gradeAchieved: data.gradeAchieved,
      exemplarPermission: data.exemplarPermission,
    },
    existing
      ? {
          curriculumTag: existing.curriculum_tag,
          subjectTag: existing.subject_tag,
          materialType: existing.material_type,
          topic: existing.topic,
          gradeAchieved: existing.grade_achieved,
          exemplarPermission: existing.exemplar_permission,
        }
      : undefined,
  );
}

/** Same remap, into the strict submit validator (which also reads `curriculum` / `subject`).
 * #346: the stored legacy subjectTag is passed through so a re-save of a
 * pre-catalog value (the form's legacy option) still validates. */
export function validateDraftNoteKindsForSubmit(
  kinds: ReturnType<typeof mergeDraftNoteKinds>,
  storedSubject?: string | null,
) {
  return validateNoteKindsForSubmit(
    {
      curriculum: kinds.curriculum,
      subject: kinds.subject,
      materialType: kinds.materialType,
      topic: kinds.topic,
      gradeAchieved: kinds.gradeAchieved,
      exemplarPermission: kinds.exemplarPermission,
    },
    storedSubject,
  );
}

/** P8: create or update the signed-in tutor's draft. Any subset of fields. */
export const saveNoteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveDraftInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    assertCleanCopy({
      title: data.title,
      description: data.description,
      topic: data.topic ?? undefined,
      gradeAchieved: data.gradeAchieved ?? undefined,
    });
    // #346: the stored row loads first so the partial subject check can
    // exempt the note's own legacy subjectTag (the form's legacy option).
    const existing = data.materialId
      ? await loadOwnedMaterial(db, data.materialId, tutor.id)
      : null;
    const kindErrors = validateNoteKindsPartial(
      {
        curriculum: data.curriculumTag,
        subject: data.subjectTag,
        materialType: data.materialType,
        topic: data.topic,
        gradeAchieved: data.gradeAchieved,
      },
      existing?.subject_tag ?? null,
    );
    if (kindErrors.length > 0) throw new Error(kindErrors.join(" "));

    // #313 review fix: merge with explicit-clear semantics — switching the
    // type away from exemplar (or clearing topic/grade) must actually write
    // the cleared values, not silently keep the stored ones.
    const kinds = mergeDraftNoteKinds(data, existing);

    if (existing) {
      const { error } = await db
        .from<never>("digital_materials")
        .update({
          ...(data.title != null ? { title: data.title } : {}),
          ...(data.description != null ? { description: data.description } : {}),
          ...(data.priceHkd != null ? { price_hkd: data.priceHkd } : {}),
          curriculum_tag: kinds.curriculum,
          subject_tag: kinds.subject || null,
          material_type: kinds.materialType,
          topic: kinds.topic || null,
          grade_achieved: kinds.gradeAchieved,
          exemplar_permission: kinds.exemplarPermission,
          ...(data.yearTag != null ? { year_tag: data.yearTag } : {}),
        })
        .eq("id", data.materialId);
      if (error) throw new Error(error.message);
      return { materialId: data.materialId };
    }

    const { data: inserted, error } = await db
      .from<{ id: string }>("digital_materials")
      .insert({
        tutor_id: tutor.id,
        title: data.title?.trim() || "Untitled note",
        description: data.description ?? null,
        price_hkd: data.priceHkd ?? 0,
        curriculum_tag: kinds.curriculum,
        subject_tag: kinds.subject || null,
        material_type: kinds.materialType,
        topic: kinds.topic || null,
        grade_achieved: kinds.gradeAchieved,
        exemplar_permission: kinds.exemplarPermission,
        year_tag: data.yearTag ?? null,
        status: "draft",
        original_file_path: "",
        watermarked_preview_url: "",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { materialId: inserted.id };
  });

/**
 * P8: attach/replace the draft's PDF, or stage a replacement on a live note
 * (P9 — the live file stays on sale until staff approve the swap).
 */
export const uploadNotePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        fileName: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .regex(/\.pdf$/i),
        base64Data: z.string().trim().min(100).max(60_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const material = await loadOwnedMaterial(db, data.materialId, tutor.id);

    return stagePdfForMaterial(db, tutor, material, data.fileName, data.base64Data);
  });

const SubmitForReviewInput = SubmitInput;

/** P8 submit: validates required fields, then parks the note for staff review. */
export const submitNoteForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SubmitForReviewInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    assertCleanCopy({
      title: data.title,
      description: data.description,
      topic: data.topic ?? undefined,
      gradeAchieved: data.gradeAchieved ?? undefined,
    });

    const existing = data.materialId
      ? await loadOwnedMaterial(db, data.materialId, tutor.id)
      : null;
    // #313 review fix: explicit-clear semantics — a null/empty grade or
    // topic clears the stored value, and a non-exemplar type drops the
    // stale grade/permission instead of letting them fail validation.
    // #340: curriculum/subject are remapped inside mergeDraftNoteKinds.
    const kinds = mergeDraftNoteKinds(data, existing);
    const merged = {
      title: data.title ?? existing?.title,
      priceHkd: data.priceHkd ?? Number(existing?.price_hkd ?? 0),
      hasPdf: Boolean(data.base64Data) || Boolean(existing?.original_file_path),
    };
    const check = checkSubmitReadiness(merged);
    if (!check.ok) {
      throw new Error(`Missing: ${check.missing.join(", ")}`);
    }
    const kindErrors = validateDraftNoteKindsForSubmit(kinds, existing?.subject_tag ?? null);
    if (kindErrors.length > 0) {
      throw new Error(kindErrors.join(" "));
    }
    if (merged.priceHkd < MIN_PRICE_HKD) {
      throw new Error(`Price must be at least HK$${MIN_PRICE_HKD}.`);
    }

    let materialId: string;
    if (!existing) {
      // First submission doubles as draft creation: validate + watermark +
      // upload, then insert straight into pending_review.
      if (!data.base64Data) throw new Error("Missing: pdf");
      const bytes = base64ToBytes(data.base64Data);
      const preview = await buildExtendedPreview(bytes);
      materialId = crypto.randomUUID();
      const originalPath = buildMaterialStorageName(
        data.fileName || "note.pdf",
        tutor.display_name,
      );
      const { error } = await db.storage
        .from(PRIVATE_BUCKET)
        .upload(originalPath, bytes as unknown as BlobPart, { contentType: "application/pdf" });
      if (error) throw new Error(error.message);

      const previewPath = previewPathFor(originalPath);
      const { error: previewError } = await db.storage
        .from(PUBLIC_BUCKET)
        .upload(previewPath, preview.previewBytes as unknown as BlobPart, {
          contentType: "application/pdf",
        });
      if (previewError) {
        await db.storage.from(PRIVATE_BUCKET).remove([originalPath]);
        throw new Error(previewError.message);
      }
      const { data: url } = db.storage.from(PUBLIC_BUCKET).getPublicUrl(previewPath);

      const slug = await generateUniqueSlug(db, merged.title as string, materialId);
      const { error: insertError } = await db.from<never>("digital_materials").insert({
        id: materialId,
        tutor_id: tutor.id,
        title: merged.title,
        description: data.description ?? null,
        price_hkd: merged.priceHkd,
        curriculum_tag: kinds.curriculum,
        subject_tag: kinds.subject || null,
        material_type: kinds.materialType,
        topic: kinds.topic || null,
        grade_achieved: kinds.gradeAchieved,
        exemplar_permission: kinds.exemplarPermission,
        year_tag: data.yearTag ?? null,
        status: "pending_review",
        submitted_at: new Date().toISOString(),
        slug,
        original_file_path: originalPath,
        watermarked_preview_url: url?.publicUrl ?? "",
        preview_pages: preview.previewPages,
        page_count: preview.pageCount,
      });
      if (insertError) {
        await db.storage.from(PRIVATE_BUCKET).remove([originalPath]);
        throw new Error(insertError.message);
      }
    } else {
      materialId = existing.id;
      if (data.base64Data) {
        await stagePdfForMaterial(
          db,
          tutor,
          existing,
          data.fileName || "note.pdf",
          data.base64Data,
        );
      }
      const next = nextStatus(existing.status, "submit");
      if (!next) throw new Error("This note cannot be submitted right now.");
      const { error } = await db
        .from<never>("digital_materials")
        .update({
          ...(data.title != null ? { title: data.title } : {}),
          ...(data.description != null ? { description: data.description } : {}),
          ...(data.priceHkd != null ? { price_hkd: data.priceHkd } : {}),
          curriculum_tag: kinds.curriculum,
          subject_tag: kinds.subject || null,
          material_type: kinds.materialType,
          topic: kinds.topic || null,
          grade_achieved: kinds.gradeAchieved,
          exemplar_permission: kinds.exemplarPermission,
          status: next,
          rejection_reason: null,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", materialId);
      if (error) throw new Error(error.message);

      // Slug assigned at first submit (public-ready), uniqueness-checked.
      const { data: row } = await db
        .from<{ title: string; slug: string | null }>("digital_materials")
        .select("title, slug")
        .eq("id", materialId)
        .single();
      if (row && !row.slug) {
        const slug = await generateUniqueSlug(db, row.title, materialId);
        await db.from<never>("digital_materials").update({ slug }).eq("id", materialId);
      }
    }

    return { materialId };
  });

/** P9: edit a live note's text/price — live after the contact filter. */
export const editLiveNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EditLiveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const material = await loadOwnedMaterial(db, data.materialId, tutor.id);
    assertCleanCopy({ title: data.title, description: data.description });

    if (data.base64Data) {
      await stagePdfForMaterial(db, tutor, material, data.fileName || "note.pdf", data.base64Data);
    }

    const { error } = await db
      .from<never>("digital_materials")
      .update({
        ...(data.title != null ? { title: data.title } : {}),
        ...(data.description != null ? { description: data.description } : {}),
        ...(data.priceHkd != null ? { price_hkd: data.priceHkd } : {}),
        ...(data.yearTag != null ? { year_tag: data.yearTag } : {}),
      })
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    return { staged: Boolean(data.base64Data) };
  });

/** P8: hide/unhide from Account. Buyers who already paid keep access (#203). */
export const setNoteHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ materialId: z.string().uuid(), hidden: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const material = await loadOwnedMaterial(db, data.materialId, tutor.id);

    const next = nextStatus(material.status, data.hidden ? "hide" : "unhide");
    if (!next) throw new Error("This note cannot be hidden or restored right now.");
    const { error } = await db
      .from<never>("digital_materials")
      .update({ status: next })
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    return { status: next };
  });

/** P8: everything the Account page lists, every status, newest edit first. */
export const getMyMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyMaterialsRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);

    const { data, error } = await db
      .from<{
        id: string;
        title: string;
        status: MaterialStatus;
        price_hkd: number;
        rejection_reason: string | null;
        edit_status: string | null;
        edit_rejection_reason: string | null;
        view_count: number;
        sold_count: number;
        watermarked_preview_url: string | null;
        updated_at: string;
        curriculum_tag: string;
        subject_tag: string | null;
        material_type: MaterialType;
        topic: string | null;
        grade_achieved: string | null;
        exemplar_permission: boolean;
      }>("digital_materials")
      .select(
        "id, title, status, price_hkd, rejection_reason, edit_status, edit_rejection_reason, view_count, sold_count, watermarked_preview_url, updated_at, curriculum_tag, subject_tag, material_type, topic, grade_achieved, exemplar_permission",
      )
      .eq("tutor_id", tutor.id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title || "Untitled note",
      status: row.status ?? "draft",
      priceHkd: Number(row.price_hkd ?? 0),
      rejectionReason: row.rejection_reason ?? null,
      editStatus: row.edit_status ?? null,
      editRejectionReason: row.edit_rejection_reason ?? null,
      viewCount: Number(row.view_count ?? 0),
      soldCount: Number(row.sold_count ?? 0),
      previewUrl: row.watermarked_preview_url ?? "",
      updatedAt: row.updated_at ?? "",
      curriculumTag: row.curriculum_tag ?? "",
      subjectTag: row.subject_tag ?? null,
      materialType: row.material_type ?? "notes",
      topic: row.topic ?? null,
      gradeAchieved: row.grade_achieved ?? null,
      exemplarPermission: row.exemplar_permission === true,
    }));
  });
