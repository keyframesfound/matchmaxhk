import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";

import { GRID_DAYS } from "@/features/tutors/availability-grid-model";
import {
  emptyHourlyGrid,
  type HourlyDay,
  type HourlyGrid,
} from "@/features/tutors/availability-hours-model";
import { cn } from "@/lib/utils";

/**
 * Issue #768 Part 1: hourly weekly availability editor, 7 day columns × the
 * 06:00–24:00 teaching window, matching the public hourly grid.
 *
 * Two equivalent input paths, both required for accessibility:
 *   - pointer drag: press toggles the pressed cell, then the same target state
 *     is painted across every cell the pointer enters until pointerup.
 *   - keyboard only: every cell is a toggle button in a roving-tabindex grid,
 *     so Tab enters the grid once and arrow keys walk between cells.
 *
 * A drag that ends outside the table still finishes because pointerup and
 * pointercancel are observed on the window, not on the cells. The parent owns
 * the grid; this component never mutates `value` and always emits a fresh copy.
 */

/** Teaching-window rows in one-hour steps: hours 6..23 (06:00–24:00). */
const HOURS = Array.from({ length: 18 }, (_, index) => index + 6);

type CellPosition = { day: HourlyDay; hour: number };

type DragState = {
  /** State painted onto every entered cell: the toggle of the pressed cell. */
  target: boolean;
  /** Cell the drag started on; re-entering it is a no-op. */
  origin: CellPosition;
};

const CELL_CLASS_OPEN = "border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/85";
const CELL_CLASS_CLOSED = "border-border bg-muted/50";

function padHour(hour: number): string {
  return String(hour).padStart(2, "0");
}

/** Row label, "14:00". */
function hourLabel(hour: number): string {
  return `${padHour(hour)}:00`;
}

/** Range inside the accessible name, "14:00–15:00" (language-neutral). */
function hourRange(hour: number): string {
  return `${hourLabel(hour)}–${padHour(hour + 1)}:00`;
}

function cellKey(day: HourlyDay, hour: number): string {
  return `${day}:${hour}`;
}

/**
 * Absolute set, never a toggle: a drag paints one target state across cells and
 * re-entering the same cell must not flip it back.
 */
function withCell(grid: HourlyGrid, day: HourlyDay, hour: number, open: boolean): HourlyGrid {
  const next = emptyHourlyGrid();
  for (const d of GRID_DAYS) next[d] = [...grid[d]];
  next[day][hour] = open;
  return next;
}

export function AvailabilityHoursEditor({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: HourlyGrid;
  onChange: (next: HourlyGrid) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [active, setActive] = useState<CellPosition>({ day: "mon", hour: HOURS[0] });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  // A drag that ends outside the grid must still finish, so the end of the
  // gesture is observed on the window rather than on the cells.
  useEffect(() => {
    if (!dragging) return;
    const endDrag = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [dragging]);

  function focusCell(next: CellPosition) {
    setActive(next);
    cellRefs.current.get(cellKey(next.day, next.hour))?.focus();
  }

  function setCell(day: HourlyDay, hour: number, open: boolean) {
    if (disabled) return;
    if (value[day][hour] === open) return;
    onChange(withCell(value, day, hour, open));
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, day: HourlyDay, hour: number) {
    if (disabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Press toggles the pressed cell, and that resulting state becomes the
    // paint target for the rest of the drag.
    const target = !value[day][hour];
    dragRef.current = { target, origin: { day, hour } };
    setDragging(true);
    setCell(day, hour, target);
  }

  function handlePointerEnter(day: HourlyDay, hour: number) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.origin.day === day && drag.origin.hour === hour) return;
    setCell(day, hour, drag.target);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, day: HourlyDay, hour: number) {
    const column = GRID_DAYS.indexOf(day);
    const row = HOURS.indexOf(hour);
    let next: CellPosition;
    switch (event.key) {
      case "ArrowRight":
        next = { day: GRID_DAYS[Math.min(column + 1, GRID_DAYS.length - 1)], hour };
        break;
      case "ArrowLeft":
        next = { day: GRID_DAYS[Math.max(column - 1, 0)], hour };
        break;
      case "ArrowDown":
        next = { day, hour: HOURS[Math.min(row + 1, HOURS.length - 1)] };
        break;
      case "ArrowUp":
        next = { day, hour: HOURS[Math.max(row - 1, 0)] };
        break;
      case "Home":
        next = { day: "mon", hour };
        break;
      case "End":
        next = { day: GRID_DAYS[GRID_DAYS.length - 1], hour };
        break;
      default:
        return;
    }
    event.preventDefault();
    focusCell(next);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-x-auto pb-1">
        <table
          aria-label={t("settings.grid.title")}
          className="w-full min-w-[520px] border-separate border-spacing-1 text-center select-none"
        >
          <thead>
            <tr>
              <th scope="col" className="w-14" />
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
            {HOURS.map((hour) => (
              <tr key={hour}>
                <th
                  scope="row"
                  className="pr-2 text-right text-[11px] leading-none font-medium tabular-nums whitespace-nowrap text-muted-foreground"
                >
                  {hourLabel(hour)}
                </th>
                {GRID_DAYS.map((day) => {
                  const open = value[day][hour] === true;
                  const tabbable = active.day === day && active.hour === hour;
                  return (
                    <td key={day} className="h-7">
                      <button
                        type="button"
                        ref={(node) => {
                          if (node) cellRefs.current.set(cellKey(day, hour), node);
                          else cellRefs.current.delete(cellKey(day, hour));
                        }}
                        // One tab stop for the whole grid; arrows move focus.
                        tabIndex={tabbable ? 0 : -1}
                        aria-pressed={open}
                        aria-label={`${t(`profile.grid_day_${day}`)} ${hourRange(hour)}`}
                        disabled={disabled}
                        onFocus={() => setActive({ day, hour })}
                        onKeyDown={(event) => handleKeyDown(event, day, hour)}
                        onPointerDown={(event) => handlePointerDown(event, day, hour)}
                        onPointerEnter={() => handlePointerEnter(day, hour)}
                        onClick={(event) => {
                          // Keyboard and assistive-tech activation arrive as a
                          // click with no press count; pointer presses already
                          // toggled on pointerdown, so ignore those.
                          if (event.detail === 0) setCell(day, hour, !open);
                        }}
                        className={cn(
                          "h-7 w-full rounded-[4px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
                          open ? CELL_CLASS_OPEN : CELL_CLASS_CLOSED,
                          !disabled && "cursor-pointer hover:border-[color:var(--brand-link)]/60",
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
        {(
          [
            ["profile.grid_cell_open", CELL_CLASS_OPEN],
            ["profile.grid_cell_unavailable", CELL_CLASS_CLOSED],
          ] as const
        ).map(([labelKey, cellClass]) => (
          <span key={labelKey} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("inline-block h-3 w-3 rounded-[3px] border", cellClass)}
            />
            {t(labelKey)}
          </span>
        ))}
      </div>
    </div>
  );
}
