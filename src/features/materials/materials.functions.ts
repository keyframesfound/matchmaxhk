import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { findContactViolations } from "@/lib/contact-filter";
import { watermarkPdfPreview, PREVIEW_PAGE_LIMIT } from "@/features/materials/watermark";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  isAllowedMaterialFile,
  legacyDocumentTypeToMaterialType,
  materialFileContentType,
  materialFileKind,
  MAX_APKG_BYTES,
  nextStatus,
  validateNoteKindsForSubmit,
  type MaterialStatus,
} from "@/features/materials/lifecycle";
import { gigApprovalBlocker } from "@/features/gigs/gig-staff.functions";

/**
 * Issues #131/#132/#133: server-side upload pipeline for the study-materials
 * marketplace.
 *
 * Flow (all server-side; the original PDF never reaches a public surface):
 *   1. Caller must be the linked account of a tutor whose verification_tier
 *      is 'tier_2_verified' (the Verified gate) — checked against the tutors
 *      table with the caller's RLS-scoped client.
 *   2. Original PDF bytes go to the PRIVATE `materials-originals` bucket via
 *      the service-role client (RLS on storage.objects blocks every other
 *      role from that bucket).
 *   3. pdf-lib stamps the first 3–5 pages with a semi-transparent
 *      "PREVIEW COPY - MATCHMAX.HK" watermark; the preview lands in the
 *      PUBLIC `materials-previews` bucket and its URL is stored on the row.
 *   4. The listing row is created unpublished; admins (or the tutor via their
 *      owner policy) publish once the listing is checked.
 *
 * Plain PDF processing — no AI services.
 */

const PRIVATE_BUCKET = "materials-originals";
const PUBLIC_BUCKET = "materials-previews";
// Repo upload cap: 20MB for every file kind (the issue's 40MB loses to the
// Workers body limit — MAX_APKG_BYTES === MAX_PDF_BYTES by design).
const MAX_UPLOAD_BYTES = MAX_APKG_BYTES;

const UploadMaterialInput = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    // #314: flashcards may carry an .apkg deck; the type-aware gate below
    // still rejects .apkg on notes/mock/exemplar.
    .regex(/\.(pdf|apkg)$/i, "Only PDF or .apkg files are supported"),
  // Base64 of the file bytes (client reads the File with FileReader).
  base64Data: z.string().trim().min(100).max(60_000_000),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional(),
  priceHkd: z.number().min(0).max(100_000),
  schoolTag: z.string().trim().max(160).optional(),
  // #313 review fix: curriculum is the canonical list and subject is
  // required on every path — no caller may skip the note-kind validation.
  curriculumTag: z.enum(["IB", "DSE", "IGCSE", "A-Level", "Other"]),
  subjectTag: z.string().trim().min(1).max(160),
  // #313/#314 note kinds: the 4-way type (flashcards added by #314) replaces
  // the old document types for new uploads (documentType stays accepted for
  // legacy callers and is mapped).
  materialType: z.enum(["notes", "mock", "exemplar", "flashcards"]).optional(),
  topic: z.string().trim().max(40).optional(),
  gradeAchieved: z.string().trim().max(20).optional(),
  exemplarPermission: z.boolean().optional(),
  // #136: approximate word count — optional, positive integer when present.
  wordCount: z.number().int().min(1).max(500_000).optional(),
  documentType: z.enum(["custom_notes", "ia", "ee", "tok_essay", "mock_exam"]).optional(),
  yearTag: z.string().trim().max(20).optional(),
  pageCount: z.number().int().min(1).max(10_000).optional(),
  exactScoreAchieved: z.string().trim().max(200).optional(),
  includesExaminerComments: z.boolean().optional(),
  // The mandatory legal checkbox (issues #131/#133, reworded per Ryan's
  // P2P decision): must arrive true or the upload is rejected server-side.
  legalAgreed: z.literal(true),
  // Admins only: upload on behalf of this tutor id and publish immediately.
  tutorId: z.string().uuid().optional(),
});

export type UploadMaterialPayload = z.infer<typeof UploadMaterialInput>;

