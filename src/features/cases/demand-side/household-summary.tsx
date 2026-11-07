import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getMyHouseholdSummary } from "@/features/cases/demand-side/demand-side.functions";

const hktFormatter = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Hong_Kong",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** #637: what's on for the household. Hidden until a case is running. */
export function HouseholdSummary() {
  const { t, i18n } = useTranslation();
  const { data } = useQuery({
    queryKey: ["household-summary"],
    queryFn: () => getMyHouseholdSummary(),
    staleTime: 60_000,
  });
  if (!data || data.length === 0) return null;
  const format = hktFormatter(i18n.language);
  return (
    <section
      className="mt-6 rounded-2xl border border-border bg-card p-4"
      data-testid="household-summary"
    >
      <h2 className="text-base font-bold text-[color:var(--ink)]">
        {t("demand_side.household_summary")}
      </h2>
      <ul className="mt-2 divide-y divide-border">
        {data.map((row) => (
          <li key={row.caseId}>
            <Link
              to="/account/cases/$caseId"
              params={{ caseId: row.caseId }}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm hover:underline"
            >
              <span className="min-w-0 font-medium text-[color:var(--ink)]">
                {[row.studentName, row.subject, row.tutorName].filter(Boolean).join(" · ")}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {row.primaryGoal || row.targetGrade ? (
                  <span className="rounded-full border border-border px-2 py-0.5 font-semibold text-[color:var(--ink)]">
                    {row.targetGrade || t(`demand_side.goal_${row.primaryGoal}`)}
                  </span>
                ) : null}
                {row.nextLessonAt
                  ? t("demand_side.next_lesson", {
                      when: format.format(new Date(row.nextLessonAt)),
                    })
                  : t("demand_side.next_lesson_none")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
