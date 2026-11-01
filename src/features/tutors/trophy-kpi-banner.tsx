import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getTutorTrophyKpis } from "@/features/tutors/trophy-kpis.functions";

/**
 * Issue #462 Phase A: Trophy Wall KPI strip + ledger-derived digital hour
 * badges (Rising 25h / Azure 100h — the #468 Phase-0 fold, REQUIRED here).
 * Self-fetching and completely hidden until the tutor holds ≥ 1 verified
 * ledger hour (ExperiencePill precedent: no empty chrome on thin profiles).
 * Aggregates only — no student PII in Phase A.
 */
export function TrophyKpiBanner({ tutorId }: { tutorId: string }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["trophy-kpis", tutorId],
    queryFn: () => getTutorTrophyKpis({ data: { tutorId } }),
    staleTime: 60_000,
  });

  if (!data || data.totalHours <= 0) return null;

  return (
    <div
      className="mt-1.5 rounded-xl border border-[color:var(--brand-link)]/25 bg-[color:var(--brand-link)]/[0.05] px-3 py-2.5"
      data-testid="trophy-kpi-banner"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[color:var(--ink)]">
        <Trophy className="h-3.5 w-3.5 text-[color:var(--brand-link)]" aria-hidden="true" />
        <span>{t("trophy.active", { count: data.activeStudents })}</span>
        <span className="text-muted-foreground">·</span>
        <span>{t("trophy.past", { count: data.pastStudents })}</span>
        {data.avgRetentionHours !== null && (
          <>
            <span className="text-muted-foreground">·</span>
            <span>{t("trophy.avg_retention", { hours: data.avgRetentionHours })}</span>
          </>
        )}
        {data.rating !== null && (
          <>
            <span className="text-muted-foreground">·</span>
            <span>{t("trophy.rating", { rating: data.rating, count: data.reviewsCount })}</span>
          </>
        )}
      </p>
      {(data.badgeRising || data.badgeAzure) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            {t("trophy.badges_label")}
          </span>
          {data.badgeRising && (
            <span className="rounded-full border border-[color:var(--brand-link)]/40 bg-[color:var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--brand-link)]">
              {t("trophy.badge_rising")}
            </span>
          )}
          {data.badgeAzure && (
            <span className="rounded-full border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)] px-2 py-0.5 text-[11px] font-semibold text-white">
              {t("trophy.badge_azure")}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