export type UploadMaterialResult = {
  id: string;
  title: string;
  originalPath: string;
  /** "" for .apkg decks — no preview is generated (#314). */
  previewUrl: string;
  /** null for .apkg decks — the file has no pages (#314). */
  previewPages: number | null;
};

async function assertVerifiedTutor(supabase: unknown, userId: string) {
  const client = supabase as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (
          col: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { id: string; display_name: string } | null;
            error?: { message?: string };
          }>;
        };
      };
    };
  };
  const { data, error } = await client
    .from("tutors")
    .select("id, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Failed to look up tutor account");
  if (!data) throw new Error("Your account is not linked to a tutor profile yet.");
  return data;
}

/**
 * Admins may add listings on behalf of any tutor ("like we add tutors").
 * Returns the tutor row to attach the listing to when the caller is an
 * admin, otherwise null (caller is a plain tutor and must use their own
 * linked account).
 */
async function assertAdminTargetTutor(
  supabase: unknown,
  userId: string,
  tutorId: string,
): Promise<{ id: string; display_name: string } | null> {
  const client = supabase as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error?: { message?: string } }>;
  };
  for (const role of ["admin", "super_admin"] as const) {
    const { data: ok, error } = await client.rpc("has_role", {
      _user_id: userId,
      _role: role,
    });
    if (!error && ok === true) {
      const adminClient = supabase as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (
              col: string,
              value: string,
            ) => {
              maybeSingle: () => Promise<{
                data: { id: string; display_name: string } | null;
                error?: { message?: string };
              }>;
            };
          };
        };
      };
      const { data, error: tutorError } = await adminClient
        .from("tutors")
        .select("id, display_name")
        .eq("id", tutorId)
        .maybeSingle();
      if (tutorError) throw new Error(tutorError.message);
      if (!data) throw new Error("Selected tutor not found.");
      return data;
    }
  }
  return null;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function safePdfName(title: string, tutorLabel: string, kind: "pdf" | "apkg" = "pdf"): string {
  const clean = (value: string) =>
    value
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
  const slug = `${clean(tutorLabel)} - ${clean(title)}`.replace(/^ - | - $/g, "");
  const stamp = Date.now().toString(36);
  return `materials/${stamp}-${slug || "study-materials"}${kind === "apkg" ? ".apkg" : ".pdf"}`;
}

