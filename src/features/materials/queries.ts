import { supabase } from "@/integrations/supabase/client";

/**
 * Issues #131/#132/#133/#134: public read helpers for the digital study
 * materials marketplace. All reads go through the RLS public policy
 * (published materials of published tutors only); degrade to empty lists
 * when the migration hasn't been applied yet, so the profile section simply
 * stays hidden instead of erroring — same tolerant pattern as reviews.
 */

export type StudyMaterial = {
  id: string;
  tutor_id: string;
  title: string;
  description: string | null;
  price_hkd: number;
  school_tag: string | null;
  curriculum_tag: string;
  subject_tag: string | null;
  document_type: string;
  material_type: string;
  topic: string | null;
  grade_achieved: string | null;
  exemplar_permission: boolean;
  year_tag: string | null;
  page_count: number | null;
  /** #136: tutor-entered approximate word count (optional). */
  word_count: number | null;
  exact_score_achieved: string | null;
  includes_examiner_comments: boolean;
  watermarked_preview_url: string;
  admin_star_rating: number | null;
  promotional_note: string | null;
  admin_marketing_summary: string | null;
  created_at: string;
  /** #392: public URL-ready listing slug (detail page for every kind). */
  slug: string | null;
  /** #392 big-cover shop card: public materials-previews path. */
  cover_image_path: string | null;
  /** #392: delivered orders only, incremented at delivery. */
  sold_count: number;
};

export const MATERIALS_PREVIEW_DISCLAIMER_KEY = "materials.disclaimer";

function isMissingRelation(error: unknown): boolean {
  return (error as { code?: string })?.code === "42P01";
}

const MATERIAL_COLS =
  "id, tutor_id, title, description, price_hkd, school_tag, curriculum_tag, subject_tag, document_type, material_type, topic, grade_achieved, exemplar_permission, year_tag, page_count, word_count, exact_score_achieved, includes_examiner_comments, watermarked_preview_url, admin_star_rating, promotional_note, admin_marketing_summary, created_at, slug, cover_image_path, sold_count";

/**
 * #392: the kinds the tutor-profile "Authored notes" section renders.
 * Folders/courses/gigs are shop listings with their own card chrome and
 * detail pages — they surface in the /tutors?view=materials directory, not
 * in the profile notes block.
 */
export const PROFILE_NOTE_TYPES = ["notes", "mock", "exemplar", "flashcards"] as const;

/** Profile query filter: the profile kinds PLUS gigs (never notes-block kinds). */
const SUPPORTED_PROFILE_TYPES_CSV = '"notes","mock","exemplar","flashcards","gig"';

function mapMaterial(row: Record<string, unknown>): StudyMaterial {
  return {
    id: typeof row.id === "string" ? row.id : "",
    tutor_id: typeof row.tutor_id === "string" ? row.tutor_id : "",
    title: typeof row.title === "string" ? row.title : "",
    description: typeof row.description === "string" ? row.description : null,
    price_hkd: typeof row.price_hkd === "number" ? row.price_hkd : Number(row.price_hkd ?? 0),
    school_tag: typeof row.school_tag === "string" ? row.school_tag : null,
    curriculum_tag: typeof row.curriculum_tag === "string" ? row.curriculum_tag : "",
    subject_tag: typeof row.subject_tag === "string" ? row.subject_tag : null,
    document_type: typeof row.document_type === "string" ? row.document_type : "custom_notes",
    material_type: typeof row.material_type === "string" ? row.material_type : "notes",
    topic: typeof row.topic === "string" ? row.topic : null,
    grade_achieved: typeof row.grade_achieved === "string" ? row.grade_achieved : null,
    exemplar_permission: row.exemplar_permission === true,
    year_tag: typeof row.year_tag === "string" ? row.year_tag : null,
    page_count: typeof row.page_count === "number" ? row.page_count : null,
    word_count: typeof row.word_count === "number" ? row.word_count : null,
    exact_score_achieved:
      typeof row.exact_score_achieved === "string" ? row.exact_score_achieved : null,
    includes_examiner_comments: row.includes_examiner_comments === true,
    watermarked_preview_url:
      typeof row.watermarked_preview_url === "string" ? row.watermarked_preview_url : "",
    admin_star_rating: typeof row.admin_star_rating === "number" ? row.admin_star_rating : null,
    promotional_note: typeof row.promotional_note === "string" ? row.promotional_note : null,
    admin_marketing_summary:
      typeof row.admin_marketing_summary === "string" ? row.admin_marketing_summary : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    slug: typeof row.slug === "string" ? row.slug : null,
    cover_image_path: typeof row.cover_image_path === "string" ? row.cover_image_path : null,
    sold_count: Number(row.sold_count ?? 0),
  };
}

