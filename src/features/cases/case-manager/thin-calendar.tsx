import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { chipsByHktDay, hktClock } from "@/features/cases/case-schedule";
import type { HubScheduleLesson } from "@/features/cases/case-schedule.functions";
import { hktDateKey } from "@/features/cases/sor";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import { ScheduleLegend } from "./schedule-legend";

const CHIPS_PER_CELL = 2;

/** Week starts Monday, matching the month grid's padding. */
const WEEK_START = { weekStartsOn: 1 } as const;

const WEEKDAY_KEYS = [
  "weekday_mon",
  "weekday_tue",
  "weekday_wed",
  "weekday_thu",
  "weekday_fri",
  "weekday_sat",
  "weekday_sun",
] as const;

type ViewMode = "month" | "week";

function monthDays(month: Date): Date[] {
  const last = endOfMonth(month);
  const days: Date[] = [];
  let day = startOfWeek(startOfMonth(month), WEEK_START);
  while (day <= last || days.length % 7 !== 0) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function useChipLabel() {
  const { t } = useTranslation();
  return (l: HubScheduleLesson) =>
    [
      hktClock(l.startsAt),
      l.subject,
      "·",
      t(l.role === "tutor" ? "case_manager.verified_parent" : "case_manager.verified_tutor"),
      l.reschedulePending ? `· ${t("billing.pending_badge")}` : null,
    ]
      .filter(Boolean)
      .join(" ");
}

/**
 * #636 / #785 2.1 Thin Calendar: confirmed lessons as chips in HKT. A light
 * schedule view of case_lessons only — never an availability or booking
 * surface. Month is the default with room for chips (≥768px, so Mac ≥1024px
 * included); phones (<768px) default to Week, and a Month / Week toggle keeps
 * either reachable at any width. Month keeps dots plus the selected-day
 * agenda on phone; Week lists each HKT day with its lesson chips.
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
  const { t, i18n } = useTranslation();
  const chipLabel = useChipLabel();
  const isPhone = useIsMobile();
  const todayKey = hktDateKey(new Date());
  const [viewChoice, setViewChoice] = useState<ViewMode | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const chips = useMemo(() => chipsByHktDay(lessons), [lessons]);
  const blocked = useMemo(() => new Set(blockedDates), [blockedDates]);

  // HKT calendar date, carried as a local Date so labels never shift by zone.
  const today = useMemo(() => parseISO(todayKey), [todayKey]);
  const mode: ViewMode = viewChoice ?? (isPhone ? "week" : "month");
  const month = addMonths(startOfMonth(today), monthOffset);
  const weekStart = startOfWeek(addWeeks(today, weekOffset), WEEK_START);
  const selected = chips.get(selectedKey) ?? [];

  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }),
    [i18n.language],
  );
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric" }),
    [i18n.language],
  );
  const weekEndFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric", year: "numeric" }),
    [i18n.language],
  );
  const weekHeading = `${dayFmt.format(weekStart)} – ${weekEndFmt.format(addDays(weekStart, 6))}`;
  const heading = mode === "week" ? weekHeading : monthFmt.format(month);
  const days = useMemo(() => monthDays(month), [month]);
  const goPrev = () =>
    mode === "week" ? setWeekOffset((w) => w - 1) : setMonthOffset((m) => m - 1);
  const goNext = () =>
    mode === "week" ? setWeekOffset((w) => w + 1) : setMonthOffset((m) => m + 1);

  return (
    <section
      aria-label={t(mode === "week" ? "case_manager.week_aria" : "case_manager.calendar_aria")}
      className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold">{heading}</p>
          {mode === "week" && weekOffset !== 0 ? (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="text-xs font-semibold text-[color:var(--brand-link)] hover:underline"
            >
              {t("case_manager.this_week")}
            </button>
          ) : null}
        </div>
        <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end">
          <div
            role="group"
            aria-label={t("case_manager.view_toggle_aria")}
            className="flex rounded-full border border-border p-0.5"
          >
            {(["month", "week"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setViewChoice(m)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs",
                  mode === m
                    ? "bg-[color:var(--foreground)]/[0.08] font-semibold text-[color:var(--ink)]"
                    : "text-muted-foreground",
                )}
              >
                {t(m === "week" ? "case_manager.view_week" : "case_manager.view_month")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t(mode === "week" ? "case_manager.prev_week" : "case_manager.prev_month")}
              onClick={goPrev}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t(mode === "week" ? "case_manager.next_week" : "case_manager.next_month")}
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {mode === "week" ? (
        <ol className="space-y-1.5">
          {weekDays(weekStart).map((d, i) => {
            const key = format(d, "yyyy-MM-dd");
            const dayChips = chips.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <li
                key={key}
                className={cn(
                  "rounded-lg border border-border p-2",
                  isToday && "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/5",
                  blocked.has(key) && "mm-slot-blocked",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold">
                    {t(`case_manager.${WEEKDAY_KEYS[i]}`)}{" "}
                    <span className="font-normal text-muted-foreground">{dayFmt.format(d)}</span>
                  </p>
                  {isToday ? (
                    <span className="text-[11px] font-semibold text-[color:var(--brand-link)]">
                      {t("case_manager.today_label")}
                    </span>
                  ) : null}
                </div>
                {dayChips.length === 0 ? (
                  <p aria-hidden className="mt-1 text-xs text-muted-foreground">
                    —
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {dayChips.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          title={chipLabel(l)}
                          onClick={() => onOpenCase(l.caseCode)}
                          className={cn(
                            l.reschedulePending ? "mm-slot-proposed" : "mm-slot-occupied",
                            "flex min-h-10 w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs",
                          )}
                        >
                          {chipLabel(l)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <>
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
                        className={cn(
                          l.reschedulePending ? "mm-slot-proposed" : "mm-slot-occupied",
                          "truncate rounded px-1 py-0.5 text-left text-[11px]",
                        )}
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
                      className={cn(
                        l.reschedulePending ? "mm-slot-proposed" : "mm-slot-occupied",
                        "w-full rounded-lg px-3 py-2 text-left text-sm",
                      )}
                    >
                      {chipLabel(l)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      <ScheduleLegend />
    </section>
  );
}