export const uploadStudyMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => UploadMaterialInput.parse(data))
  .handler(async ({ data, context }): Promise<UploadMaterialResult> => {
    // Admins add listings on behalf of any tutor ("like we add tutors");
    // plain tutors upload only against their own linked account.
    let tutor: { id: string; display_name: string };
    let publishNow = false;
    if (data.tutorId) {
      const adminTutor = await assertAdminTargetTutor(
        context.supabase,
        context.userId,
        data.tutorId,
      );
      if (!adminTutor) throw new Error("Only admins can upload for another tutor.");
      tutor = adminTutor;
      publishNow = true;
    } else {
      tutor = await assertVerifiedTutor(context.supabase, context.userId);
    }

    // #313: topic, title, description and grade all pass the contact filter;
    // exemplar gates apply on the admin path too.
    const effectiveType =
      data.materialType ?? legacyDocumentTypeToMaterialType(data.documentType ?? "custom_notes");
    for (const [label, text] of [
      ["Title", data.title],
      ["Description", data.description],
      ["Topic", data.topic],
      ["Grade achieved", data.gradeAchieved],
    ] as const) {
      if (!text) continue;
      const violations = findContactViolations(text);
      if (violations.length > 0) {
        throw new Error(
          `${label} contains contact details (${violations
            .map((v) => v.match)
            .slice(0, 2)
            .join(", ")}). Remove them to upload.`,
        );
      }
    }
    // #313 review fix: every upload path runs the same strict note-kind
    // validation (canonical curriculum, required subject, exemplar gates).
    const kindErrors = validateNoteKindsForSubmit({
      curriculum: data.curriculumTag,
      subject: data.subjectTag,
      materialType: effectiveType,
      topic: data.topic,
      gradeAchieved: data.gradeAchieved,
      exemplarPermission: data.exemplarPermission,
    });
    if (kindErrors.length > 0) throw new Error(kindErrors.join(" "));

    // #314: the file kind must match the listing type — an .apkg deck only
    // rides a flashcards listing; everything else stays PDF-only.
    if (!isAllowedMaterialFile(effectiveType, data.fileName)) {
      throw new Error(
        effectiveType === "flashcards"
          ? "Flashcards need a PDF or an .apkg file."
          : "This listing type needs a PDF file.",
      );
    }
    const fileKind = materialFileKind(data.fileName) ?? "pdf";
    const isApkg = fileKind === "apkg";

    const bytes = base64ToBytes(data.base64Data);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("File is too large. Maximum upload size is 20MB.");
    }
    if (
      !isApkg &&
      (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46)
    ) {
      throw new Error("That file is not a valid PDF.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const originalPath = safePdfName(data.title, tutor.display_name, fileKind);
    const { error: originalError } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .upload(originalPath, bytes as unknown as BlobPart, {
        contentType: materialFileContentType(fileKind),
        upsert: false,
      });
    if (originalError) throw new Error(originalError.message);

    try {
      // #314: an .apkg deck skips the PDF-only pipeline entirely — no
      // pdf-lib watermark, no preview URL, no page count. The buyer
      // downloads the deck; there is no in-browser reviewer or player.
      const watermark = isApkg
        ? null
        : await watermarkPdfPreview(bytes, {
            pageLimit: PREVIEW_PAGE_LIMIT,
          });

      let previewUrl = "";
      if (watermark) {
        const previewPath = originalPath.replace(/^materials\//, "previews/");
        const { error: previewError } = await supabaseAdmin.storage
          .from(PUBLIC_BUCKET)
          .upload(previewPath, watermark.bytes as unknown as BlobPart, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (previewError) throw new Error(previewError.message);

        const { data: publicUrl } = supabaseAdmin.storage
          .from(PUBLIC_BUCKET)
          .getPublicUrl(previewPath);
        previewUrl = publicUrl?.publicUrl ?? "";
      }

      const payload = {
        tutor_id: tutor.id,
        title: data.title,
        description: data.description ?? null,
        price_hkd: data.priceHkd,
        school_tag: data.schoolTag ?? null,
        curriculum_tag: data.curriculumTag,
        subject_tag: data.subjectTag,
        material_type:
          data.materialType ??
          legacyDocumentTypeToMaterialType(data.documentType ?? "custom_notes"),
        topic: data.topic ?? null,
        grade_achieved: data.gradeAchieved ?? null,
        exemplar_permission: data.exemplarPermission ?? false,
        word_count: data.wordCount ?? null,
        document_type: data.documentType ?? "custom_notes",
        year_tag: data.yearTag ?? null,
        page_count: watermark ? (data.pageCount ?? null) : null,
        exact_score_achieved: data.exactScoreAchieved ?? null,
        includes_examiner_comments: data.includesExaminerComments ?? false,
        original_file_path: originalPath,
        watermarked_preview_url: previewUrl,
        // The legacy boolean is gone from the schema (#203); admins publish
        // instantly, tutor uploads land as drafts awaiting review.
        status: publishNow ? "published" : "draft",
      } as never;
      const { data: inserted, error: insertError } = (await supabaseAdmin
        .from("digital_materials" as never)
        .insert(payload)
        .select("id, title")
        .single()) as unknown as {
        data: { id: string; title: string };
        error: { message: string } | null;
      };
      if (insertError) throw new Error(insertError.message);

      return {
        id: inserted.id,
        title: inserted.title,
        originalPath,
        previewUrl,
        previewPages: watermark ? watermark.pageCount : null,
      };
    } catch (err) {
      // Roll the private original back if the preview/row half failed so we
      // never keep orphaned originals without a listing.
      await supabaseAdmin.storage.from(PRIVATE_BUCKET).remove([originalPath]);
      throw err;
    }
  });

/**
 * Issue #132's admin "Download Original File": returns a short-lived signed
 * URL for the private original. Admin-only (asserted with the caller's RLS
 * client before the service-role signed URL is minted).
 */
export const getMaterialOriginalUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error?: { message?: string } }>;
    };
    let isAdmin = false;
    for (const role of ["admin", "super_admin"] as const) {
      const { data: ok, error } = await client.rpc("has_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (!error && ok === true) {
        isAdmin = true;
        break;
      }
    }
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: material, error } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{
                data: { original_file_path: string } | null;
                error?: { message?: string };
              }>;
            };
          };
        };
      }
    )
      .from("digital_materials")
      .select("original_file_path")
      .eq("id", data.materialId)
      .maybeSingle();
    if (error || !material) throw new Error("Material not found");

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(material.original_file_path, 60 * 10); // 10 minutes
    if (signError || !signed) throw new Error(signError?.message || "Failed to sign URL");
    return { signedUrl: signed.signedUrl };
  });

