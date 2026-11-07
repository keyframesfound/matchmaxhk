import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { chipsByHktDay, hktClock } from "@/features/cases/case-schedule";
import type { HubScheduleLesson } from "@/features/cases/case-schedule.functions";
import { hktDateKey } from "@/features/cases/sor";
import { cn } from "@/lib/utils";

import { ScheduleLegend } from "./schedule-legend";

const CHIPS_PER_CELL = 2;

function monthDays(month: Date): Date[] {
  const last = endOfMonth(month);
  const days: Date[] = [];
  let day = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  while (day <= last || days.length % 7 !== 0) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

function useChipLabel() {
  const { t } = useTranslation();
  return (l: HubScheduleLesson) =>
    [
      hktClock(l.startsAt),
      l.subject,
      "·",
      t(l.role === "tutor" ? "case_manager.verified_parent" : "case_manager.verified_tutor"),
    ]
      .filter(Boolean)
      .join(" ");
}

/**
 * #636 Thin Calendar: confirmed lessons as chips in HKT (dots plus a day list
 * on phone). Still a visual shell of case_lessons, not a calendar product.
 */
export function ThinCalendar({
  lessons,
  blockedDates,
  onOpenCase,
}: {
  lessons: readonly HubScheduleLesson[];
  blockedDates: readonly string[];
  onOpenCase: (caseCode: string) => void;
}) {
  const { t } = useTranslation();
  const chipLabel = useChipLabel();
  const todayKey = hktDateKey(new Date());
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const month = addMonths(startOfMonth(new Date()), monthOffset);
  const days = monthDays(month);
  const chips = useMemo(() => chipsByHktDay(lessons), [lessons]);
  const blocked = useMemo(() => new Set(blockedDates), [blockedDates]);
  const selected = chips.get(selectedKey) ?? [];

  return (
    <section
      aria-label={t("case_manager.calendar_aria")}
      className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t("case_manager.prev_month")}
            onClick={() => setMonthOffset((m) => m - 1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t("case_manager.next_month")}
            onClick={() => setMonthOffset((m) => m + 1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {days.slice(0, 7).map((d) => (
          <span key={d.toISOString()}>{format(d, "EEEEE")}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const dayChips = chips.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-11 min-w-0 flex-col gap-1 rounded-lg border border-transparent p-1 sm:min-h-20",
                d.getMonth() !== month.getMonth() && "opacity-40",
                key === selectedKey && "border-border",
                blocked.has(key) && "mm-slot-blocked",
              )}
            >
              <button
                type="button"
                aria-pressed={key === selectedKey}
                aria-label={t("case_manager.day_aria", { date: key, count: dayChips.length })}
                onClick={() => setSelectedKey(key)}
                className={cn(
                  "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs",
                  key === todayKey && "font-bold text-[color:var(--brand-link)]",
                )}
              >
                {format(d, "d")}
              </button>
              {dayChips.length > 0 ? (
                <span
                  aria-hidden
                  className="mm-slot-occupied mx-auto h-1.5 w-1.5 rounded-full sm:hidden"
                />
              ) : null}
              <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {dayChips.slice(0, CHIPS_PER_CELL).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    title={chipLabel(l)}
                    onClick={() => onOpenCase(l.caseCode)}
                    className="mm-slot-occupied truncate rounded px-1 py-0.5 text-left text-[11px]"
                  >
                    {chipLabel(l)}
                  </button>
                ))}
                {dayChips.length > CHIPS_PER_CELL ? (
                  <button
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className="text-left text-[11px] text-muted-foreground hover:underline"
                  >
                    {t("case_manager.more_lessons", { n: dayChips.length - CHIPS_PER_CELL })}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold text-muted-foreground">
          {t("case_manager.day_agenda", { date: selectedKey })}
        </p>
        {selected.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{t("case_manager.day_empty")}</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {selected.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onOpenCase(l.caseCode)}
                  className="mm-slot-occupied w-full rounded-lg px-3 py-2 text-left text-sm"
                >
                  {chipLabel(l)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ScheduleLegend />
    </section>
  );
}
