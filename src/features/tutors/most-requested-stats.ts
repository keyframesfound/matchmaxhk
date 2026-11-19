// Issue #768 Part 2 §3.C/§5: per-tutor demand + capacity stats for the home
// "Most Requested Tutors This Week" rail. Thin, tolerant fetch over the
// get_tutor_public_stats RPC, mirroring the trending.ts contract: the rail
// must never break the landing page, so any RPC failure (including the RPC not
// being deployed yet) logs once and returns an empty list. An empty list makes
// the rail keep its pre-#768 ranking (see buildMostRequestedTutorIds callers).
import { supabase } from "@/integrations/supabase/client";

export type TutorPublicStats = {
  tutor_id: string;
  /** Open cases right now; zero = the tutor has room for a new student. */
  active_cases: number;
  /** Distinct parents who saved or requested in the trailing 30 days. */
  engagement_count: number;
  /** Direct requests in the trailing 14 days (the rail's velocity signal). */
  requests_14d: number;
  /** Saves in the trailing 14 days (the rail's velocity signal). */
  saves_14d: number;
};

/**
 * The generated Database types predate this RPC, so the call is typed here
 * rather than widening the whole client. Rows are validated in parseRow.
 */
type PublicStatsRpc = (
  fn: "get_tutor_public_stats",
  args: { p_tutor_ids: string[] },
) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;

function toCount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function parseRow(raw: unknown): TutorPublicStats | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const tutorId = typeof row.tutor_id === "string" ? row.tutor_id : "";
  if (!tutorId) return null;
  return {
    tutor_id: tutorId,
    active_cases: toCount(row.active_cases),
    engagement_count: toCount(row.engagement_count),
    requests_14d: toCount(row.requests_14d),
    saves_14d: toCount(row.saves_14d),
  };
}

export async function fetchTutorPublicStats(
  tutorIds: readonly string[],
): Promise<TutorPublicStats[]> {
  if (tutorIds.length === 0) return [];
  try {
    const rpc = supabase.rpc as unknown as PublicStatsRpc;
    const { data, error } = await rpc("get_tutor_public_stats", {
      p_tutor_ids: [...tutorIds],
    });
    if (error) throw error;
    if (!Array.isArray(data)) return [];
    return data.flatMap((row) => {
      const parsed = parseRow(row);
      return parsed ? [parsed] : [];
    });
  } catch (error) {
    console.warn(
      "[most-requested] get_tutor_public_stats unavailable; rail keeps existing ranking",
      error,
    );
    return [];
  }
}