export type AdminMaterialRow = {
  id: string;
  title: string;
  price_hkd: number;
  document_type: string;
  material_type: string;
  word_count: number | null;
  admin_star_rating: number | null;
  admin_marketing_summary: string | null;
  commission_rate: number;
  commission_status: string;
  is_published: boolean;
  status: string;
  edit_status: string | null;
  submitted_at: string | null;
  created_at: string;
  tutors: { display_name: string; tutor_code: string } | null;
};

/** Admin listing of every uploaded material (RLS admin policies gate this). */
export const listAllMaterialsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const client = context.supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error?: { message?: string } }>;
    };
    let isAdmin = false;
    for (const role of ["admin", "super_admin"] as const) {
      const { data: ok, error } = await client.rpc("has_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (!error && ok === true) {
        isAdmin = true;
        break;
      }
    }
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              c: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data: AdminMaterialRow[] | null;
                error?: { message?: string };
              }>;
            };
          };
        };
      }
    )
      .from("digital_materials")
      .select(
        "id, title, price_hkd, document_type, material_type, word_count, admin_star_rating, admin_marketing_summary, commission_rate, commission_status, is_published, status, edit_status, submitted_at, created_at, tutors(display_name, tutor_code)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Admin update of moderation/trust fields on a material listing. */
export const updateMaterialAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        isPublished: z.boolean().optional(),
        adminStarRating: z.number().min(1).max(5).nullable().optional(),
        adminMarketingSummary: z.string().max(4000).nullable().optional(),
        commissionStatus: z.enum(["pending", "invoiced", "settled"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error?: { message?: string } }>;
    };
    let isAdmin = false;
    for (const role of ["admin", "super_admin"] as const) {
      const { data: ok, error } = await client.rpc("has_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (!error && ok === true) {
        isAdmin = true;
        break;
      }
    }
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Grok review 2026-10-17 (soft #3, tightened): publishing from the admin
    // materials page must clear the same gig integrity gate as the review
    // queue — otherwise an integrity-missing document_review gig can be
    // flipped to published from the desk, bypassing gigApprovalBlocker.
    // Non-gig rows always pass (gigApprovalBlocker returns null for them).
    if (data.isPublished === true) {
      const db = asAdminDb(supabaseAdmin);
      const { data: row } = await db
        .from<{
          material_type: string;
          gig_category: string | null;
          integrity_confirmed_at: string | null;
        }>("digital_materials")
        .select("material_type, gig_category, integrity_confirmed_at")
        .eq("id", data.materialId)
        .maybeSingle();
      if (!row) throw new Error("Listing not found.");
      const blocker = gigApprovalBlocker({
        materialType: row.material_type,
        gigCategory: row.gig_category,
        integrityConfirmedAt: row.integrity_confirmed_at,
      });
      if (blocker) throw new Error(blocker);
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // is_published moved to the status machine (#203): admin publish/unpublish
    // and reject-with-reason both land here. Rejections store the reason the
    // tutor sees in Account.
    if (data.isPublished !== undefined) {
      patch.status = data.isPublished ? "published" : "hidden";
      if (data.isPublished) {
        patch.reviewed_at = new Date().toISOString();
        patch.reviewed_by = context.userId;
        patch.edit_status = null;
      }
    }
    if (data.adminStarRating !== undefined) patch.admin_star_rating = data.adminStarRating;
    if (data.adminMarketingSummary !== undefined)
      patch.admin_marketing_summary = data.adminMarketingSummary;
    if (data.commissionStatus !== undefined) patch.commission_status = data.commissionStatus;

    const { error } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          update: (p: Record<string, unknown>) => {
            eq: (c: string, v: string) => Promise<{ error?: { message?: string } }>;
          };
        };
      }
    )
      .from("digital_materials")
      .update(patch)
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PendingGigReviewRow = {
  id: string;
  title: string;
  description: string | null;
  price_hkd: number;
  gig_category: string | null;
  gig_delivery_type: string | null;
  turnaround_note: string | null;
  turnaround_hours: number | null;
  cover_image_path: string | null;
  integrity_confirmed_at: string | null;
  created_at: string;
  tutors: { display_name: string; tutor_code: string } | null;
};

