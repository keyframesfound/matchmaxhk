import { supabase } from "@/integrations/supabase/client";

/**
 * Issue #312: reads behind the `get_home_notes` / `get_tutor_public_notes`
 * SECURITY DEFINER RPCs (migration 20261015140000_home_notes_rpc.sql).
 *
 * bought_count lives in material_orders, which is NOT anon-readable (RLS), so
 * the counts must be computed inside the database, hence the RPCs rather
 * than a plain table read. Both calls are tolerant: when the RPC has not
 * been applied yet, PostgREST answers 42P01 (undefined object) or PGRST202
 * (schema cache miss) and we return an empty list so the home row / profile
 * block simply render nothing instead of erroring, same pattern as
 * queries.ts (isMissingRelation) and the reviews reads.
 */

export type HomeNote = {
  id: string;
  title: string;
  slug: string | null;
  priceHkd: number;
  materialType: string;
  curriculumTag: string;
  subjectTag: string | null;
  tutorCode: string;
  tutorDisplayName: string;
  verificationTier: string | null;
  /** Delivered #203 orders only (pending/refunded never count). */
  boughtCount: number;
  createdAt: string;
};

type RpcRow = Record<string, unknown>;

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    data: RpcRow[] | null;
    error?: { code?: string; message?: string } | null;
  }>;
};

function isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    /schema cache|does not exist|Could not find the function/i.test(error.message ?? "")
  );
}

function mapHomeNote(row: RpcRow): HomeNote | null {
  const id = typeof row.id === "string" ? row.id : "";
  const tutorCode = typeof row.tutor_code === "string" ? row.tutor_code : "";
  if (!id || !tutorCode) return null;
  return {
    id,
    title: typeof row.title === "string" ? row.title : "",
    slug: typeof row.slug === "string" ? row.slug : null,
    priceHkd: Number(row.price_hkd ?? 0),
    materialType: typeof row.material_type === "string" ? row.material_type : "notes",
    curriculumTag: typeof row.curriculum_tag === "string" ? row.curriculum_tag : "",
    subjectTag: typeof row.subject_tag === "string" ? row.subject_tag : null,
    tutorCode,
    tutorDisplayName:
      typeof row.tutor_display_name === "string" ? row.tutor_display_name : "MatchMax Tutor",
    verificationTier: typeof row.verification_tier === "string" ? row.verification_tier : null,
    boughtCount: Number(row.bought_count ?? 0),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

async function callNotesRpc(fn: string, args: Record<string, unknown>): Promise<HomeNote[]> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc(fn, args);
  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }
  return (data ?? []).map(mapHomeNote).filter((note): note is HomeNote => note !== null);
}

/** Top public notes for the home row: bought desc, then newest (SQL-side). */
export function fetchHomeNotes(limit = 8): Promise<HomeNote[]> {
  return callNotesRpc("get_home_notes", { p_limit: limit });
}

/** One tutor's public notes (Authored notes block on the profile). */
export function fetchTutorPublicNotes(tutorCode: string): Promise<HomeNote[]> {
  return callNotesRpc("get_tutor_public_notes", { p_tutor_code: tutorCode });
}
