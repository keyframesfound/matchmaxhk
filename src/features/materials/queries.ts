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
  year_tag: string | null;
  page_count: number | null;
  exact_score_achieved: string | null;
  includes_examiner_comments: boolean;
  watermarked_preview_url: string;
  admin_star_rating: number | null;
  promotional_note: string | null;
  admin_marketing_summary: string | null;
  created_at: string;
};

export const MATERIALS_PREVIEW_DISCLAIMER_KEY = "materials.disclaimer";

function isMissingRelation(error: unknown): boolean {
  return (error as { code?: string })?.code === "42P01";
}

const MATERIAL_COLS =
  "id, tutor_id, title, description, price_hkd, school_tag, curriculum_tag, subject_tag, document_type, year_tag, page_count, exact_score_achieved, includes_examiner_comments, watermarked_preview_url, admin_star_rating, promotional_note, admin_marketing_summary, created_at";

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
    year_tag: typeof row.year_tag === "string" ? row.year_tag : null,
    page_count: typeof row.page_count === "number" ? row.page_count : null,
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
  };
}

/** Minimal structural type for the untyped table access below. */
type MaterialsQuery = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        value: string | boolean,
      ) => {
        eq: (
          col: string,
          value: string | boolean,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{
            data: Record<string, unknown>[] | null;
            error?: { code?: string; message?: string } | null;
          }>;
        };
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data: Record<string, unknown>[] | null;
          error?: { code?: string; message?: string } | null;
        }>;
      };
    };
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
    .eq("is_published", true)
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
};

export async function fetchMarketplaceMaterials(): Promise<MarketplaceMaterial[]> {
  const { data, error } = await materialsTable()
    .select(`${MATERIAL_COLS}, tutors!inner(display_name, tutor_code, is_published)`)
    .eq("is_published", true)
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
  return t(`materials.doc_type_${type}`);
}
