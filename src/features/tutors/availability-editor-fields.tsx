import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GRID_DAYS,
  GRID_SLOTS,
  countAvailableCells,
  emptyAvailabilityGrid,
  gridSlotLabel,
  type GridCellState,
  type GridDay,
} from "@/features/tutors/availability-grid-model";
import { PREFERRED_TIME_WINDOWS, type PreferredTimeWindow } from "@/features/tutors/queries";
import { cn } from "@/lib/utils";

/**
 * Issue #103 capacity fields (accepting toggle, open slots, preferred time
 * windows) as one controlled block, shared by the tutor's Dashboard →
 * Availability card and the admin TutorEditor so both stay in lockstep. The
 * parent owns state and dirty tracking; this component only renders.
 */

const TIME_WINDOW_LABEL_KEYS: Record<PreferredTimeWindow, string> = {
  weekday_afternoon: "settings.capacity.window_weekday_afternoon",
  weekday_evening: "settings.capacity.window_weekday_evening",
  weekend_morning: "settings.capacity.window_weekend_morning",
  weekend_afternoon: "settings.capacity.window_weekend_afternoon",
};

export type CapacityValue = {
  acceptingStudents: boolean;
  openSlots: number;
  timeWindows: PreferredTimeWindow[];
};

export function CapacityEditorFields({
  value,
  onChange,
}: {
  value: CapacityValue;
  onChange: (next: CapacityValue) => void;
}) {
  const { t } = useTranslation();
  const { acceptingStudents, openSlots, timeWindows } = value;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Label className="text-[color:var(--ink)]">{t("settings.capacity.accepting_label")}</Label>
        <button
          type="button"
          role="switch"
          aria-checked={acceptingStudents}
          onClick={() => onChange({ ...value, acceptingStudents: !acceptingStudents })}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40",
            acceptingStudents
              ? "border-[color:var(--ink)] bg-[color:var(--ink)]"
              : "border-[color:var(--ink)]/25 bg-transparent",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4.5 w-4.5 rounded-full transition-[left] duration-150",
              acceptingStudents
                ? "left-[1.375rem] bg-[color:var(--surface)]"
                : "left-0.5 bg-[color:var(--ink)]/40",
            )}
          />
          <span className="sr-only">
            {acceptingStudents
              ? t("settings.capacity.state_active")
              : t("settings.capacity.state_paused")}
          </span>
        </button>
      </div>
      <p className="text-xs font-semibold text-[color:var(--ink)]/70">
        {acceptingStudents
          ? t("settings.capacity.state_active")
          : t("settings.capacity.state_paused")}
      </p>

      <div className="space-y-2">
        <Label htmlFor="capacity-slots-input" className="text-[color:var(--ink)]">
          {t("settings.capacity.slots_label")}
        </Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            aria-label={t("settings.capacity.slots_decrease")}
            disabled={openSlots <= 0}
            onClick={() => onChange({ ...value, openSlots: Math.max(0, openSlots - 1) })}
            className="h-10 w-10 shrink-0 p-0 text-base font-bold"
          >
            −
          </Button>
          <Input
            id="capacity-slots-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={openSlots}
            onChange={(event) => {
              const raw = Number(event.target.value);
              if (!Number.isFinite(raw)) return;
              onChange({ ...value, openSlots: Math.min(99, Math.max(0, Math.round(raw))) });
            }}
            className="h-10 w-20 bg-[color:var(--surface)] text-center font-bold tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            aria-label={t("settings.capacity.slots_increase")}
            disabled={openSlots >= 99}
            onClick={() => onChange({ ...value, openSlots: Math.min(99, openSlots + 1) })}
            className="h-10 w-10 shrink-0 p-0 text-base font-bold"
          >
            +
          </Button>
          <span className="text-xs text-[color:var(--ink)]/55">
            {openSlots === 0
              ? t("settings.capacity.slots_full")
              : t("settings.capacity.slots_hint")}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[color:var(--ink)]">{t("settings.capacity.windows_label")}</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PREFERRED_TIME_WINDOWS.map((window) => {
            const checked = timeWindows.includes(window);
            return (
              <label
                key={window}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] transition-colors hover:bg-[color:var(--ink)]/[0.04]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[color:var(--ink)]"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      ...value,
                      timeWindows: checked
                        ? timeWindows.filter((w) => w !== window)
                        : [...timeWindows, window],
                    })
                  }
                />
                <span>{t(TIME_WINDOW_LABEL_KEYS[window])}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-[color:var(--ink)]/55">{t("settings.capacity.windows_hint")}</p>
      </div>
    </div>
  );
}

/**
 * Issue #116 weekly availability grid, editable variant — tap a cell to cycle
 * available → partial → unavailable. Shared by the tutor's grid editor and the
 * admin TutorEditor; the read-only public display lives in availability-grid.tsx.
 */

const STATE_CYCLE: Record<GridCellState, GridCellState> = { a: "p", p: "u", u: "a" };

const STATE_CELL_CLASS: Record<GridCellState, string> = {
  a: "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85",
  p: "border-[color:var(--brand-link)]/25 bg-[color:var(--brand-link)]/30",
  u: "border-border bg-muted/50",
};

const STATE_LABEL_KEYS: Record<GridCellState, string> = {
  a: "profile.grid_cell_available",
  p: "profile.grid_cell_partial",
  u: "profile.grid_cell_unavailable",
};

export function EditableAvailabilityGrid({
  grid,
  onChange,
}: {
  grid: Record<GridDay, GridCellState[]>;
  onChange: (next: Record<GridDay, GridCellState[]>) => void;
}) {
  const { t } = useTranslation();

  const cycleCell = (day: GridDay, slotIndex: number) => {
    const next = emptyAvailabilityGrid();
    for (const d of GRID_DAYS) next[d] = [...grid[d]];
    next[day][slotIndex] = STATE_CYCLE[next[day][slotIndex]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <table
          className="w-full min-w-[560px] border-separate border-spacing-1 text-center"
          aria-label={t("settings.grid.editor_aria")}
        >
          <thead>
            <tr>
              <th scope="col" className="w-[24%]" />
              {GRID_DAYS.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="pb-1 text-xs font-bold text-[color:var(--ink)] sm:text-sm"
                >
                  {t(`profile.grid_day_${day}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRID_SLOTS.map((slot, slotIndex) => (
              <tr key={slot}>
                <th
                  scope="row"
                  className="pr-2 text-left text-[11px] leading-tight font-medium whitespace-nowrap text-muted-foreground sm:text-xs"
                >
                  {gridSlotLabel(slot, t)}
                </th>
                {GRID_DAYS.map((day) => {
                  const state = grid[day][slotIndex];
                  return (
                    <td key={day} className="h-9">
                      <button
                        type="button"
                        aria-label={`${t(`profile.grid_day_${day}`)} ${gridSlotLabel(slot, t)}: ${t(STATE_LABEL_KEYS[state])}`}
                        onClick={() => cycleCell(day, slotIndex)}
                        className={cn(
                          "h-9 w-full cursor-pointer rounded-[4px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                          STATE_CELL_CLASS[state],
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

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[color:var(--ink)]/60">
        {(["a", "p", "u"] as const).map((state) => (
          <span key={state} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("inline-block h-3 w-3 rounded-[3px] border", STATE_CELL_CLASS[state])}
            />
            {t(STATE_LABEL_KEYS[state])}
          </span>
        ))}
        <span className="ml-auto">{t("settings.grid.tap_hint")}</span>
      </div>

      {countAvailableCells(grid) === 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t("settings.grid.empty_hint")}
        </p>
      ) : null}
    </div>
  );
}
