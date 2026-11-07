import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { hktClock, hktDayLabel, nextLiveStart } from "@/features/cases/case-schedule";

/**
 * #636: Next Lesson plus the deep link into Case Manager, for case cards.
 * Flexible or unscheduled cases show the to-be-scheduled state instead.
 */
export function NextLessonLine({
  caseCode,
  lessons,
}: {
  caseCode: string;
  lessons: readonly { starts_at: string; status: string }[];
}) {
  const { t, i18n } = useTranslation();
  const next = nextLiveStart(lessons, new Date());
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span>
        {next
          ? t("case_manager.next_lesson", {
              day: hktDayLabel(next, i18n.language),
              time: hktClock(next),
            })
          : t("case_manager.next_lesson_flexible")}
      </span>
      <Link
        to="/calendar"
        search={{ case: caseCode }}
        className="font-semibold text-[color:var(--brand-link)] hover:underline"
      >
        {next ? t("case_manager.open_in_manager") : t("case_manager.schedule_next")}
      </Link>
    </p>
  );
}
