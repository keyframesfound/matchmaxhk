import { formatDistanceToNow } from "date-fns";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ratingShowsNewCue, tutorRatingBadgeState } from "@/features/cases/case-reviews";
import {
  useTutorReviewSummary,
  type TutorReviewSummary,
} from "@/features/tutors/use-tutor-review-summary";
import { cn } from "@/lib/utils";

/**
 * #794 §2.1 public case-review block on the tutor profile: average + count from
 * the FIRST published parent→tutor review, a "New / 新" cue until three, and
 * written reviews from the first one. Zero published reviews renders nothing
 * (the profile hides the whole section); never "0.0", never a bare average.
 */
export function ReviewSummaryBlock({
  tutorId,
  summary: provided,
}: {
  tutorId: string;
  summary?: TutorReviewSummary | null;
}) {
  const { t } = useTranslation();
  const { summary: fetched } = useTutorReviewSummary(provided ? null : tutorId);
  const summary = provided ?? fetched;

  if (!summary || summary.count <= 0) return null;
  const state = tutorRatingBadgeState(summary.count);
  const newCue = summary.new_cue ?? ratingShowsNewCue(summary.count);

  return (
    <div className="space-y-3" data-rating-summary={state}>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Star className="h-4 w-4 fill-current text-amber-500" aria-hidden="true" />
        <span className="font-semibold text-[color:var(--ink)]" data-rating-average>
          {summary.average !== null ? summary.average.toFixed(1) : ""}
        </span>
        <span className="text-muted-foreground">
          {t("sor.review_count", { count: summary.count })}
        </span>
        {newCue ? (
          <span
            className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-xs font-medium text-muted-foreground"
            data-rating-new-cue
          >
            {t("tutor_card.rating_new_cue")}
          </span>
        ) : null}
      </p>
      <ul className="space-y-3">
        {summary.latest.map((r, i) => (
          <li
            key={`${r.created_at}-${i}`}
            className="rounded-lg border border-[color:var(--ink)]/10 p-3"
          >
            <p className="flex flex-wrap items-center gap-1 text-xs font-semibold text-[color:var(--ink)]">
              {r.display_line}
              <span className="flex text-amber-500" aria-label={`${r.rating}/5`}>
                {Array.from({ length: 5 }, (_, s) => (
                  <Star
                    key={s}
                    className={cn(
                      "h-3 w-3",
                      s < r.rating ? "fill-current" : "text-muted-foreground",
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
