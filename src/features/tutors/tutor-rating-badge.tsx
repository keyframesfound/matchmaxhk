// Issue #794 §2.1 (supersedes #649's hidden-average threshold): public
// parent→tutor rating badge on the Explore TutorCard. Reads the anon-executable
// SECURITY DEFINER aggregate RPC get_tutor_review_summary straight from the
// client — the same tolerant pattern as experience-badge: any error (42P01 /
// PGRST202 on a pre-migration deploy) hides the component, never breaks the
// page. Hidden/held reviews leave the average because the RPC counts
// status='visible' rows only.
//
// CEO lock 2026-11-18:
//  - 0 published   → "New / 新" pill (never a fake average, never "0.0")
//  - 1–2 published → ⭐ {avg} · {n} reviews + the thin-sample "New / 新" cue
//  - ≥3 published  → ⭐ {avg} · {n} reviews
// The average NEVER renders without its count.

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { ratingShowsNewCue, tutorRatingBadgeState } from "@/features/cases/case-reviews";

type TutorRatingSummary = { average: number | null; count: number };

export function TutorRatingBadge({ tutorId }: { tutorId: string }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<TutorRatingSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The RPC is missing from the generated Database types, so the call
      // needs a cast — bind first (the admin-index idiom), a detached
      // `supabase.rpc` loses `this` and supabase-js crashes reading `.rest`.
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc("get_tutor_review_summary", {
        _tutor_id: tutorId,
      });
      if (cancelled) return;
      if (error) return;
      const s = (data ?? null) as { average: number | null; count: number } | null;
      if (!s) return;
      setSummary({ average: s.average, count: s.count });
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);

  if (!summary) return null;
  const state = tutorRatingBadgeState(summary.count);

  if (state === "new") {
    return (
      <p className="mt-1.5" data-rating-badge="new">
        <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {t("tutor_card.rating_new")}
        </span>
      </p>
    );
  }

  return (
    <p
      className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] font-semibold leading-tight text-[color:var(--ink)]"
      data-rating-badge={state}
    >
      <Star className="h-3 w-3 fill-current text-amber-500" aria-hidden="true" />
      {/* #794 exact card copy: "{avg} · {n} reviews" / "{avg} · {n} 則評價". */}
      <span className="tabular-nums">
        {t("tutor_card.rating_summary", {
          avg: summary.average?.toFixed(1) ?? "",
          count: summary.count,
        })}
      </span>
      {ratingShowsNewCue(summary.count) ? (
        <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {t("tutor_card.rating_new_cue")}
        </span>
      ) : null}
    </p>
  );
}
