import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MatchedTutorCardView } from "@/features/cases/parent/matched-tutor";

type MatchedTutorSafetyCardProps = {
  tutor: MatchedTutorCardView;
};

/**
 * Issue #529 bait-and-switch card: the matched tutor's public identity plus
 * the case's locked rate and student count. The "pay only your matched tutor"
 * line stays on MatchStatusCard directly above.
 */
export function MatchedTutorSafetyCard({ tutor }: MatchedTutorSafetyCardProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-border p-5">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {t("case_status.safety_card_title")}
      </h2>
      <div className="mt-3 flex items-center gap-4">
        {tutor.photoUrl ? (
          <img
            src={tutor.photoUrl}
            alt={tutor.displayName}
            className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border text-lg font-semibold text-[color:var(--ink)]"
          >
            {tutor.initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[color:var(--ink)]">
            {tutor.displayName}
          </p>
          {tutor.university ? (
            <p className="truncate text-sm text-muted-foreground">{tutor.university}</p>
          ) : null}
          <p className="mt-0.5 text-sm text-muted-foreground">
            {tutor.hourlyRateHkd !== null
              ? `${t("case_status.safety_card_rate", { rate: tutor.hourlyRateHkd })} · `
              : ""}
            {tutor.studentCount > 1
              ? t("case_status.safety_card_students", { count: tutor.studentCount })
              : t("case_status.safety_card_one_student")}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink)]">
        {t("case_status.safety_card_check")}
      </p>
      {tutor.tutorCode ? (
        <Link
          to="/tutors/$tutorCode"
          params={{ tutorCode: tutor.tutorCode }}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-link)] underline-offset-4 hover:underline"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {t("case_status.safety_card_profile")}
        </Link>
      ) : null}
    </section>
  );
}
