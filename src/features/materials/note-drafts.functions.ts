import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { findContactViolations } from "@/lib/contact-filter";
import {
  buildMaterialSlug,
  checkSubmitReadiness,
  extendedPreviewPageLimit,
  isAllowedMaterialFile,
  materialFileContentType,
  materialFileKind,
  mergeNoteKinds,
  nextStatus,
  validateNoteKindsForSubmit,
  validateNoteKindsPartial,
  WORD_COUNT_MAX,
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
import { sanitizePreviewIndices } from "@/features/materials/preview-pages";
import { CONTENT_LANGUAGES, isValidSubcategory } from "@/features/materials/note-taxonomy";

/**
 * P8 (#288) / P9 (#289): the tutor-side notes lifecycle server functions.
 * A note starts as a draft owned by the Google account, is submitted to
 * staff review, and publishes only on approval. Live edits of title /
 * price / description go out after the contact filter; a replaced PDF is
 * staged (pending_original_file_path + edit_status) until staff approve the
 * swap, the old file stays on sale in the meantime.
 */

const PRIVATE_BUCKET = "materials-originals";
const PUBLIC_BUCKET = "materials-previews";

export type MaterialRow = {
  id: string;
  tutor_id: string;
  title: string;
  slug: string | null;
  status: MaterialStatus;
  price_hkd: number;
  original_file_path: string | null;
  watermarked_preview_url: string | null;
  pending_original_file_path: string | null;
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
  // #314: HK$0 is a valid price (free pack), only negatives are rejected.
  priceHkd: z.number().min(0).max(100_000).optional(),
  // #313 note kinds: curriculum is the site's canonical list, type is the
  // notes/mock/exemplar/flashcards split, topic is a free 40-char filter.
  // nullish topic/grade/subject = explicit clear (null) vs keep (absent).
  curriculumTag: z.enum(["IB", "DSE", "IGCSE", "A-Level", "Other"]).optional(),
  subjectTag: z.string().trim().max(160).nullish(),
  materialType: z.enum(["notes", "mock", "exemplar", "flashcards"]).optional(),
  topic: z.string().trim().max(40).nullish(),
  gradeAchieved: z.string().trim().max(20).nullish(),
  exemplarPermission: z.boolean().optional(),
  // #136: approximate word count, optional, positive integer when present.
  // null clears a stored value; absent keeps it (same semantics as topic).
  wordCount: z.number().int().min(1).max(WORD_COUNT_MAX).nullish(),
  yearTag: z.string().trim().max(20).optional(),
  // Notes upload v2 (all optional; absent = keep the stored value).
  summary: z.string().trim().max(280).nullish(),
  subcategory: z.string().trim().max(40).nullish(),
  searchTags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
  contentLanguage: z.enum(CONTENT_LANGUAGES).nullish(),
  sourceFormats: z.array(z.string().trim().min(1).max(20)).max(12).optional(),
});

/**
 * Notes upload v2: the new listing columns, written only when the client
 * sent them, so older clients (and environments without the v2 migration)
 * keep saving exactly as before.
 */
export function v2ListingPatch(data: {
  summary?: string | null;
  subcategory?: string | null;
  searchTags?: string[];
  contentLanguage?: string | null;
  sourceFormats?: string[];
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (data.summary !== undefined) patch.summary = data.summary || null;
  if (data.subcategory !== undefined) patch.subcategory = data.subcategory || null;
  if (data.searchTags !== undefined) {
    patch.search_tags = Array.from(new Set(data.searchTags.map((t) => t.trim()).filter(Boolean)));
  }
  if (data.contentLanguage !== undefined) patch.content_language = data.contentLanguage || null;
  if (data.sourceFormats !== undefined) patch.source_formats = data.sourceFormats;
  return patch;
}

function assertValidSubcategory(curriculum: string | null | undefined, value?: string | null) {
  if (value && !isValidSubcategory(curriculum, value)) {
    throw new Error("Pick a category from the list for this curriculum.");
  }
}

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
  wordCount: number | null;
  // Notes upload v2 (null when the v2 migration is not applied yet).
  description: string | null;
  summary: string | null;
  subcategory: string | null;
  searchTags: string[];
  contentLanguage: string | null;
  previewPageIndices: number[] | null;
  pageCount: number | null;
  yearTag: string | null;
  slug: string | null;
};

