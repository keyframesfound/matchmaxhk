import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { buildBuyWhatsAppUrl, buildBookLessonsWhatsAppUrl } from "@/features/materials/whatsapp";

/**
 * #203 + P8/P9/P13/P14: PUBLIC note-page reads. Server-side (service role)
 * with explicit whitelists — the public surface must never leak staff
 * columns (reviewed_by, rejection reasons) or private paths, so this mirrors
 * the PUBLIC_CASE_COLUMNS pattern from the case board instead of relying on
 * RLS column visibility.
 */

export const PUBLIC_NOTE_COLUMNS =
  "id, slug, title, description, price_hkd, school_tag, curriculum_tag, subject_tag, document_type, year_tag, page_count, preview_pages, exact_score_achieved, includes_examiner_comments, watermarked_preview_url, admin_star_rating, promotional_note, view_count, sold_count, created_at, tutor_id";

/**
 * Public readers run under the SERVICE ROLE (RLS does not apply), so the
 * tutor publish gate the RLS policy would enforce
 * (material status='published' AND tutors.is_published=true) is repeated
 * here explicitly on every public query.
 */
const PUBLIC_NOTE_TUTOR_JOIN = "tutors!inner(display_name, tutor_code, user_id, is_published)";

export type PublicNote = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  priceHkd: number;
  schoolTag: string | null;
  curriculumTag: string;
  subjectTag: string | null;
  documentType: string;
  yearTag: string | null;
  pageCount: number | null;
  previewPages: number | null;
  exactScoreAchieved: string | null;
  includesExaminerComments: boolean;
  previewUrl: string;
  adminStarRating: number | null;
  promotionalNote: string | null;
  viewCount: number;
  soldCount: number;
  createdAt: string;
  tutorId: string;
  /** The tutor's AUTH account id (tutors.user_id) — lets the page hide
   * owner affordances (view counting, buy, report) correctly. */
  tutorUserId: string;
  tutorName: string;
  tutorCode: string;
};

type NoteRow = Record<string, unknown> & {
  tutors?: { display_name?: unknown; tutor_code?: unknown; user_id?: unknown } | null;
};

function mapPublicNote(row: NoteRow): PublicNote | null {
  const id = typeof row.id === "string" ? row.id : "";
  const tutor = row.tutors ?? null;
  const tutorCode = typeof tutor?.tutor_code === "string" ? tutor.tutor_code : "";
  if (!id || !tutorCode) return null;
  return {
    id,
    slug: typeof row.slug === "string" ? row.slug : null,
    title: typeof row.title === "string" ? row.title : "",
    description: typeof row.description === "string" ? row.description : null,
    priceHkd: Number(row.price_hkd ?? 0),
    schoolTag: typeof row.school_tag === "string" ? row.school_tag : null,
    curriculumTag: typeof row.curriculum_tag === "string" ? row.curriculum_tag : "",
    subjectTag: typeof row.subject_tag === "string" ? row.subject_tag : null,
    documentType: typeof row.document_type === "string" ? row.document_type : "custom_notes",
    yearTag: typeof row.year_tag === "string" ? row.year_tag : null,
    pageCount: typeof row.page_count === "number" ? row.page_count : null,
    previewPages: typeof row.preview_pages === "number" ? row.preview_pages : null,
    exactScoreAchieved:
      typeof row.exact_score_achieved === "string" ? row.exact_score_achieved : null,
    includesExaminerComments: row.includes_examiner_comments === true,
    previewUrl: typeof row.watermarked_preview_url === "string" ? row.watermarked_preview_url : "",
    adminStarRating: typeof row.admin_star_rating === "number" ? row.admin_star_rating : null,
    promotionalNote: typeof row.promotional_note === "string" ? row.promotional_note : null,
    viewCount: Number(row.view_count ?? 0),
    soldCount: Number(row.sold_count ?? 0),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    tutorId: typeof row.tutor_id === "string" ? row.tutor_id : "",
    tutorUserId: typeof tutor?.user_id === "string" ? tutor.user_id : "",
    tutorName: typeof tutor?.display_name === "string" ? tutor.display_name : "MatchMax Tutor",
    tutorCode,
  };
}

