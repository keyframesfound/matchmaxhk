import { useTranslation } from "react-i18next";

import {
  hktClock,
  hktDayLabel,
  nextLessonFor,
} from "@/features/cases/case-schedule";
import type {
  HubScheduleLesson,
  ProposedItem,
  ScheduleCase,
} from "@/features/cases/case-schedule.functions";

const ENDED = new Set(["closed", "replaced"]);

/** #636: live cases on the hub; each row opens the drawer. */
export function ActiveCaseList({
  cases,
  lessons,
  onOpenCase,
}: {
  cases: readonly ScheduleCase[];
  lessons: readonly HubScheduleLesson[];
  onOpenCase: (caseCode: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const live = cases.filter((c) => !c.sorStatus || !ENDED.has(c.sorStatus));
  if (live.length === 0) return null;
  const dualRole = new Set(live.map((c) => c.role)).size > 1;
  const now = new Date();
  return (
    <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t("case_manager.active_cases")}</h2>
      <ul className="divide-y divide-border">
        {live.map((c) => {
          const next = nextLessonFor(lessons, c.id, now);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onOpenCase(c.code)}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 py-2.5 text-left"
              >
                <span className="text-sm font-semibold">
                  #{c.code}
                  {c.subject ? ` · ${c.subject}` : ""}
                  {dualRole ? (
                    <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                      {t(c.role === "tutor" ? "case_manager.teaching" : "case_manager.learning")}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  {next
                    ? t("case_manager.next_lesson", {
                        day: hktDayLabel(next.startsAt, i18n.language),
                        time: hktClock(next.startsAt),
                      })
                    : t("case_manager.next_lesson_flexible")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** #636: pending requests hold soft slots only; they never paint as lessons. */
export function ProposedList({ items }: { items: readonly ProposedItem[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t("case_manager.proposed_title")}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${item.role}-${item.caseId}`} className="mm-slot-proposed rounded-xl px-3 py-2">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              #{item.caseCode}
              {item.subject ? ` · ${item.subject}` : ""}
              {item.scheduleMode === "flexible" ? (
                <span className="font-normal text-muted-foreground">
                  {t("schedule_state.flexible")}
                </span>
              ) : null}
              {item.scheduleUpdated ? (
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs">
                  {t("schedule_state.updated")}
                </span>
              ) : null}
            </p>
            {item.scheduleUpdated ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  item.role === "tutor"
                    ? "schedule_state.prompt_tutor"
                    : "schedule_state.prompt_parent",
                )}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
