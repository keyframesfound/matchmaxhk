import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  formatAvailabilityDate,
  getTutorAvailabilityReadiness,
} from "@/features/tutors/tutor-display";
import { PREFERRED_TIME_WINDOWS, type PreferredTimeWindow } from "@/features/tutors/queries";
import { cn } from "@/lib/utils";

type TutorAvailability = {
  start_immediately: boolean | null;
  earliest_start_date: string | null;
  remaining_student_slots: number | null;
  is_accepting_students: boolean | null;
  preferred_time_windows: string[] | null;
};

const TIME_WINDOW_LABEL_KEYS: Record<PreferredTimeWindow, string> = {
  weekday_afternoon: "settings.capacity.window_weekday_afternoon",
  weekday_evening: "settings.capacity.window_weekday_evening",
  weekend_morning: "settings.capacity.window_weekend_morning",
  weekend_afternoon: "settings.capacity.window_weekend_afternoon",
};

/**
 * "Availability" — tutor self-serve start date (issue #106). Saves through the
 * update_my_availability RPC so the tutor can only ever touch these two
 * fields on their own card, with no admin review cycle.
 */
export function AvailabilitySection() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [startImmediately, setStartImmediately] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Issue #103: self-serve capacity state.
  const [acceptingStudents, setAcceptingStudents] = useState(true);
  const [openSlots, setOpenSlots] = useState(2);
  const [timeWindows, setTimeWindows] = useState<PreferredTimeWindow[]>([]);
  const [capacitySaving, setCapacitySaving] = useState(false);
  const [capacityDirty, setCapacityDirty] = useState(false);

  const availabilityQuery = useQuery({
    queryKey: ["settings", "availability", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(
          "start_immediately, earliest_start_date, remaining_student_slots, is_accepting_students, preferred_time_windows",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as TutorAvailability | null) ?? null;
    },
    enabled: Boolean(user),
  });

  useEffect(() => {
    const row = availabilityQuery.data;
    if (!row) return;
    setStartImmediately(row.start_immediately !== false);
    setStartDate(row.earliest_start_date ?? "");
    setAcceptingStudents(row.is_accepting_students !== false);
    setOpenSlots(typeof row.remaining_student_slots === "number" ? row.remaining_student_slots : 2);
    setTimeWindows(
      (row.preferred_time_windows ?? []).filter((w): w is PreferredTimeWindow =>
        (PREFERRED_TIME_WINDOWS as readonly string[]).includes(w),
      ),
    );
    setDirty(false);
    setCapacityDirty(false);
  }, [availabilityQuery.data]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.rpc("update_my_availability", {
      _start_immediately: startImmediately,
      _earliest_start_date: startImmediately ? null : startDate || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDirty(false);
    await queryClient.invalidateQueries({
      queryKey: ["settings", "availability", user?.id],
    });
    toast.success(t("settings.availability.saved"));
  }

  async function saveCapacity() {
    setCapacitySaving(true);
    const { error } = await supabase.rpc("update_my_capacity", {
      _remaining_student_slots: openSlots,
      _is_accepting_students: acceptingStudents,
      _preferred_time_windows: timeWindows,
    });
    setCapacitySaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCapacityDirty(false);
    await queryClient.invalidateQueries({
      queryKey: ["settings", "availability", user?.id],
    });
    toast.success(t("settings.capacity.saved"));
  }

  const toggleTimeWindow = (window: PreferredTimeWindow) => {
    setCapacityDirty(true);
    setTimeWindows((prev) =>
      prev.includes(window) ? prev.filter((w) => w !== window) : [...prev, window],
    );
  };

  const current = availabilityQuery.data;
  const readiness = current
    ? getTutorAvailabilityReadiness({
        start_immediately: current.start_immediately,
        earliest_start_date: current.earliest_start_date,
      })
    : null;
  const statusHint = (() => {
    if (!readiness) return null;
    const date = current?.earliest_start_date
      ? formatAvailabilityDate(current.earliest_start_date, i18n.language)
      : "";
    if (readiness === "immediate") return t("settings.availability.status_immediate");
    if (readiness === "pre_booking") return t("settings.availability.status_pre_booking", { date });
    return t("settings.availability.status_future", { date });
  })();

  return (
    <SettingsCard
      title={t("settings.availability.title")}
      description={t("settings.availability.description")}
    >
      {availabilityQuery.isLoading ? (
        <div className="space-y-4" aria-hidden>
          <div className="h-10 animate-pulse rounded-xl bg-[color:var(--ink)]/5" />
          <div className="h-10 animate-pulse rounded-xl bg-[color:var(--ink)]/5" />
        </div>
      ) : availabilityQuery.isError ? (
        <p className="text-sm font-medium text-destructive">{t("settings.load_error")}</p>
      ) : !current ? (
        <p className="text-sm leading-6 text-[color:var(--ink)]/70">
          {t("settings.availability.not_linked")}
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label className="text-[color:var(--ink)]">{t("settings.availability.question")}</Label>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {[
                { value: "immediately", label: t("settings.availability.option_immediately") },
                { value: "date", label: t("settings.availability.option_date") },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-11 cursor-pointer items-center gap-2 py-1 text-sm text-[color:var(--ink)]"
                >
                  <input
                    type="radio"
                    name="availability-mode"
                    className="h-4 w-4 accent-[color:var(--ink)]"
                    checked={startImmediately === (option.value === "immediately")}
                    onChange={() => {
                      setStartImmediately(option.value === "immediately");
                      setDirty(true);
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {!startImmediately ? (
            <div className="space-y-2">
              <Label htmlFor="settings-availability-date" className="text-[color:var(--ink)]">
                {t("settings.availability.date_label")}
              </Label>
              <Input
                id="settings-availability-date"
                type="date"
                value={startDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setDirty(true);
                }}
                className="bg-[color:var(--surface)] sm:max-w-xs"
              />
              <p className="text-xs text-[color:var(--ink)]/55">
                {t("settings.availability.date_hint")}
              </p>
            </div>
          ) : null}

          {statusHint ? (
            <p className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3 text-xs leading-5 text-[color:var(--ink)]/70">
              {statusHint}
            </p>
          ) : null}

          <Button type="submit" disabled={saving || !dirty} className="font-bold">
            {saving ? t("settings.availability.saving") : t("settings.availability.save")}
          </Button>

          {/* Issue #103: self-serve "Capacity & Availability" card. */}
          <div className="space-y-4 border-t border-[color:var(--ink)]/10 pt-6">
            <div>
              <p className="text-sm font-bold text-[color:var(--ink)]">
                {t("settings.capacity.title")}
              </p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--ink)]/60">
                {t("settings.capacity.description")}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="settings-capacity-toggle" className="text-[color:var(--ink)]">
                {t("settings.capacity.accepting_label")}
              </Label>
              <button
                id="settings-capacity-toggle"
                type="button"
                role="switch"
                aria-checked={acceptingStudents}
                onClick={() => {
                  setAcceptingStudents((prev) => !prev);
                  setCapacityDirty(true);
                }}
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
              <Label htmlFor="settings-capacity-slots" className="text-[color:var(--ink)]">
                {t("settings.capacity.slots_label")}
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t("settings.capacity.slots_decrease")}
                  disabled={openSlots <= 0}
                  onClick={() => {
                    setOpenSlots((prev) => Math.max(0, prev - 1));
                    setCapacityDirty(true);
                  }}
                  className="h-10 w-10 shrink-0 p-0 text-base font-bold"
                >
                  −
                </Button>
                <Input
                  id="settings-capacity-slots"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  value={openSlots}
                  onChange={(event) => {
                    const raw = Number(event.target.value);
                    if (!Number.isFinite(raw)) return;
                    setOpenSlots(Math.min(99, Math.max(0, Math.round(raw))));
                    setCapacityDirty(true);
                  }}
                  className="h-10 w-20 bg-[color:var(--surface)] text-center font-bold tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label={t("settings.capacity.slots_increase")}
                  disabled={openSlots >= 99}
                  onClick={() => {
                    setOpenSlots((prev) => Math.min(99, prev + 1));
                    setCapacityDirty(true);
                  }}
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
              <Label className="text-[color:var(--ink)]">
                {t("settings.capacity.windows_label")}
              </Label>
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
                        onChange={() => toggleTimeWindow(window)}
                      />
                      <span>{t(TIME_WINDOW_LABEL_KEYS[window])}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-[color:var(--ink)]/55">
                {t("settings.capacity.windows_hint")}
              </p>
            </div>

            <Button
              type="button"
              disabled={capacitySaving || !capacityDirty}
              onClick={() => void saveCapacity()}
              className="font-bold"
            >
              {capacitySaving
                ? t("settings.capacity.saving")
                : t("settings.capacity.save_capacity")}
            </Button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
