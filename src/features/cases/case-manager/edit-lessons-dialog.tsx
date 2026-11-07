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
import { hktClock, type EditScope } from "@/features/cases/case-schedule";
import {
  editCaseLessons,
  type HubScheduleLesson,
} from "@/features/cases/case-schedule.functions";
import { hktDateKey } from "@/features/cases/sor";

import {
  DURATION_CHOICES_MIN,
  clockToMinute,
  scheduleErrorText,
} from "./schedule-form";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayDeltaBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / DAY_MS);
}

/**
 * #636: either side moves one lesson, several, or the whole series. The first
 * selected lesson anchors the move; the others keep their spacing from it.
 * Contested requests stay on #654.
 */
export function EditLessonsDialog({
  caseId,
  selected,
  open,
  onOpenChange,
  onDone,
}: {
  caseId: string;
  selected: readonly HubScheduleLesson[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const anchor = selected[0];
  const [scope, setScope] = useState<EditScope>(selected.length > 1 ? "selected" : "one");
  const [date, setDate] = useState(() => hktDateKey(new Date(anchor.startsAt)));
  const [time, setTime] = useState(() => hktClock(anchor.startsAt));
  const [durationMin, setDurationMin] = useState(anchor.durationMin);

  const save = useMutation({
    mutationFn: () => {
      const minuteOfDay = clockToMinute(time);
      if (minuteOfDay === null) throw new Error("BAD_TIME");
      return editCaseLessons({
        data: {
          caseId,
          scope,
          lessonIds: selected.map((l) => l.id),
          dayDelta: dayDeltaBetween(hktDateKey(new Date(anchor.startsAt)), date),
          minuteOfDay,
          durationMin,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(
        result.failed > 0
          ? t("case_manager.edit_done_partial", { n: result.updated, failed: result.failed })
          : t("case_manager.edit_done", { n: result.updated }),
      );
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(scheduleErrorText(t, e.message)),
  });

  const scopes: EditScope[] = [
    selected.length === 1 ? "one" : "selected",
    ...(anchor.seriesId ? (["series"] as const) : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("case_manager.edit_title")}</DialogTitle>
          <DialogDescription>{t("case_manager.edit_hint")}</DialogDescription>
        </DialogHeader>
        {scopes.length > 1 ? (
          <fieldset className="grid gap-1.5 text-sm">
            <legend className="text-xs text-muted-foreground">
              {t("case_manager.edit_scope")}
            </legend>
            {scopes.map((value) => (
              <label key={value} className="flex min-h-10 items-center gap-2">
                <input
                  type="radio"
                  name="edit-scope"
                  checked={scope === value}
                  onChange={() => setScope(value)}
                />
                {t(`case_manager.edit_scope_${value}`, { n: selected.length })}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("sor.schedule_next_date")}
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
              {[...new Set([...DURATION_CHOICES_MIN, anchor.durationMin])]
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {t("sor.schedule_next_minutes", { n: m })}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("sor.admin_cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("case_manager.edit_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
