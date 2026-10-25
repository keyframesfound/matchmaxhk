import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import {
  GRID_DAYS,
  parseAvailabilityGrid,
  type GridCellState,
  type GridDay,
} from "@/features/tutors/availability-grid-model";
import { EditableAvailabilityGrid } from "@/features/tutors/availability-editor-fields";
import { supabase } from "@/integrations/supabase/client";

/**
 * Issue #116: tutor self-serve weekly availability grid, in Dashboard →
 * Availability below the existing capacity card. Tap a cell to cycle
 * available → partial → unavailable (matches the TutorCircle reference's
 * three states). Saves through the update_my_availability_grid RPC so the
 * tutor can only touch this one column on their own card. The grid UI itself
 * is shared with the admin TutorEditor (availability-editor-fields.tsx).
 */

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
          <EditableAvailabilityGrid
            grid={grid}
            onChange={(next) => {
              setGrid(next);
              setDirty(true);
            }}
          />

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
