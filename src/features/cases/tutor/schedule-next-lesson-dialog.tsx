import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2 } from "lucide-react";
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
import { hktDateKey, hktFromParts } from "@/features/cases/sor";
import { SCHEDULABLE_SOR_STATUSES, isTimeClashError } from "@/features/cases/schedule-lesson";
import { scheduleNextLesson } from "@/features/cases/schedule-lesson.functions";

/**
 * Issue #461 Phase A 3c — "Schedule next lesson" on the tutor case card.
 * One slot only (no recurrence, no calendar grid). The parent then confirms
 * the lesson through the existing dual-confirm flow.
 */

const DURATION_CHOICES_MIN = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

type Props = { caseId: string; sorStatus: string | null };

export function ScheduleNextLessonDialog({ caseId, sorStatus }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => hktDateKey(new Date()));
  const [time, setTime] = useState("18:00");
  const [durationMin, setDurationMin] = useState(60);
  const [location, setLocation] = useState("");
  // One key per dialog session: a double-tap reuses it, a new open gets a new one.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const schedule = useMutation({
    mutationFn: () => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(time);
      if (!match) throw new Error("BAD_TIME");
      const minute = Number(match[1]) * 60 + Number(match[2]);
      return scheduleNextLesson({
        data: {
          caseId,
          startsAtIso: hktFromParts(date, minute).toISOString(),
          durationMin,
          locationOrLink: location.trim() || undefined,
          clientRequestId: requestId,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("sor.schedule_next_success"));
      setOpen(false);
      setRequestId(crypto.randomUUID());
      void queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });
      void queryClient.invalidateQueries({ queryKey: ["sor", "earnings"] });
    },
    onError: (e) =>
      toast.error(
        isTimeClashError(e.message)
          ? t("sor.err_TIME_CLASH")
          : t(`sor.schedule_next_err_${e.message}`, { defaultValue: e.message }),
      ),
  });

  if (!sorStatus || !SCHEDULABLE_SOR_STATUSES.has(sorStatus)) return null;

  return (
    <>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        {t("sor.schedule_next_open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sor.schedule_next_title")}</DialogTitle>
            <DialogDescription>{t("sor.schedule_next_hint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("sor.schedule_next_date")}
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("sor.schedule_next_time")}
              <Input
                type="time"
                step={900}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
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
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("sor.schedule_next_location")}
            <Input value={location} maxLength={300} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("sor.admin_cancel")}
            </Button>
            <Button disabled={schedule.isPending} onClick={() => schedule.mutate()}>
              {schedule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("sor.schedule_next_submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
