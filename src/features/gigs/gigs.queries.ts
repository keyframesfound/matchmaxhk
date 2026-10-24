import { supabase } from "@/integrations/supabase/client";

/**
 * Issues #326/#329: client reads behind the `get_public_gigs` SECURITY
 * DEFINER RPC (migration 20261017100000_freestyle_gigs.sql). bought_count
 * lives in material_orders, which is NOT anon-readable, so the count must be
 * computed inside the database, same reason get_home_notes exists for the
 * notes row. The call is tolerant: when the RPC has not been applied yet,
 * PostgREST answers 42P01 (undefined object) or PGRST202 (schema cache miss)
 * and we return an empty list so the home row / directory section simply
 * render nothing instead of erroring (same pattern as home-notes.queries.ts).
 *
 * Rows are already filtered to published gigs of published tutors and sorted
 * bought_count DESC, then created_at DESC inside SQL, do not re-sort.
 */

export type PublicGig = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  priceHkd: number;
  gigCategory: string;
  gigDeliveryType: string;
  turnaroundNote: string | null;
  coverImagePath: string | null;
  curriculumTag: string;
  subjectTag: string | null;
  tutorCode: string;
  tutorDisplayName: string;
  verificationTier: string | null;
  /** Delivered orders ONLY (#329), pending/refunded/past-due never count. */
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

function mapPublicGig(row: RpcRow): PublicGig | null {
  const id = typeof row.id === "string" ? row.id : "";
  const tutorCode = typeof row.tutor_code === "string" ? row.tutor_code : "";
  if (!id || !tutorCode) return null;
  return {
    id,
    title: typeof row.title === "string" ? row.title : "",
    slug: typeof row.slug === "string" ? row.slug : null,
    description: typeof row.description === "string" ? row.description : null,
    priceHkd: Number(row.price_hkd ?? 0),
    gigCategory: typeof row.gig_category === "string" ? row.gig_category : "other",
    gigDeliveryType: typeof row.gig_delivery_type === "string" ? row.gig_delivery_type : "",
    turnaroundNote: typeof row.turnaround_note === "string" ? row.turnaround_note : null,
    coverImagePath: typeof row.cover_image_path === "string" ? row.cover_image_path : null,
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

/** Public gigs, optionally filtered by category (SQL sorts, we never do). */
export async function getPublicGigs(
  category?: string | null,
  limit?: number,
): Promise<PublicGig[]> {
  const args: Record<string, unknown> = {};
  if (category) args.p_category = category;
  if (limit != null) args.p_limit = limit;
  const { data, error } = await (supabase as unknown as RpcClient).rpc("get_public_gigs", args);
  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }
  return (data ?? []).map(mapPublicGig).filter((gig): gig is PublicGig => gig !== null);
}

const PREVIEWS_BUCKET = "materials-previews";

/**
 * Cover images live in the PUBLIC materials-previews bucket (staff-reviewed
 * at listing review), so a plain public URL is safe, no signing.
 */
export function publicCoverUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(PREVIEWS_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}
