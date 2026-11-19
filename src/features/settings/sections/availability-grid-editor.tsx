import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import { AvailabilityHoursEditor } from "@/features/tutors/availability-hours-editor";
import {
  isHourlyEmpty,
  parseHourlyGrid,
  projectLegacyGrid,
  type HourlyGrid,
} from "@/features/tutors/availability-hours-model";
import { supabase } from "@/integrations/supabase/client";

/**
 * Issue #768 Part 1: tutor self-serve weekly availability, in Dashboard →
 * Availability below the existing capacity card. Hourly cells (7 days ×
 * 06:00–24:00) with click-and-drag plus a keyboard-only equivalent, so hours
 * are settable without a pointer drag.
 *
 * Reads tutors.availability_hours and falls back to projecting the legacy 7×6
 * grid (tutors.availability_grid) so a tutor with only legacy data sees their
 * hours on first load. Saves through update_my_availability_hours, which only
 * touches this one column on the tutor's own card.
 */

/**
 * The generated Database types predate availability_hours and its RPC, so both
 * calls are typed narrowly here instead of widening the whole client.
 */
type HoursRow = { availability_grid: unknown; availability_hours: unknown };
type HoursResult = { data: HoursRow | null; error: { message: string } | null };

type TutorsHoursQuery = {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      maybeSingle: () => PromiseLike<HoursResult>;
    };
  };
};

type AvailabilityHoursRpc = (
  fn: "update_my_availability_hours",
  args: { _hours: HourlyGrid; _mark_reviewed: boolean },
) => PromiseLike<{ error: { message: string } | null }>;

export function AvailabilityGridEditor({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [grid, setGrid] = useState<HourlyGrid>(() => parseHourlyGrid(null));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    void (async () => {
      const tutors = supabase.from("tutors") as unknown as TutorsHoursQuery;
      const { data, error } = await tutors
        .select("availability_grid, availability_hours")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        toast.error(error.message);
      } else if (data) {
        const hours = parseHourlyGrid(data.availability_hours);
        setGrid(isHourlyEmpty(hours) ? projectLegacyGrid(data.availability_grid) : hours);
      }
      setLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  async function save() {
    setSaving(true);
    const rpc = supabase.rpc as unknown as AvailabilityHoursRpc;
    const { error } = await rpc("update_my_availability_hours", {
      _hours: grid,
      _mark_reviewed: false,
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
          <AvailabilityHoursEditor
            value={grid}
            disabled={saving}
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