/** Minimal structural type for the untyped table access below. */
type AfterFilter = {
  eq: (col: string, value: string | boolean) => AfterFilter;
  neq: (col: string, value: string) => AfterFilter;
  not: (col: string, op: string, value: string) => AfterFilter;
  order: (
    col: string,
    opts: { ascending: boolean },
  ) => Promise<{
    data: Record<string, unknown>[] | null;
    error?: { code?: string; message?: string } | null;
  }>;
};

type MaterialsQuery = {
  from: (table: string) => {
    select: (cols: string) => AfterFilter;
  };
};

// `digital_materials` is added by this PR's migration; cast through unknown so
// generated types don't need regenerating for the table to typecheck.
function materialsTable(): MaterialsQuery["from"] extends never
  ? never
  : ReturnType<MaterialsQuery["from"]> {
  return (supabase as unknown as MaterialsQuery).from("digital_materials");
}

/** Published materials for one tutor's public profile (newest first). */
export async function fetchMaterialsForTutor(tutorId: string): Promise<StudyMaterial[]> {
  const { data, error } = await materialsTable()
    .select(MATERIAL_COLS)
    .eq("tutor_id", tutorId)
    .eq("status", "published")
    // Freestyle gigs (#326) AND the #392 shop kinds (folders / courses) are
    // NOT authored notes — they render only through the shop directory and
    // their own detail pages, never inside the profile notes block.
    .not("material_type", "in", `(${SUPPORTED_PROFILE_TYPES_CSV})`)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapMaterial(row)).filter((m) => m.id);
}

/** The whole published marketplace, used by the /study-materials directory. */
export type MarketplaceMaterial = StudyMaterial & {
  tutor_display_name: string;
  tutor_code: string;
  /** #314: the tutor holds the Verified badge (verification_tier tier_2_verified). */
  tutor_verified: boolean;
};

/**
 * #392: the WHOLE published shop — notes kinds, folders, courses AND gigs —
 * one RLS read feeding the unified directory grid (kind filter chips live
 * client-side, same as the tutors list). The old gig exclusion is gone: the
 * directory is the shop now, and the home rows / profile section keep their
 * own note-only RPCs and queries.
 */
export async function fetchMarketplaceMaterials(): Promise<MarketplaceMaterial[]> {
  const { data, error } = await materialsTable()
    .select(
      `${MATERIAL_COLS}, tutors!inner(display_name, tutor_code, is_published, verification_tier)`,
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? [])
    .map((raw) => {
      const row = raw as Record<string, unknown>;
      const tutor = row.tutors as Record<string, unknown> | null;
      const material = mapMaterial(row);
      return {
        ...material,
        tutor_display_name:
          typeof tutor?.display_name === "string" ? tutor.display_name : "MatchMax Tutor",
        tutor_code: typeof tutor?.tutor_code === "string" ? tutor.tutor_code : "",
        tutor_verified: tutor?.verification_tier === "tier_2_verified",
      };
    })
    .filter((m) => m.id && m.tutor_code);
}

/** Distinct school tags for the directory filter dropdown. */
export function collectSchoolTags(materials: MarketplaceMaterial[]): string[] {
  return Array.from(
    new Set(materials.map((m) => m.school_tag?.trim()).filter((s): s is string => Boolean(s))),
  ).sort((a, b) => a.localeCompare(b));
}

/** The issue's verbatim WhatsApp buy message (#131) — kept for back-compat. */
export { buildBuyWhatsAppUrl } from "@/features/materials/whatsapp";

export function formatDocumentTypeLabel(type: string, t: (key: string) => string): string {
  const key = `materials.doc_type_${type}`;
  // Legacy rows may carry types the CHECK no longer allows (e.g. removed
  // past_paper_solutions) — fall back to a humanized value instead of
  // rendering the raw i18n key.
  const label = t(key);
  return label === key ? type.replace(/_/g, " ") : label;
}

/** #313: the 3-way type label (Notes / Mock / Exemplar) for new listings. */
export function formatMaterialTypeLabel(type: string, t: (key: string) => string): string {
  const key = `materials.type_${type}`;
  const label = t(key);
  return label === key ? type.replace(/_/g, " ") : label;
}