/** The public note page by slug (or id fallback for legacy shares). */
export const getPublicNote = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const isUuid = /^[0-9a-f-]{36}$/i.test(data.slug);
    const { data: rows, error } = await db
      .from<NoteRow>("digital_materials")
      .select(`${PUBLIC_NOTE_COLUMNS}, ${PUBLIC_NOTE_TUTOR_JOIN}`)
      .eq("status", "published")
      .eq("tutors.is_published", true)
      .eq(isUuid ? "id" : "slug", data.slug)
      .limit(1);
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return null;
    return mapPublicNote(row);
  });

/** Other published notes by the same tutor (note-page bottom rail). */
export const getPublicNotesByTutor = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ tutorId: z.string().uuid(), excludeMaterialId: z.string().uuid().optional() })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    let query = db
      .from<NoteRow>("digital_materials")
      .select(`${PUBLIC_NOTE_COLUMNS}, ${PUBLIC_NOTE_TUTOR_JOIN}`)
      .eq("status", "published")
      .eq("tutors.is_published", true)
      .eq("tutor_id", data.tutorId);
    query = data.excludeMaterialId ? query.neq("id", data.excludeMaterialId) : query;
    const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(8);
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapPublicNote).filter((n): n is PublicNote => n !== null);
  });

/**
 * #203 view counter: signed-in, non-owner views count once per account per
 * day (material_views unique row; 23505 = already counted today). Logged-out
 * views never count. fire-and-forget from the note page loader.
 */
export const recordMaterialView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: material } = await db
      .from<{ tutor_id: string }>("digital_materials")
      .select("tutor_id")
      .eq("id", data.materialId)
      .maybeSingle();
    if (!material) return { counted: false };
    const { data: tutor } = await db
      .from<{ id: string }>("tutors")
      .select("id")
      .eq("id", material.tutor_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (tutor) return { counted: false }; // owner views never count

    // Match the column default's day boundary: Asia/Hong_Kong calendar date
    // (the DB default is (now() AT TIME ZONE 'Asia/Hong_Kong')::date).
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const insert = await db
      .from<never>("material_views")
      .insert({
        material_id: data.materialId,
        account_id: context.userId,
        view_date: today,
      })
      .select("material_id")
      .single();
    if (insert.error && /^duplicate key|^23505/.test(insert.error.message)) {
      return { counted: false };
    }
    if (insert.error) return { counted: false };
    const update = await db
      .from<never>("digital_materials")
      .update({ view_count: (await currentViewCount(db, data.materialId)) + 1 })
      .eq("id", data.materialId);
    if (update.error) return { counted: false };
    return { counted: true };
  });

async function currentViewCount(db: Awaited<ReturnType<typeof asAdminDb>>, id: string) {
  const { data } = await db
    .from<{ view_count: number }>("digital_materials")
    .select("view_count")
    .eq("id", id)
    .maybeSingle();
  return Number(data?.view_count ?? 0);
}

/** WhatsApp deep links for the note page (concierge number, never the tutor's). */
export const getNoteWhatsAppActions = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(160),
        priceHkd: z.number().min(0),
        tutorName: z.string().trim().min(1).max(120),
        tutorCode: z.string().trim().min(1).max(40),
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
    const number = typeof row?.value === "string" ? row.value.trim() : "";
    return {
      buyUrl: buildBuyWhatsAppUrl(
        number,
        { title: data.title, price_hkd: data.priceHkd },
        data.tutorName,
      ),
      requestUrl: buildBookLessonsWhatsAppUrl(number, data.tutorName, data.tutorCode),
    };
  });
