import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ConsolePanel } from "@/components/ui/console-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyWeekView } from "@/features/cases/tutor.functions";
import { cn } from "@/lib/utils";

/**
 * #204 tutor week view: the next 14 days of booked lessons (status pills) and
 * open derived slots (muted), grouped by HKT calendar day. Read-only, lesson
 * actions live in the cases block.
 */
export function TutorWeekView() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["sor", "tutor-week"],
    queryFn: getMyWeekView,
  });

  return (
    <ConsolePanel title={t("sor.tutor_week_title")}>
      {isLoading ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : !data || data.days.every((d) => d.lessons.length === 0 && d.openSlots.length === 0) ? (
        <p className="p-4 text-sm text-muted-foreground">{t("sor.tutor_week_empty")}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--ink)]/10">
          {data.days
            .filter((d) => d.lessons.length > 0 || d.openSlots.length > 0)
            .map((day) => (
              <li key={day.dateKey} className="px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {format(new Date(`${day.dateKey}T00:00:00Z`), "EEE d MMM")}
                </p>
                <ul className="mt-2 space-y-1">
                  {day.lessons.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-sm">
                      <CalendarClock
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="font-medium text-[color:var(--ink)]">
                        {format(new Date(l.starts_at), "HH:mm")}
                      </span>
                      <span className="text-muted-foreground">
                        {l.student} · {l.case_code}
                        {l.station ? ` · ${l.station}` : ""}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          l.status === "confirmed"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : l.status === "done"
                              ? "bg-[color:var(--foreground)]/[0.06] text-muted-foreground"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {t(`sor.tutor_lesson_status_${l.status}`)}
                      </span>
                    </li>
                  ))}
                  {day.openSlots.map((s) => (
                    <li
                      key={s.startsAt.toISOString()}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{format(s.startsAt, "HH:mm")}</span>
                      <span className="text-xs">{t("sor.tutor_open_slot")}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ul>
      )}
    </ConsolePanel>
  );
}
