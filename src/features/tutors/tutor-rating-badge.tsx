// Issue #649 (Trust), public parent→tutor rating badge on the Explore
// TutorCard. Reads the anon-executable SECURITY DEFINER aggregate RPC
// get_tutor_review_summary straight from the client — the same tolerant
// pattern as review-summary-block / experience-badge: any error (42P01 /
// PGRST202 on a pre-migration deploy) hides the component, never breaks the
// page. Hidden reviews leave the average because the RPC counts
// status='visible' rows only.
//
// CEO locks: threshold = 3 published reviews before an average shows.
//  - 0 published  → "New" pill (never a fake average, never "0.0")
//  - 1–2 published → count-only line (no average)
//  - ≥3 published → ⭐ {avg} · {count} reviews

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { tutorRatingBadgeState } from "@/features/cases/case-reviews";

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

  if (state === "count_only") {
    // 1–2 published reviews: the count alone — never a thin average.
    return (
      <p
        className="mt-1.5 text-[11px] leading-tight text-muted-foreground"
        data-rating-badge="count_only"
      >
        {t("tutor_card.rating_count_only", { count: summary.count })}
      </p>
    );
  }

  return (
    <p
      className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold leading-tight text-[color:var(--ink)]"
      data-rating-badge="full"
    >
      <Star className="h-3 w-3 fill-current text-amber-500" aria-hidden="true" />
      {/* #649 exact card copy: "{avg} · {n} reviews" / "{avg} · {n} 則評價". */}
      <span className="tabular-nums">
        {t("tutor_card.rating_summary", {
          avg: summary.average?.toFixed(1) ?? "",
          count: summary.count,
        })}
      </span>
    </p>
  );
}
