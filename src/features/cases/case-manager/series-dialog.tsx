import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SERIES_WEEK_CHOICES } from "@/features/cases/case-schedule";
import {
  scheduleLessonSeries,
  type ScheduleCase,
} from "@/features/cases/case-schedule.functions";
import { hktDateKey } from "@/features/cases/sor";
import { cn } from "@/lib/utils";

import {
  DURATION_CHOICES_MIN,
  minuteToClock,
  clockToMinute,
  scheduleErrorText,
} from "./schedule-form";

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DEFAULT_MINUTE = 18 * 60;
const DEFAULT_DURATION = 60;
const DEFAULT_WEEKS = 8;

/**
 * #636: the easy recurring fill. Pre-filled from the case's latest lesson; a
 * case stores no exact agreed time, so one party confirms the pattern here.
 */
export function SeriesDialog({
  scheduleCase,
  open,
  onOpenChange,
  onDone,
}: {
  scheduleCase: ScheduleCase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const prefill = scheduleCase.prefill;
  const [firstDate, setFirstDate] = useState(prefill?.firstDateKey ?? hktDateKey(new Date()));
  const [weekdays, setWeekdays] = useState<number[]>(prefill ? [prefill.weekday] : []);
  const [time, setTime] = useState(minuteToClock(prefill?.minuteOfDay ?? DEFAULT_MINUTE));
  const [durationMin, setDurationMin] = useState(prefill?.durationMin ?? DEFAULT_DURATION);
  const [weeks, setWeeks] = useState<number>(DEFAULT_WEEKS);
  // One id per dialog session: a double-tap cannot create the series twice.
  const [seriesId, setSeriesId] = useState(() => crypto.randomUUID());

  const save = useMutation({
    mutationFn: () => {
      const minuteOfDay = clockToMinute(time);
      if (minuteOfDay === null) throw new Error("BAD_TIME");
      return scheduleLessonSeries({
        data: {
          caseId: scheduleCase.id,
          seriesId,
          firstDateKey: firstDate,
          weekdays,
          minuteOfDay,
          durationMin,
          weeks,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(
        result.skipped.length > 0
          ? t("case_manager.series_added_skipped", {
              n: result.created,
              skipped: result.skipped.length,
            })
          : t("case_manager.series_added", { n: result.created }),
      );
      setSeriesId(crypto.randomUUID());
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(scheduleErrorText(t, e.message)),
  });

  const toggleDay = (day: number) =>
    setWeekdays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("case_manager.series_title")}</DialogTitle>
          <DialogDescription>{t("case_manager.series_hint")}</DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-1.5">
          <legend className="text-xs text-muted-foreground">{t("case_manager.series_days")}</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {WEEKDAY_KEYS.map((key, day) => (
              <button
                key={key}
                type="button"
                aria-pressed={weekdays.includes(day)}
                onClick={() => toggleDay(day)}
                className={cn(
                  "h-10 min-w-10 rounded-full border border-border px-3 text-sm",
                  weekdays.includes(day) && "mm-slot-occupied",
                )}
              >
                {t(`case_manager.weekday_${key}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("case_manager.series_first_date")}
            <Input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("sor.schedule_next_time")}
            <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("sor.schedule_next_duration")}
            <select
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-[color:var(--ink)]"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            >
              {DURATION_CHOICES_MIN.map((m) => (
                <option key={m} value={m}>
                  {t("sor.schedule_next_minutes", { n: m })}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("case_manager.series_weeks")}
            <select
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-[color:var(--ink)]"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              {SERIES_WEEK_CHOICES.map((w) => (
                <option key={w} value={w}>
                  {t("case_manager.series_weeks_n", { n: w })}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("sor.admin_cancel")}
          </Button>
          <Button disabled={save.isPending || weekdays.length === 0} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("case_manager.series_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
