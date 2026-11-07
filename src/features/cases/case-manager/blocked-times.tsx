import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { setMyBlockedSlot } from "@/features/cases/case-schedule.functions";
import type { PrefSlot } from "@/features/cases/case-schedule";
import { AVAIL_BANDS, type AvailBand } from "@/features/tutors/availability-filter";
import { GRID_DAYS, type GridDay } from "@/features/tutors/availability-grid-model";
import { cn } from "@/lib/utils";

/**
 * #659: the parent's User-Blocked master. This is the one place that writes it;
 * search and case-posting edits stay session-only.
 */
export function BlockedTimes({ slots }: { slots: readonly PrefSlot[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const blocked = new Set(slots.map((s) => `${s.day}-${s.period}`));
  const toggle = useMutation({
    mutationFn: (input: { day: GridDay; period: AvailBand; blocked: boolean }) =>
      setMyBlockedSlot({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["case-manager-schedule"] }),
    onError: () => toast.error(t("schedule_fit.blocked_error")),
  });
  return (
    <section className="space-y-3 rounded-[var(--radius-panel)] border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">{t("schedule_fit.blocked_title")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("schedule_fit.blocked_help")}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th />
              {GRID_DAYS.map((day) => (
                <th key={day} className="px-1 pb-1 font-semibold text-muted-foreground">
                  {t(`case_intake.day_${day}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AVAIL_BANDS.map((period) => (
              <tr key={period}>
                <th className="pr-2 text-left font-semibold text-muted-foreground">
                  {t(`case_intake.period_${period}`)}
                </th>
                {GRID_DAYS.map((day) => {
                  const on = blocked.has(`${day}-${period}`);
                  return (
                    <td key={day} className="p-0.5">
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={`${t(`case_intake.day_${day}`)} ${t(`case_intake.period_${period}`)}${on ? ` ${t("schedule_state.blocked")}` : ""}`}
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ day, period, blocked: !on })}
                        className={cn(
                          "h-8 w-9 rounded-md border border-border disabled:opacity-60",
                          on && "mm-slot-blocked",
                        )}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
