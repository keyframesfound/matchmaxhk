import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { hktClock, hktDayLabel } from "@/features/cases/case-schedule";
import { fetchCaseLessonLogs } from "@/features/cases/lesson-log.functions";
import { cn } from "@/lib/utils";

/**
 * Topic chips reuse the heatmap's mastery tokens so a lesson log and the
 * mastery surface above it read as one system. DESIGN.md AA floor: the label
 * stays ink and the band rides on the border + wash, because brand or
 * destructive text at 12px on a 10% tint misses AA.
 */
function chipClass(mastery: string | null): string {
  switch (mastery) {
    case "weak":
      return "border-destructive/40 bg-destructive/10 text-[color:var(--ink)]";
    case "practicing":
      return "border-border bg-muted text-[color:var(--ink)]";
    case "mastered":
      return "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/10 text-[color:var(--ink)]";
    default:
      return "border-border bg-transparent text-muted-foreground";
  }
}

/**
 * #796 §2.5 Lesson log. A read-only feed of what the tutor logged in the
 * Super-Drawer, newest first in server order. The server returns `null` for a
 * caller who is not a party, and this renders nothing at all — the Super-Drawer
 * stays the only place a lesson is written.
 */
export function LessonLogSection({ caseId }: { caseId: string }) {
  const { t, i18n } = useTranslation();

  const { data } = useQuery({
    queryKey: ["case-lesson-logs", caseId],
    queryFn: () => fetchCaseLessonLogs({ data: { caseId } }),
  });

  if (!data) return null;

  return (
    <section className="mt-4 space-y-2">
      <h2 className="text-sm font-semibold text-[color:var(--ink)]">{t("lesson_log.title")}</h2>

      {data.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("lesson_log.empty")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-panel)] border border-border">
          {data.rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:justify-between"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  {t("lesson_log.lesson_n", { n: row.lessonNumber })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hktDayLabel(row.startsAt, i18n.language)}, {hktClock(row.startsAt)} ·{" "}
                  {t("sor.schedule_next_minutes", { n: row.durationMin })}
                </p>
              </div>

              <div className="space-y-1 sm:max-w-[55%] sm:text-right">
                {row.hoursOnly ? (
                  <p className="text-xs italic text-muted-foreground">
                    {t("lesson_log.hours_logged")}
                  </p>
                ) : row.topics.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5 sm:justify-end">
                    {row.topics.map((topic) => (
                      <li
                        key={topic.tag}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium [overflow-wrap:anywhere]",
                          chipClass(topic.mastery),
                        )}
                      >
                        {topic.tag}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!row.hoursOnly && row.pulseKeys.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {row.pulseKeys.map((key) => t(key)).join(" · ")}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
