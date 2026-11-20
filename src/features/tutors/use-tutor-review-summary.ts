import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type TutorReviewSummary = {
  average: number | null;
  count: number;
  /** #794: the RPC's thin-sample flag (count < 3) — TS owns the copy. */
  new_cue?: boolean;
  latest: {
    rating: number;
    comment: string;
    display_line: string;
    created_at: string;
    updated_at?: string | null;
  }[];
};

const EMPTY: TutorReviewSummary = { average: null, count: 0, latest: [] };

/**
 * #794 §2.1 public aggregate read. The RPC is anon-executable and
 * SECURITY DEFINER, so the anon client reads it with no service role. Any
 * error (42P01 / PGRST202 on a pre-migration deploy) leaves the caller with a
 * null summary — the section hides instead of breaking the page.
 */
export function useTutorReviewSummary(tutorId: string | null | undefined): {
  summary: TutorReviewSummary | null;
  loading: boolean;
} {
  const [summary, setSummary] = useState<TutorReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!tutorId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      // The RPC is missing from the generated Database types, so the call
      // needs a cast — bind first (the admin-index idiom), a detached
      // `supabase.rpc` loses `this` and supabase-js crashes reading `.rest`.
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data: s, error } = await rpc("get_tutor_review_summary", { _tutor_id: tutorId });
      if (cancelled) return;
      setLoading(false);
      if (error) return;
      setSummary((s ?? EMPTY) as TutorReviewSummary);
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);
  return { summary, loading };
}
