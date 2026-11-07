import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  getMyProfileStrength,
  type MyProfileStrength,
} from "@/features/account/profile-strength.functions";
import type { StrengthItem } from "@/features/account/profile-strength";

/**
 * #673: the unified Profile Strength ring + the ONE next-best-action CTA.
 * Same module computes the score everywhere, so /calendar, the Activity
 * dashboard (#670) and future surfaces can never disagree.
 */

const NBA_KEYS: Record<StrengthItem, string> = {
  display_name: "profile_strength.nba_display_name",
  photo: "profile_strength.nba_photo",
  subjects: "profile_strength.nba_subjects",
  bio: "profile_strength.nba_bio",
  rates: "profile_strength.nba_rates",
  availability: "profile_strength.nba_availability",
  weekly_windows: "profile_strength.nba_weekly_windows",
  publish: "profile_strength.nba_publish",
};

export function useProfileStrength() {
  return useQuery({
    queryKey: ["profile-strength"],
    queryFn: () => getMyProfileStrength(),
    staleTime: 60_000,
  });
}

export function ProfileStrengthCard({ data }: { data: MyProfileStrength }) {
  const { t } = useTranslation();
  const nba = data.nba;
  return (
    <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("profile_strength.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("profile_strength.subtitle", { done: data.score })}
          </p>
        </div>
        <span
          className="grid h-14 w-14 place-items-center rounded-full border-2 border-[color:var(--brand-link)] text-base font-bold text-[color:var(--brand-link)]"
          aria-label={t("profile_strength.subtitle", { done: data.score })}
        >
          {data.score}%
        </span>
      </div>
      {nba ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-[color:var(--surface-subtle)] px-4 py-3">
          <p className="text-sm font-medium text-[color:var(--ink)]">
            {t(NBA_KEYS[nba.id])}
            {nba.points > 0 ? (
              <span className="ml-1.5 text-xs font-semibold text-muted-foreground">
                +{nba.points}
              </span>
            ) : null}
          </p>
          <Button asChild size="sm">
            <Link to={nba.href}>{t("profile_strength.nba_cta")}</Link>
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("profile_strength.complete")}</p>
      )}
      {data.availabilityDaysSinceConfirmed !== null && data.availabilityDaysSinceConfirmed > 14 ? (
        <p className="text-xs text-muted-foreground">{t("profile_strength.freshness_note")}</p>
      ) : null}
    </section>
  );
}

export function ProfileStrengthSection() {
  const { data } = useProfileStrength();
  if (!data?.isTutor) return null;
  return <ProfileStrengthCard data={data} />;
}
