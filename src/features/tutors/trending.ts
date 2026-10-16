// Issue #151 Option A: home trending showcase data source. Thin, tolerant
// fetch over the get_trending_tutors RPC (migration 20261016150000), which
// returns the base-score candidate set for ALL published tutors. The landing
// page re-ranks these with the quality multipliers (rankTrending) after
// merging with its full Tutor rows — this module must never throw to the
// page: on any RPC failure we log and return an empty list so the home keeps
// its existing (non-trending) behaviour.
import { supabase } from "@/integrations/supabase/client";
import type { TrendingCandidate } from "@/features/tutors/engagement";

export async function fetchTrendingTutorSummaries(
  candidateLimit = 24,
): Promise<TrendingCandidate[]> {
  try {
    const { data, error } = await supabase.rpc("get_trending_tutors", {
      p_candidate_limit: candidateLimit,
    });
    if (error) throw error;
    return (data ?? []) as TrendingCandidate[];
  } catch (error) {
    console.warn("[trending] get_trending_tutors unavailable; home keeps fallback", error);
    return [];
  }
}
