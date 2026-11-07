import { X } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleLegend } from "@/features/cases/case-manager/schedule-legend";
import { FULL_FIT, type ClashLine, type FitSchedule } from "@/features/cases/schedule-fit";
import type { ScheduleSync } from "@/features/cases/use-schedule-fit";
import { AVAIL_BANDS } from "@/features/tutors/availability-filter";
import { GRID_DAYS } from "@/features/tutors/availability-grid-model";
import { cn } from "@/lib/utils";

/**
 * #659 / #660: the shared Schedule Fit chrome. Colors come from the #636
 * .mm-slot-* tokens and labels from schedule_state.*, so no surface grows its
 * own legend.
 */

export type ScheduleSyncValue = { sync: ScheduleSync | null; isLoading: boolean } | null;

/** Lets the shared Availability filter show the synced grid where it is provided. */
export const ScheduleSyncContext = createContext<ScheduleSyncValue>(null);

export function useScheduleSyncContext(): ScheduleSyncValue {
  return useContext(ScheduleSyncContext);
}

/** Schedule Match (parent) and Schedule Fit (tutor) are one badge family. */
export function ScheduleFitBadge({
  kind,
  score,
  className,
}: {
  kind: "match" | "fit";
  score: number | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!score) return null;
  return (
    <span
      className={cn(
        "mm-slot-open inline-flex w-fit max-w-full items-center rounded-md px-2 py-1 text-xs font-semibold text-[color:var(--ink)]",
        className,
      )}
    >
      {score >= FULL_FIT
        ? t(`schedule_fit.badge_${kind}_full`)
        : t(`schedule_fit.badge_${kind}_pct`, { n: score })}
    </span>
  );
}

function slotState(key: string, schedule: FitSchedule): "occupied" | "proposed" | "blocked" | null {
  if (schedule.occupied.some((o) => o.key === key)) return "occupied";
  if (schedule.blocked.has(key)) return "blocked";
  return schedule.proposed.some((p) => p.key === key) ? "proposed" : null;
}

/** The token class a grid cell wears while it is not chosen. */
export function slotStateClass(key: string, schedule: FitSchedule | null): string | null {
  const state = schedule ? slotState(key, schedule) : null;
  return state ? `mm-slot-${state}` : null;
}

export function slotStateLabelKey(key: string, schedule: FitSchedule | null): string | null {
  const state = schedule ? slotState(key, schedule) : null;
  return state ? `schedule_state.${state}` : null;
}

function ScheduleSlotGrid({ sync }: { sync: ScheduleSync }) {
  const { t } = useTranslation();
  return (
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
          {AVAIL_BANDS.map((band) => (
            <tr key={band}>
              <th className="pr-2 text-left font-semibold text-muted-foreground">
                {t(`case_intake.period_${band}`)}
              </th>
              {GRID_DAYS.map((day) => {
                const key = `${day}-${band}`;
                const on = sync.open.has(key);
                const state = slotState(key, sync.schedule);
                const stateLabel = state ? t(`schedule_state.${state}`) : null;
                const selected = on && state !== "proposed";
                return (
                  <td key={key} className="p-0.5">
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={[
                        t(`case_intake.day_${day}`),
                        t(`case_intake.period_${band}`),
                        stateLabel,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={stateLabel ?? undefined}
                      onClick={() => sync.toggle(key)}
                      className={cn(
                        "h-8 w-9 rounded-md border border-border",
                        selected ? "mm-slot-open" : state ? `mm-slot-${state}` : null,
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
  );
}

/** Banner, Reset and the session grid. Toggles here never reach Case Manager. */
export function ScheduleSyncPanel({
  sync,
  isLoading = false,
  collapsible = false,
  banner,
}: {
  sync: ScheduleSync | null;
  isLoading?: boolean;
  collapsible?: boolean;
  banner?: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!collapsible);
  if (isLoading) return <Skeleton className="h-16 w-full rounded-md" />;
  if (!sync) return null;
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          {banner ?? t("schedule_fit.sync_banner")}
        </p>
        <div className="flex shrink-0 gap-1">
          {sync.edited ? (
            <Button type="button" size="sm" variant="ghost" onClick={sync.reset}>
              {t("schedule_fit.reset")}
            </Button>
          ) : null}
          {collapsible ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {t("schedule_fit.edit")}
            </Button>
          ) : null}
        </div>
      </div>
      {expanded ? (
        <>
          <ScheduleSlotGrid sync={sync} />
          <ScheduleLegend />
        </>
      ) : null}
    </div>
  );
}

function ClashLineText({ line, flow }: { line: ClashLine; flow: "request" | "apply" }) {
  const { t } = useTranslation();
  const day = t(`case_intake.day_${line.day}`);
  const when = `${day} ${line.clock ?? t(`case_intake.period_${line.period}`)}`;
  if (line.state === "blocked") return <>{t("schedule_fit.line_blocked", { when })}</>;
  if (!line.title) return <>{t("schedule_fit.line_generic", { when })}</>;
  if (line.state === "occupied") {
    return <>{t("schedule_fit.line_occupied", { when, title: line.title })}</>;
  }
  return <>{t(`schedule_fit.line_proposed_${flow}`, { when, title: line.title })}</>;
}

/** The soft reminder: centered on desktop, a bottom sheet on phones. Never blocks. */
export function ScheduleClashDialog({
  open,
  flow,
  lines,
  pending = false,
  onBack,
  onProceed,
}: {
  open: boolean;
  flow: "request" | "apply";
  lines: readonly ClashLine[];
  pending?: boolean;
  onBack: () => void;
  onProceed: () => void;
}) {
  const { t } = useTranslation();
  const named = lines.some((line) => line.title);
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onBack())}>
      <DialogContent
        showCloseButton={false}
        className="max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none"
      >
        <DialogClose
          aria-label={t("schedule_fit.close")}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" aria-hidden />
        </DialogClose>
        <DialogHeader>
          <DialogTitle>{t("schedule_fit.clash_title")}</DialogTitle>
          <DialogDescription>
            {named ? t(`schedule_fit.intro_${flow}`) : t(`schedule_fit.body_${flow}`)}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-[color:var(--ink)]">
          {lines.map((line, index) => (
            <li key={`${line.day}-${line.period}-${index}`} className="flex items-start gap-2">
              <span
                aria-hidden
                title={t(`schedule_state.${line.state}`)}
                className={`mm-slot-${line.state} mt-1 h-3 w-3 shrink-0 rounded-[4px]`}
              />
              <span>
                <ClashLineText line={line} flow={flow} />
              </span>
            </li>
          ))}
        </ul>
        {flow === "request" ? (
          <p className="text-sm text-muted-foreground">{t("schedule_fit.outro_request")}</p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onBack}>
            {flow === "request" ? t("schedule_fit.cta_edit") : t("schedule_fit.cta_back")}
          </Button>
          <Button type="button" disabled={pending} onClick={onProceed}>
            {flow === "request" ? t("schedule_fit.cta_proceed") : t("schedule_fit.cta_apply")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
