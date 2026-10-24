import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type TutorReviewSummary = {
  average: number | null;
  count: number;
  latest: { rating: number; comment: string; display_line: string; created_at: string }[];
};

/**
 * #205 + #287, public case-review block on the tutor card: average + count +
 * latest 5 parent reviews. Zero reviews shows "New tutor", never "0.0".
 * Reads the public SECURITY DEFINER summary RPC with the anon client, the
 * RPC is granted to anon, so no service role is involved.
 */
export function ReviewSummaryBlock({ tutorId }: { tutorId: string }) {
  const { t } = useTranslation();
  // Plain effect + state: React Query's queryFn left the rpc await unsettled
  // in dev (standalone identical call resolves), a simple read needs neither
  // cache coordination nor retries.
  const [summary, setSummary] = useState<TutorReviewSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data: s, error } = await rpc("get_tutor_review_summary", {
        _tutor_id: tutorId,
      });
      if (cancelled) return;
      if (error) return;
      setSummary((s ?? { average: null, count: 0, latest: [] }) as TutorReviewSummary);
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);

  if (!summary) return null;
  if (summary.count === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-3 py-1 text-xs font-medium">
          {t("sor.new_tutor")}
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm">
        <Star className="h-4 w-4 fill-current text-amber-500" aria-hidden="true" />
        <span className="font-medium text-[color:var(--ink)]">{summary.average?.toFixed(1)}</span>
        <span className="text-muted-foreground">
          {t("sor.review_count", { count: summary.count })}
        </span>
      </p>
      <ul className="space-y-3">
        {summary.latest.map(
          (
            r: { rating: number; comment: string; display_line: string; created_at: string },
            i: number,
          ) => (
            <li key={i} className="rounded-lg border border-[color:var(--ink)]/10 p-3">
              <p className="flex flex-wrap items-center gap-1 text-xs font-medium text-[color:var(--ink)]">
                {r.display_line}
                <span className="flex text-amber-500" aria-label={`${r.rating}/5`}>
                  {Array.from({ length: 5 }, (_, s) => (
                    <Star
                      key={s}
                      className={cn(
                        "h-3 w-3",
                        s < r.rating ? "fill-current" : "text-muted-foreground/40",
                      )}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span className="font-normal text-muted-foreground">
                  · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