export async function myTutorRow(
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
  summary?: string;
  searchTags?: string[];
}) {
  const labels: Record<string, string> = {
    title: "Title",
    description: "Description",
    summary: "Summary",
    topic: "Topic",
    gradeAchieved: "Grade achieved",
    searchTags: "Tags",
  };
  for (const [field, value] of Object.entries(fields)) {
    const texts =
      field === "searchTags" ? (Array.isArray(value) ? value : []) : [value as string | undefined];
    for (const text of texts) {
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
}

/** Owner-only load that works for every status (drafts included). */
export async function loadOwnedMaterial(
  db: AdminDb,
  materialId: string,
  tutorId: string,
): Promise<MaterialRow> {
  const { data, error } = await db
    .from<MaterialRow>("digital_materials")
    .select(
      "id, tutor_id, title, slug, status, price_hkd, original_file_path, watermarked_preview_url, pending_original_file_path, edit_status, curriculum_tag, subject_tag, material_type, topic, grade_achieved, exemplar_permission",
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
 * Shared file staging used by uploadNotePdf, submitNoteForReview and
 * editLiveNote. Server functions cannot call each other's fetchers
 * server-side, so the pipeline lives in this plain helper instead.
 * Returns whether the file was staged as a pending edit (live doc) or
 * attached directly (draft).
 *
 * #314: PDFs ride the watermark pipeline; an .apkg deck (flashcards only)
 * skips it entirely, no encryption probe, no stamping, no preview URL and
 * no page count (watermarked_preview_url stays "", page_count null). The
 * buyer downloads the deck; there is no in-browser reviewer or player.
 */
async function stageFileForMaterial(
  db: AdminDb,
  tutor: { id: string; display_name: string },
  material: MaterialRow,
  fileName: string,
  base64Data: string,
): Promise<{ staged: boolean }> {
  return stageFileBytesForMaterial(db, tutor, material, fileName, base64ToBytes(base64Data));
}

/**
 * Notes upload v2: the byte-level pipeline behind stageFileForMaterial.
 * `storedPath` = the browser already uploaded the original straight into
 * the private bucket through a signed upload URL (large files never pass
 * through the Worker body), so only the preview is generated here.
 * `previewPageIndices` = the seller's page pick (sanitized; never the whole
 * document). Undefined keeps the legacy "first ~30%" behaviour and does not
 * touch the v2 preview_page_indices column.
 */
export async function stageFileBytesForMaterial(
  db: AdminDb,
  tutor: { id: string; display_name: string },
  material: MaterialRow,
  fileName: string,
  bytes: Uint8Array,
  options: { storedPath?: string; previewPageIndices?: number[] | null } = {},
): Promise<{ staged: boolean; pageCount: number | null; previewPages: number | null }> {
  const kind = materialFileKind(fileName);
  if (!kind || !isAllowedMaterialFile(material.material_type, fileName)) {
    throw new Error(
      material.material_type === "flashcards"
        ? "Flashcards need a PDF or an .apkg file."
        : "This listing type needs a PDF file.",
    );
  }
  const isApkg = kind === "apkg";
  const isLiveDoc = material.status === "published" || material.status === "hidden";
  // Live docs skip preview generation until approval, the staged file is
  // not public, and stamping the wrong version onto the live preview URL
  // would leak the replacement before staff sign it off.
  const preview =
    isLiveDoc || isApkg ? null : await buildExtendedPreview(bytes, options.previewPageIndices);

  const path = options.storedPath ?? buildMaterialStorageName(fileName, tutor.display_name);
  if (!options.storedPath) {
    const { error } = await db.storage
      .from(PRIVATE_BUCKET)
      .upload(path, bytes as unknown as BlobPart, { contentType: materialFileContentType(kind) });
    if (error) throw new Error(error.message);
  }
  // GLM review fix (notes upload v2): a replaced file must not orphan the old
  // storage objects. Capture what this staging run overwrites so the old
  // original / pending original / watermarked preview can be removed
  // best-effort once the row update succeeds.
  const staleOriginal =
    material.original_file_path && material.original_file_path !== path
      ? material.original_file_path
      : null;
  const stalePending =
    material.pending_original_file_path && material.pending_original_file_path !== path
      ? material.pending_original_file_path
      : null;
  const previewMarker = `/${PUBLIC_BUCKET}/`;
  const stalePreviewPath = (material.watermarked_preview_url ?? "").includes(previewMarker)
    ? decodeURIComponent((material.watermarked_preview_url ?? "").split(previewMarker)[1] ?? "")
    : "";
  const pickColumn =
    options.previewPageIndices !== undefined && preview
      ? { preview_page_indices: preview.indices }
      : {};

  // The old watermarked preview is only orphaned in the branches that
  // actually overwrite/clear watermarked_preview_url — a live-doc staging
  // run keeps the live preview in place.
  let oldPreviewOrphaned = false;

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
        ...pickColumn,
      })
      .eq("id", material.id);
    if (updateError) {
      await db.storage.from(PRIVATE_BUCKET).remove([path]);
      throw new Error(updateError.message);
    }
    oldPreviewOrphaned = true;
  } else if (isLiveDoc) {
    const { error: updateError } = await db
      .from<never>("digital_materials")
      .update({ pending_original_file_path: path, edit_status: "pending_review" })
      .eq("id", material.id);
    if (updateError) {
      await db.storage.from(PRIVATE_BUCKET).remove([path]);
      throw new Error(updateError.message);
    }
  } else {
    // Draft attachment with no preview (an .apkg deck rides no watermark
    // pipeline): store the original and clear any stale preview fields so a
    // switched type never keeps a dead watermark URL behind it.
    const { error: updateError } = await db
      .from<never>("digital_materials")
      .update({
        original_file_path: path,
        watermarked_preview_url: "",
        preview_pages: null,
        page_count: null,
      })
      .eq("id", material.id);
    if (updateError) {
      await db.storage.from(PRIVATE_BUCKET).remove([path]);
      throw new Error(updateError.message);
    }
    oldPreviewOrphaned = true;
  }
  // Best-effort cleanup of the replaced objects (original + pending original
  // from the private bucket, old watermarked preview from the public one).
  // Runs only after a successful row update; failures never block staging.
  const stalePrivate = [staleOriginal, stalePending].filter(
    (p): p is string => Boolean(p) && p !== path,
  );
  if (stalePrivate.length > 0) {
    await db.storage
      .from(PRIVATE_BUCKET)
      .remove(stalePrivate)
      .catch(() => undefined);
  }
  if (oldPreviewOrphaned && stalePreviewPath && stalePreviewPath !== previewPathFor(path)) {
    await db.storage
      .from(PUBLIC_BUCKET)
      .remove([stalePreviewPath])
      .catch(() => undefined);
  }
  return {
    staged: isLiveDoc,
    pageCount: preview?.pageCount ?? null,
    previewPages: preview?.previewPages ?? null,
  };
}

/**
 * Validate the PDF and produce the extended watermarked preview (Ryan:
 * ~30% of pages, cap 12; first 3 render crisp on the note page, the rest
 * blur client-side). Returns everything the listing row needs.
 */
async function buildExtendedPreview(
  bytes: Uint8Array,
  pickedIndices?: number[] | null,
): Promise<{
  pageCount: number;
  previewPages: number;
  previewBytes: Uint8Array;
  indices: number[];
}> {
  const pageCount = await assertPdfNotEncrypted(bytes).catch(() => {
    throw new Error(UNLOCKED_FILE_ERROR);
  });
  // v2: seller-picked pages (or the default first ~30%), sanitized so the
  // preview never contains the whole document. Legacy callers (no pick)
  // keep the original extendedPreviewPageLimit behaviour.
  const indices =
    pickedIndices !== undefined
      ? sanitizePreviewIndices(pickedIndices, pageCount)
      : Array.from(
          { length: Math.min(pageCount, extendedPreviewPageLimit(pageCount)) },
          (_, i) => i,
        );
  const { bytes: previewBytes, pageCount: previewPages } = await watermarkPdfPreview(bytes, {
    pageLimit: indices.length,
    pageIndices: indices,
  });
  return { pageCount, previewPages, previewBytes, indices };
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
  .middleware([requireSupabaseAuth, requireAccountActive])
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
      searchTags: data.searchTags,
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

    // #313 review fix: merge with explicit-clear semantics, switching the
    // type away from exemplar (or clearing topic/grade) must actually write
    // the cleared values, not silently keep the stored ones.
    const kinds = mergeDraftNoteKinds(data, existing);
    assertValidSubcategory(kinds.curriculum, data.subcategory);
    assertCleanCopy({ summary: data.summary ?? undefined });

    if (existing) {
      const { error } = await db
        .from<never>("digital_materials")
        .update({
          ...v2ListingPatch(data),
          ...(data.title != null ? { title: data.title } : {}),
          ...(data.description != null ? { description: data.description } : {}),
          ...(data.priceHkd != null ? { price_hkd: data.priceHkd } : {}),
          curriculum_tag: kinds.curriculum,
          subject_tag: kinds.subject || null,
          material_type: kinds.materialType,
          topic: kinds.topic || null,
          grade_achieved: kinds.gradeAchieved,
          exemplar_permission: kinds.exemplarPermission,
          ...(data.wordCount !== undefined ? { word_count: data.wordCount } : {}),
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
        word_count: data.wordCount ?? null,
        year_tag: data.yearTag ?? null,
        ...v2ListingPatch(data),
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
 * (P9, the live file stays on sale until staff approve the swap).
 */
export const uploadNotePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        // #314: flashcards may carry an .apkg deck; the type-aware gate in
        // stageFileForMaterial rejects mismatches server-side.
        fileName: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .regex(/\.(pdf|apkg)$/i, "Only PDF or .apkg files are supported"),
        base64Data: z.string().trim().min(100).max(60_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const material = await loadOwnedMaterial(db, data.materialId, tutor.id);

    return stageFileForMaterial(db, tutor, material, data.fileName, data.base64Data);
  });

const SubmitForReviewInput = SubmitInput.extend({
  // Issue #214: the submit doubles as the notes-terms acceptance click, the
  // checkbox must arrive true (mirrors /legal/notes-terms), and the handler
  // records the terms_acceptances row (surface note_upload) on success.
  legalAgreed: z.literal(true),
});

/** P8 submit: validates required fields, then parks the note for staff review. */
export const submitNoteForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
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
      searchTags: data.searchTags,
    });

    const existing = data.materialId
      ? await loadOwnedMaterial(db, data.materialId, tutor.id)
      : null;
    // #313 review fix: explicit-clear semantics, a null/empty grade or
    // topic clears the stored value, and a non-exemplar type drops the
    // stale grade/permission instead of letting them fail validation.
    // #340: curriculum/subject are remapped inside mergeDraftNoteKinds.
    const kinds = mergeDraftNoteKinds(data, existing);
    assertValidSubcategory(kinds.curriculum, data.subcategory);
    assertCleanCopy({ summary: data.summary ?? undefined });
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
    // #314: HK$0 is valid, the old MIN_PRICE_HKD floor is gone; the zod
    // input already rejects negative prices, and checkSubmitReadiness above
    // blocks null/negative merges.

    // #314: file type must match the listing type, an .apkg deck only
    // rides a flashcards listing; everything else stays PDF-only.
    if (data.base64Data && !isAllowedMaterialFile(kinds.materialType, data.fileName ?? "")) {
      throw new Error(
        kinds.materialType === "flashcards"
          ? "Flashcards need a PDF or an .apkg file."
          : "This listing type needs a PDF file.",
      );
    }
    const fileKind = data.base64Data ? materialFileKind(data.fileName ?? "") : null;
    const isApkgUpload = fileKind === "apkg";

    let materialId: string;
    if (!existing) {
      // First submission doubles as draft creation: validate (+ watermark
      // for PDFs), upload, then insert straight into pending_review.
      if (!data.base64Data) throw new Error("Missing: pdf");
      const bytes = base64ToBytes(data.base64Data);
      // #314: an .apkg deck skips the PDF-only pipeline entirely, no
      // encryption probe, no pdf-lib watermark, no page count and no
      // preview URL. The buyer downloads the deck from their account.
      const preview = isApkgUpload ? null : await buildExtendedPreview(bytes);
      materialId = crypto.randomUUID();
      const originalPath = buildMaterialStorageName(
        data.fileName || "note.pdf",
        tutor.display_name,
      );
      const { error } = await db.storage
        .from(PRIVATE_BUCKET)
        .upload(originalPath, bytes as unknown as BlobPart, {
          contentType: isApkgUpload
            ? materialFileContentType("apkg")
            : materialFileContentType("pdf"),
        });
      if (error) throw new Error(error.message);

      let previewUrl = "";
      let previewPages: number | null = null;
      if (preview) {
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
        previewUrl = url?.publicUrl ?? "";
        previewPages = preview.previewPages;
      }

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
        word_count: data.wordCount ?? null,
        year_tag: data.yearTag ?? null,
        ...v2ListingPatch(data),
        status: "pending_review",
        submitted_at: new Date().toISOString(),
        slug,
        original_file_path: originalPath,
        // .apkg: watermarked_preview_url stays "" and page_count stays null.
        watermarked_preview_url: previewUrl,
        preview_pages: previewPages,
        page_count: preview ? preview.pageCount : null,
      });
      if (insertError) {
        await db.storage.from(PRIVATE_BUCKET).remove([originalPath]);
        throw new Error(insertError.message);
      }
    } else {
      materialId = existing.id;
      if (data.base64Data) {
        await stageFileForMaterial(
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
          ...(data.wordCount !== undefined ? { word_count: data.wordCount } : {}),
          ...(data.yearTag != null ? { year_tag: data.yearTag } : {}),
          ...v2ListingPatch(data),
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

    // Issue #214: the note-upload terms gate, record WHICH terms version the
    // tutor accepted, tied to this material (subject_id), after the submit
    // went through. Fail-closed: an insert failure fails the whole submit.
    const { recordTermsAcceptance } = await import("@/features/legal/terms-acceptance.server");
    await recordTermsAcceptance({
      userId: context.userId,
      surface: "note_upload",
      subjectId: materialId,
    });

    return { materialId };
  });

/** P9: edit a live note's text/price, live after the contact filter. */
export const editLiveNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => EditLiveInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const material = await loadOwnedMaterial(db, data.materialId, tutor.id);
    assertCleanCopy({
      title: data.title,
      description: data.description,
      summary: data.summary ?? undefined,
      searchTags: data.searchTags,
    });
    assertValidSubcategory(material.curriculum_tag, data.subcategory);

    if (data.base64Data) {
      await stageFileForMaterial(db, tutor, material, data.fileName || "note.pdf", data.base64Data);
    }

    const { error } = await db
      .from<never>("digital_materials")
      .update({
        ...(data.title != null ? { title: data.title } : {}),
        ...(data.description != null ? { description: data.description } : {}),
        ...(data.priceHkd != null ? { price_hkd: data.priceHkd } : {}),
        ...(data.yearTag != null ? { year_tag: data.yearTag } : {}),
        ...v2ListingPatch(data),
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

    const baseColumns =
      "id, title, status, price_hkd, rejection_reason, edit_status, edit_rejection_reason, view_count, sold_count, watermarked_preview_url, updated_at, curriculum_tag, subject_tag, material_type, topic, grade_achieved, exemplar_permission, word_count, description, page_count, year_tag, slug";
    const v2Columns = "summary, subcategory, search_tags, content_language, preview_page_indices";
    const run = (columns: string) =>
      db
        .from<Record<string, unknown>>("digital_materials")
        .select(columns)
        .eq("tutor_id", tutor.id)
        .order("updated_at", { ascending: false });
    // Notes upload v2: fall back to the pre-v2 column list when the v2
    // migration is not applied yet (42703 = undefined column).
    let result = await run(`${baseColumns}, ${v2Columns}`);
    if (result.error?.code === "42703") result = await run(baseColumns);
    const { data, error } = result;
    if (error) throw new Error(error.message);
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    return (data ?? []).map((row) => ({
      id: String(row.id),
      title: str(row.title) || "Untitled note",
      status: (str(row.status) as MaterialStatus | null) ?? "draft",
      priceHkd: Number(row.price_hkd ?? 0),
      rejectionReason: str(row.rejection_reason),
      editStatus: str(row.edit_status),
      editRejectionReason: str(row.edit_rejection_reason),
      viewCount: Number(row.view_count ?? 0),
      soldCount: Number(row.sold_count ?? 0),
      previewUrl: str(row.watermarked_preview_url) ?? "",
      updatedAt: str(row.updated_at) ?? "",
      curriculumTag: str(row.curriculum_tag) ?? "",
      subjectTag: str(row.subject_tag),
      materialType: (str(row.material_type) as MaterialType | null) ?? "notes",
      topic: str(row.topic),
      gradeAchieved: str(row.grade_achieved),
      exemplarPermission: row.exemplar_permission === true,
      wordCount: typeof row.word_count === "number" ? row.word_count : null,
      description: str(row.description),
      summary: str(row.summary),
      subcategory: str(row.subcategory),
      searchTags: Array.isArray(row.search_tags)
        ? row.search_tags.filter((t): t is string => typeof t === "string")
        : [],
      contentLanguage: str(row.content_language),
      previewPageIndices: Array.isArray(row.preview_page_indices)
        ? row.preview_page_indices.filter((n): n is number => typeof n === "number")
        : null,
      pageCount: typeof row.page_count === "number" ? row.page_count : null,
      yearTag: str(row.year_tag),
      slug: str(row.slug),
    }));
  });
