import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import {
  GRID_DAYS,
  GRID_SLOTS,
  countAvailableCells,
  gridSlotLabel,
  parseAvailabilityGrid,
  type GridCellState,
  type GridDay,
} from "@/features/tutors/availability-grid-model";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Issue #116: tutor self-serve weekly availability grid, in Dashboard →
 * Availability below the existing capacity card. Tap a cell to cycle
 * available → partial → unavailable (matches the TutorCircle reference's
 * three states). Saves through the update_my_availability_grid RPC so the
 * tutor can only touch this one column on their own card.
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

export function AvailabilityGridEditor({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [grid, setGrid] = useState<Record<GridDay, GridCellState[]>>(() =>
    parseAvailabilityGrid(null),
  );
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    void (async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("availability_grid")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        toast.error(error.message);
      } else if (data) {
        setGrid(
          parseAvailabilityGrid(
            (data as unknown as { availability_grid: unknown }).availability_grid,
          ),
        );
      }
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  function cycleCell(day: GridDay, slotIndex: number) {
    setGrid((prev) => {
      const next = { ...prev, [day]: [...prev[day]] };
      next[day][slotIndex] = STATE_CYCLE[next[day][slotIndex]];
      return next;
    });
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.rpc("update_my_availability_grid", {
      _grid: Object.fromEntries(GRID_DAYS.map((day) => [day, grid[day]])),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDirty(false);
    await queryClient.invalidateQueries({ queryKey: ["tutors"] });
    toast.success(t("settings.grid.saved"));
  }

  return (
    <SettingsCard
      title={t("settings.grid.title")}
      description={t("settings.grid.description")}
      className={className}
    >
      {!loaded ? (
        <p className="text-sm text-[color:var(--ink)]/60">{t("settings.grid.loading")}</p>
      ) : (
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
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("inline-block h-3 w-3 rounded-[3px] border", STATE_CELL_CLASS.a)}
              />
              {t(STATE_LABEL_KEYS.a)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("inline-block h-3 w-3 rounded-[3px] border", STATE_CELL_CLASS.p)}
              />
              {t(STATE_LABEL_KEYS.p)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("inline-block h-3 w-3 rounded-[3px] border", STATE_CELL_CLASS.u)}
              />
              {t(STATE_LABEL_KEYS.u)}
            </span>
            <span className="ml-auto">{t("settings.grid.tap_hint")}</span>
          </div>

          {countAvailableCells(grid) === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("settings.grid.empty_hint")}
            </p>
          ) : null}

          <Button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void save()}
            className="font-bold"
          >
            {saving ? t("settings.grid.saving") : t("settings.grid.save")}
          </Button>
        </div>
      )}
    </SettingsCard>
  );
}
