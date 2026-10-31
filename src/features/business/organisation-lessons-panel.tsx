import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { getOrganisationLessonDashboard } from "@/features/cases/earnings.functions";

/**
 * Issue #461 Phase A 3d — the centre's lesson summary across its own cases:
 * lessons taught / scheduled, hours and the tuition value of those lessons.
 * Tutors stay Independent Tutors, so their net and admin fee are not shown.
 */

type RangeKind = "week" | "month";

const RANGES: readonly RangeKind[] = ["week", "month"];

function hkd(amount: number): string {
  return `HK$${Math.round(amount).toLocaleString("en-HK")}`;
}

export function OrganisationLessonsPanel({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeKind>("month");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["organization-lessons", organizationId, range],
    queryFn: () => getOrganisationLessonDashboard({ data: { orgId: organizationId, range } }),
  });
  const rows = (data?.cases ?? []).filter((c) => c.lessonsTaught + c.lessonsScheduled > 0);

  return (
    <section
      aria-labelledby="org-lessons-heading"
      className="rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="org-lessons-heading" className="text-sm font-semibold text-[color:var(--ink)]">
          {t("sor.org_lessons_title")}
        </h3>
        <div role="group" aria-label={t("sor.tutor_earnings_range")} className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                range === r
                  ? "border-[color:var(--ink)] text-[color:var(--ink)]"
                  : "border-[color:var(--ink)]/10 text-muted-foreground",
              )}
            >
              {t(`sor.tutor_earnings_range_${r}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("sor.loading")}</p>
      ) : isError || !data ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("sor.org_lessons_error")}</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">{t("sor.org_lessons_taught")}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[color:var(--ink)]">
                {data.totals.lessonsTaught}
              </dd>
              <dd className="text-[11px] text-muted-foreground">
                {t("sor.tutor_earnings_hours", { n: data.totals.taughtHours })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("sor.org_lessons_scheduled")}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[color:var(--ink)]">
                {data.totals.lessonsScheduled}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("sor.org_lessons_taught_value")}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[color:var(--ink)]">
                {hkd(data.totals.taughtHkd)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("sor.org_lessons_scheduled_value")}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[color:var(--ink)]">
                {hkd(data.totals.scheduledHkd)}
              </dd>
            </div>
          </dl>
          {rows.length > 0 ? (
            <ul className="mt-4 space-y-1.5 border-t border-[color:var(--ink)]/10 pt-3">
              {rows.map((c) => (
                <li
                  key={c.caseId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
                >
                  <span className="text-[color:var(--ink)]">
                    {c.caseCode} · {c.studentLabel}
                  </span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {t("sor.org_lessons_row", {
                      taught: c.lessonsTaught,
                      scheduled: c.lessonsScheduled,
                      value: hkd(c.taughtHkd + c.scheduledHkd),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t("sor.tutor_earnings_empty")}</p>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{t("sor.org_lessons_note")}</p>
    </section>
  );
}
