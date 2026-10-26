import { useTranslation } from "react-i18next";

import { StarRating } from "@/components/ui/StarRating";
import { cn } from "@/lib/utils";

/**
 * Issues #83 + #105 (+ the reviews half of #116): verified parent/student
 * reviews on the public tutor profile. Reviews are collected off-platform by
 * the concierge and published by admin (is_published), read-only here, so a
 * tutor can never fabricate or remove them.
 */

export type TutorReview = {
  id: string;
  rating: number;
  public_review: string | null;
  reviewer_display_name: string;
  student_grade_school: string | null;
  created_at: string;
};

export function TutorReviews({
  reviews,
  className,
}: {
  reviews: TutorReview[];
  className?: string;
}) {
  const { t, i18n } = useTranslation();

  if (reviews.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <ul className="divide-y divide-border overflow-hidden rounded-sm border border-border">
        {reviews.map((review) => (
          <li key={review.id} className="px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[color:var(--ink)]">
                  {review.reviewer_display_name}
                </p>
                {review.student_grade_school ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {review.student_grade_school}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StarRating
                  value={review.rating}
                  readOnly
                  size={16}
                  label={t("profile.reviews_rating_aria", { rating: review.rating, max: 5 })}
                />
                <time
                  dateTime={review.created_at.slice(0, 10)}
                  className="text-xs text-muted-foreground"
                >
                  {new Date(review.created_at).toLocaleDateString(i18n.language, {
                    year: "numeric",
                    month: "short",
                  })}
                </time>
              </div>
            </div>
            {review.public_review ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[color:var(--ink)]">
                {review.public_review}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("profile.reviews_disclaimer")}
      </p>
    </div>
  );
}