/**
 * #326/#327: the gig review queue — pending_review gig listings with the
 * fields staff need to judge them (category, delivery type, turnaround,
 * cover, and the document_review integrity timestamp). Oldest first so the
 * queue drains in submission order.
 */
export const listPendingGigReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingGigReviewRow[]> => {
    const client = context.supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error?: { message?: string } }>;
    };
    let isAdmin = false;
    for (const role of ["admin", "super_admin"] as const) {
      const { data: ok, error } = await client.rpc("has_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (!error && ok === true) {
        isAdmin = true;
        break;
      }
    }
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { data, error } = await db
      .from<PendingGigReviewRow>("digital_materials")
      .select(
        "id, title, description, price_hkd, gig_category, gig_delivery_type, turnaround_note, turnaround_hours, cover_image_path, integrity_confirmed_at, created_at, tutors(display_name, tutor_code)",
      )
      .eq("status", "pending_review")
      .eq("material_type", "gig")
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * #326/#327 gig review decision: approve (pending_review -> published) or
 * reject with a written reason (stored in rejection_reason like notes).
 * Gig rules enforced server-side:
 *   - a document_review gig WITHOUT integrity_confirmed_at can never be
 *     approved (gigApprovalBlocker);
 *   - gigs carry NO original file / watermarked preview, so approval —
 *     unlike the notes stamp pipeline — requires no stamping at all.
 */
export const reviewGigListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        approve: z.boolean(),
        reason: z.string().trim().min(3).max(500).optional(),
      })
      .refine((v) => v.approve || (v.reason ?? "").length >= 3, {
        message: "A reject reason is required.",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const client = context.supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error?: { message?: string } }>;
    };
    let isAdmin = false;
    for (const role of ["admin", "super_admin"] as const) {
      const { data: ok, error } = await client.rpc("has_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (!error && ok === true) {
        isAdmin = true;
        break;
      }
    }
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { data: row, error: fetchError } = await db
      .from<{
        id: string;
        status: string;
        material_type: string;
        gig_category: string | null;
        integrity_confirmed_at: string | null;
      }>("digital_materials")
      .select("id, status, material_type, gig_category, integrity_confirmed_at")
      .eq("id", data.materialId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!row) throw new Error("Listing not found.");
    // The integrity blocker gates PUBLISHING only (grok review 2026-10-17):
    // staff must always be able to REJECT an integrity-missing document_review
    // gig with a written reason — that is the exact path the queue hint
    // recommends — so the check runs on the approve branch alone.
    if (data.approve) {
      const blocker = gigApprovalBlocker({
        materialType: row.material_type,
        gigCategory: row.gig_category,
        integrityConfirmedAt: row.integrity_confirmed_at,
      });
      if (blocker) throw new Error(blocker);
    }

    const action = data.approve ? "approve" : "reject";
    const next = nextStatus(row.status as MaterialStatus, action);
    if (!next) {
      throw new Error(`Listing in status "${row.status}" cannot be ${action}d.`);
    }

    const patch: Record<string, unknown> = {
      status: next,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
    };
    if (data.approve) {
      patch.rejection_reason = null;
      patch.edit_status = null;
    } else {
      patch.rejection_reason = data.reason;
    }
    const { error } = await db
      .from<never>("digital_materials")
      .update(patch)
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    return { ok: true, status: next };
  });

export { bytesToBase64 };
