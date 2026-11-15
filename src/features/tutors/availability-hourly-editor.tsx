import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  GRID_DAYS,
  HOURLY_GRID_HOURS,
  HOURLY_GRID_START_HOUR,
  hourlyHourLabel,
  hourlyRangeLabel,
  type GridDay,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";
import { cn } from "@/lib/utils";

/**
 * Issue #768 (slice 1): the Dashboard → Availability hourly editor.
 *
 * Click-and-drag across the grid to paint recurring Open hours, PLUS the
 * accessibility-lock non-drag equivalent: a single click/tap toggles a cell
 * and every cell is a real <button> (Tab + Enter/Space toggles — a keyboard
 * click arrives with detail === 0, which skips the drag path). Touch users
 * paint by tapping cells; the table keeps in-container horizontal scroll on
 * mobile, so cells must not claim touch-action.
 */

const OPEN_CELL_CLASS =
  "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85 hover:bg-[color:var(--brand-link)]";
const CLOSED_CELL_CLASS =
  "border-border bg-muted/50 hover:border-[color:var(--ink)]/30 hover:bg-muted";

export function HourlyAvailabilityEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: HourlyOpenHours;
  onChange: (next: HourlyOpenHours) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const drag = useRef<{ target: boolean } | null>(null);

  // A drag ends wherever the pointer is released, even outside the grid.
  useEffect(() => {
    const endDrag = () => {
      drag.current = null;
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  function apply(day: GridDay, hour: number, open: boolean) {
    const has = value[day].includes(hour);
    if (has === open) return;
    onChange({
      ...value,
      [day]: open
        ? [...value[day], hour].sort((a, b) => a - b)
        : value[day].filter((h) => h !== hour),
    });
  }

  return (
    <div className="space-y-3 select-none">
      <div className="overflow-x-auto pb-1">
        <table
          className="w-full min-w-[620px] border-separate border-spacing-1 text-center"
          aria-label={t("settings.grid.title")}
        >
          <thead>
            <tr>
              <th scope="col" className="w-[64px]" />
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
            {Array.from({ length: HOURLY_GRID_HOURS }, (_, index) => {
              const hour = HOURLY_GRID_START_HOUR + index;
              return (
                <tr key={hour}>
                  <th
                    scope="row"
                    className="pr-2 text-left text-[11px] leading-tight font-medium whitespace-nowrap text-muted-foreground sm:text-xs"
                  >
                    {hourlyHourLabel(hour)}
                  </th>
                  {GRID_DAYS.map((day) => {
                    const isOpen = value[day].includes(hour);
                    return (
                      <td key={day} className="h-6">
                        <button
                          type="button"
                          disabled={disabled}
                          aria-pressed={isOpen}
                          aria-label={`${t(`profile.grid_day_${day}`)} ${hourlyRangeLabel(hour)}`}
                          onPointerDown={() => {
                            if (disabled) return;
                            const target = !isOpen;
                            drag.current = { target };
                            apply(day, hour, target);
                          }}
                          onPointerEnter={() => {
                            if (disabled || !drag.current) return;
                            apply(day, hour, drag.current.target);
                          }}
                          onClick={(event) => {
                            // Keyboard activation (Enter/Space) arrives as a
                            // click with detail === 0; pointer clicks already
                            // painted on pointerDown.
                            if (event.detail === 0 && !disabled) {
                              apply(day, hour, !isOpen);
                            }
                          }}
                          className={cn(
                            "h-6 w-full cursor-pointer rounded-[4px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                            isOpen ? OPEN_CELL_CLASS : CLOSED_CELL_CLASS,
                          )}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[color:var(--ink)]/60">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("inline-block h-3 w-3 rounded-[3px] border", OPEN_CELL_CLASS)}
          />
          {t("profile.grid_cell_open")}
        </span>
        <span className="ml-auto">{t("settings.grid.drag_hint")}</span>
      </div>
    </div>
  );
}
