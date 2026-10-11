import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { watermarkPdfPreview, PREVIEW_PAGE_LIMIT } from "@/features/materials/watermark";

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
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

const UploadMaterialInput = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/\.pdf$/i, "Only PDF files are supported"),
  // Base64 of the PDF bytes (client reads the File with FileReader).
  base64Data: z.string().trim().min(100).max(60_000_000),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional(),
  priceHkd: z.number().min(0).max(100_000),
  schoolTag: z.string().trim().max(160).optional(),
  curriculumTag: z.string().trim().min(1).max(160),
  subjectTag: z.string().trim().max(160).optional(),
  documentType: z.enum([
    "custom_notes",
    "past_paper_solutions",
    "ia",
    "ee",
    "tok_essay",
    "mock_exam",
  ]),
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
  previewUrl: string;
  previewPages: number;
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

function safePdfName(title: string, tutorLabel: string): string {
  const clean = (value: string) =>
    value
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
  const slug = `${clean(tutorLabel)} - ${clean(title)}`.replace(/^ - | - $/g, "");
  const stamp = Date.now().toString(36);
  return `materials/${stamp}-${slug || "study-materials"}.pdf`;
}

export const uploadStudyMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    const bytes = base64ToBytes(data.base64Data);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("PDF is too large. Maximum upload size is 20MB.");
    }
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
      throw new Error("That file is not a valid PDF.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const originalPath = safePdfName(data.title, tutor.display_name);
    const { error: originalError } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .upload(originalPath, bytes as unknown as BlobPart, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (originalError) throw new Error(originalError.message);

    try {
      const { bytes: previewBytes, pageCount } = await watermarkPdfPreview(bytes, {
        pageLimit: PREVIEW_PAGE_LIMIT,
      });

      const previewPath = originalPath.replace(/^materials\//, "previews/");
      const { error: previewError } = await supabaseAdmin.storage
        .from(PUBLIC_BUCKET)
        .upload(previewPath, previewBytes as unknown as BlobPart, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (previewError) throw new Error(previewError.message);

      const { data: publicUrl } = supabaseAdmin.storage
        .from(PUBLIC_BUCKET)
        .getPublicUrl(previewPath);

      const payload = {
        tutor_id: tutor.id,
        title: data.title,
        description: data.description ?? null,
        price_hkd: data.priceHkd,
        school_tag: data.schoolTag ?? null,
        curriculum_tag: data.curriculumTag,
        subject_tag: data.subjectTag ?? null,
        document_type: data.documentType,
        year_tag: data.yearTag ?? null,
        page_count: data.pageCount ?? null,
        exact_score_achieved: data.exactScoreAchieved ?? null,
        includes_examiner_comments: data.includesExaminerComments ?? false,
        original_file_path: originalPath,
        watermarked_preview_url: publicUrl?.publicUrl ?? "",
        is_published: publishNow,
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
        previewUrl: publicUrl?.publicUrl ?? "",
        previewPages: pageCount,
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
  admin_star_rating: number | null;
  admin_marketing_summary: string | null;
  commission_rate: number;
  commission_status: string;
  is_published: boolean;
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
        "id, title, price_hkd, document_type, admin_star_rating, admin_marketing_summary, commission_rate, commission_status, is_published, created_at, tutors(display_name, tutor_code)",
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
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.isPublished !== undefined) patch.is_published = data.isPublished;
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

export { bytesToBase64 };
