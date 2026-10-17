import { useQuery } from "@tanstack/react-query";
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
 * #205 + #287 — public case-review block on the tutor card: average + count +
 * latest 5 parent reviews. Zero reviews shows "New tutor", never "0.0".
 * Reads the public SECURITY DEFINER summary RPC — no service role needed.
 */
export function ReviewSummarySection({ tutorId }: { tutorId: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["sor", "review-summary", tutorId],
    queryFn: async (): Promise<TutorReviewSummary> => {
      // New RPC not yet in the generated Database types — cast just this call.
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data: summary, error } = await rpc("get_tutor_review_summary", {
        _tutor_id: tutorId,
      });
      if (error) throw error;
      return (summary ?? { average: null, count: 0, latest: [] }) as TutorReviewSummary;
    },
  });

  if (isLoading || !data) return null;
  if (data.count === 0) {
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
        <span className="font-semibold text-[color:var(--ink)]">{data.average?.toFixed(1)}</span>
        <span className="text-muted-foreground">
          {t("sor.review_count", { count: data.count })}
        </span>
      </p>
      <ul className="space-y-3">
        {data.latest.map((r, i) => (
          <li key={i} className="rounded-lg border border-[color:var(--ink)]/10 p-3">
            <p className="flex items-center gap-1 text-xs font-semibold text-[color:var(--ink)]">
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
        ))}
      </ul>
    </div>
  );
}
