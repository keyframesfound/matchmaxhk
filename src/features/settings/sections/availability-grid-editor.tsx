import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import {
  GRID_DAYS,
  isHourlyGridEmpty,
  mapLegacyGridToHourly,
  parseHourlyOpenHours,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";
import { HourlyAvailabilityEditor } from "@/features/tutors/availability-hourly-editor";
import { needsFreshnessReview } from "@/features/tutors/availability-freshness";
import { useMyTutorTimezone } from "@/features/cases/use-my-tutor-timezone";
import { isDefaultTutorZone, timezoneLabel } from "@/features/cases/tutor-timezone";
import { supabase } from "@/integrations/supabase/client";

/**
 * Issue #768 (slice 1): the tutor's weekly HOURLY availability editor in
 * Dashboard → Availability. Saves through the update_my_availability_grid_hourly
 * RPC so the tutor can only touch the hourly column on their own card.
 *
 * One-time "Review your hourly calendar" prompt: after the migration auto-maps
 * the old 3-hour cells (and for tutors whose hours still live only in the
 * legacy grid, whose cells are pre-filled here with the same auto-map rule),
 * the prompt shows until the tutor saves the hourly grid or dismisses it
 * (confirm_my_availability_hourly_reviewed). Tutors with nothing auto-mapped
 * never see it.
 */

type TutorHourlyRow = {
  availability_grid_hourly: unknown;
  availability_grid_hourly_reviewed_at: string | null;
  availability_grid: unknown;
};

export function AvailabilityGridEditor({ className }: { className?: string }) {
  // #798: hours are typed in HKT and shown in the tutor's zone.
  const timezone = useMyTutorTimezone();
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openHours, setOpenHours] = useState<HourlyOpenHours>(() => parseHourlyOpenHours(null));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reviewPrompt, setReviewPrompt] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    void (async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select("availability_grid_hourly, availability_grid_hourly_reviewed_at, availability_grid")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        toast.error(error.message);
      } else if (data) {
        const row = data as unknown as TutorHourlyRow;
        const hourly = parseHourlyOpenHours(row.availability_grid_hourly);
        // Legacy fallback (#768 cutover): a tutor whose hours still live only
        // in the 3-hour grid (e.g. they joined via the 3-hour join form)
        // starts the hourly editor pre-filled with the same auto-map the
        // migration applied to existing rows — 'a' blocks open, 'p'/'u' closed.
        const fromLegacy = isHourlyGridEmpty(hourly)
          ? mapLegacyGridToHourly(row.availability_grid)
          : null;
        const effective = fromLegacy ?? hourly;
        setOpenHours(effective);
        // #768 CEO lock (14-day freshness): retarget the review nudge to a
        // gentle recurring check instead of a single migration flag. The
        // first prompt covers an auto-mapped or never-reviewed grid; after
        // that it returns once the last save/dismissal is 14 days old.
        // Dismissing writes availability_grid_hourly_reviewed_at, so the
        // clock restarts without ever auto-closing an Open hour.
        setReviewPrompt(
          fromLegacy !== null ||
            (!isHourlyGridEmpty(hourly) &&
              needsFreshnessReview(row.availability_grid_hourly_reviewed_at)),
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
    const { error } = await supabase.rpc("update_my_availability_grid_hourly", {
      _grid: Object.fromEntries(GRID_DAYS.map((day) => [day, openHours[day]])),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDirty(false);
    setReviewPrompt(false);
    await queryClient.invalidateQueries({ queryKey: ["tutors"] });
    toast.success(t("settings.grid.saved"));
  }

  async function dismissReview() {
    setDismissing(true);
    const { error } = await supabase.rpc("confirm_my_availability_hourly_reviewed");
    setDismissing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReviewPrompt(false);
  }

  const gridEmpty = isHourlyGridEmpty(openHours);

  return (
    <SettingsCard
      title={t("settings.grid.title")}
      description={t("settings.grid.hourly_description")}
      className={className}
    >
      {!loaded ? (
        <p className="text-sm text-[color:var(--ink)]/60">{t("settings.grid.loading")}</p>
      ) : (
        <div className="space-y-4">
          {reviewPrompt ? (
            <div className="flex flex-wrap items-center gap-3 rounded-sm border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/10 px-4 py-3">
              <p className="text-sm font-bold text-[color:var(--ink)]">
                {t("settings.grid.review_prompt")}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={dismissing}
                onClick={() => void dismissReview()}
                className="ml-auto h-8 px-3 text-xs font-bold"
              >
                {t("settings.grid.review_dismiss")}
              </Button>
            </div>
          ) : null}

          <HourlyAvailabilityEditor
            value={openHours}
            onChange={(next) => {
              setOpenHours(next);
              setDirty(true);
            }}
          />

          {/* #798: hours are stored in HKT and rendered in the tutor's zone, so
              a tutor abroad is told which clock to type on. HKT tutors keep the
              unchanged card. */}
          {!isDefaultTutorZone(timezone) ? (
            <p className="text-xs text-muted-foreground">
              {t("settings.grid.hourly_zone_note", { zone: timezoneLabel(timezone) })}
            </p>
          ) : null}

          {gridEmpty ? (
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
