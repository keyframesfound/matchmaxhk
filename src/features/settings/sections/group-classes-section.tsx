import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect, DropdownModalContext } from "@/components/ui/searchable-select";
import { SettingsCard } from "@/features/settings/option-card";
import { TEACHING_CURRICULA } from "@/features/tutors/subjects";
import {
  COHORT_DESCRIPTION_MAX,
  COHORT_MAX_SEATS,
  COHORT_MIN_SEATS,
} from "@/features/cases/group-cohorts";
import {
  closeMyGroupCohort,
  getMyGroupCohorts,
  upsertMyGroupCohort,
  type GroupCohortView,
} from "@/lib/group-cohort.functions";
import { RATE_MAX, RATE_MIN } from "@/features/tutors/rates";
import { cn } from "@/lib/utils";

/**
 * Issue #391 — the tutor's "Group classes" manager: create open cohorts
 * (2–6 seats, Cap. 279 hard cap at launch), watch seats fill from live
 * bookings, confirm an early start, close the cohort. Writes go through the
 * group-cohort server fns (ownership + contact filter re-checked
 * server-side); the fee previews use the shared 1.5-lesson-per-student math.
 */

type CohortFormState = {
  id?: string;
  title: string;
  curriculum: string;
  subject: string;
  studentLevel: string;
  weeklySchedule: string;
  mode: "online" | "in_person";
  district: string;
  perStudentRateHkd: string;
  minSeats: string;
  maxSeats: string;
  description: string;
  status: "forming" | "running";
};

const EMPTY_FORM: CohortFormState = {
  title: "",
  curriculum: "",
  subject: "",
  studentLevel: "",
  weeklySchedule: "",
  mode: "online",
  district: "",
  perStudentRateHkd: "",
  minSeats: "2",
  maxSeats: "4",
  description: "",
  status: "forming",
};

const SEAT_OPTIONS = Array.from({ length: COHORT_MAX_SEATS - 1 }, (_, i) => i + 1).map((n) => ({
  value: String(n),
  label: String(n),
}));

function formFromCohort(cohort: GroupCohortView): CohortFormState {
  return {
    id: cohort.id,
    title: cohort.title,
    curriculum: cohort.curriculum,
    subject: cohort.subject,
    studentLevel: cohort.studentLevel,
    weeklySchedule: cohort.weeklySchedule,
    mode: cohort.mode === "in_person" ? "in_person" : "online",
    district: cohort.district ?? "",
    perStudentRateHkd: String(cohort.perStudentRateHkd),
    minSeats: String(cohort.minSeats),
    maxSeats: String(cohort.maxSeats),
    description: cohort.description ?? "",
    status: cohort.status === "running" ? "running" : "forming",
  };
}

function StatePill({ state }: { state: string }) {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    forming: "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    running: "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    full: "border-border bg-muted text-[color:var(--ink)]",
    closed: "border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        styles[state] ?? styles.closed,
      )}
    >
      {t(`group_classes.state_${state}`)}
    </span>
  );
}

function CohortFormDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: CohortFormState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CohortFormState>(initial);
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<CohortFormState>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await upsertMyGroupCohort({
        data: {
          id: form.id,
          title: form.title,
          curriculum: form.curriculum,
          subject: form.subject,
          studentLevel: form.studentLevel,
          weeklySchedule: form.weeklySchedule,
          mode: form.mode,
          district: form.district || null,
          perStudentRateHkd: Number(form.perStudentRateHkd),
          minSeats: Number(form.minSeats) || 2,
          maxSeats: Number(form.maxSeats) || COHORT_MIN_SEATS,
          description: form.description || null,
          status: form.status,
        },
      });
      toast.success(t(form.id ? "group_classes.saved_toast" : "group_classes.created_toast"));
      await queryClient.invalidateQueries({ queryKey: ["group-classes", "mine"] });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "bg-[color:var(--surface)]";
  const seats = Math.max(0, (Number(form.maxSeats) || 0) - (Number(form.minSeats) || 0));

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {/* In-dialog dropdowns (district list overflows): the Radix dialog
            scroll-lock must not eat the portaled list's wheel events (same
            fix as the FiltersDialog). */}
        <DropdownModalContext.Provider value={true}>
          <DialogHeader>
            <DialogTitle>
              {t(form.id ? "group_classes.edit_title" : "group_classes.create_title")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("group_classes.form_title")}</Label>
              <Input
                value={form.title}
                maxLength={120}
                placeholder={t("group_classes.form_title_placeholder")}
                onChange={(e) => update({ title: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("group_classes.form_curriculum")}</Label>
                <SearchableSelect
                  value={form.curriculum}
                  onChange={(v) => update({ curriculum: v || "" })}
                  options={TEACHING_CURRICULA.map((c) => ({ value: c.value, label: c.label }))}
                  placeholder={t("group_classes.form_curriculum")}
                  searchPlaceholder={t("group_classes.form_curriculum")}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("group_classes.form_subject")}</Label>
                <Input
                  value={form.subject}
                  maxLength={120}
                  placeholder={t("group_classes.form_subject")}
                  onChange={(e) => update({ subject: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("group_classes.form_student_level")}</Label>
                <Input
                  value={form.studentLevel}
                  maxLength={80}
                  placeholder={t("group_classes.form_student_level_placeholder")}
                  onChange={(e) => update({ studentLevel: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("group_classes.form_schedule")}</Label>
                <Input
                  value={form.weeklySchedule}
                  maxLength={120}
                  placeholder={t("group_classes.form_schedule_placeholder")}
                  onChange={(e) => update({ weeklySchedule: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("group_classes.form_mode")}</Label>
                <SearchableSelect
                  value={form.mode}
                  onChange={(v) => update({ mode: v === "in_person" ? "in_person" : "online" })}
                  options={[
                    { value: "online", label: t("group_classes.mode_online") },
                    { value: "in_person", label: t("group_classes.mode_in_person") },
                  ]}
                  placeholder={t("group_classes.form_mode")}
                  searchPlaceholder={t("group_classes.form_mode")}
                  className={inputClass}
                />
              </div>
              {form.mode === "in_person" ? (
                <div className="space-y-2">
                  <Label>{t("group_classes.form_district")}</Label>
                  <Input
                    value={form.district}
                    maxLength={80}
                    placeholder={t("group_classes.form_district")}
                    onChange={(e) => update({ district: e.target.value })}
                    className={inputClass}
                  />
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("group_classes.form_rate")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={RATE_MIN}
                  max={RATE_MAX}
                  value={form.perStudentRateHkd}
                  placeholder={t("group_classes.form_rate_placeholder")}
                  onChange={(e) =>
                    update({ perStudentRateHkd: e.target.value.replace(/[^\d]/g, "").slice(0, 4) })
                  }
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground">{t("group_classes.form_rate_hint")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("group_classes.form_min_seats")}</Label>
                  <SearchableSelect
                    value={form.minSeats}
                    onChange={(v) => update({ minSeats: v || "1" })}
                    options={Array.from({ length: COHORT_MAX_SEATS }, (_, i) => i + 1).map((n) => ({
                      value: String(n),
                      label: String(n),
                    }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("group_classes.form_max_seats")}</Label>
                  <SearchableSelect
                    value={form.maxSeats}
                    onChange={(v) => update({ maxSeats: v || String(COHORT_MIN_SEATS) })}
                    options={SEAT_OPTIONS}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
            {seats < 0 ? (
              <p className="text-xs font-semibold text-destructive">
                {t("group_classes.min_gt_max_error")}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label>{t("group_classes.form_description")}</Label>
              <Textarea
                value={form.description}
                maxLength={COHORT_DESCRIPTION_MAX}
                rows={3}
                placeholder={t("group_classes.form_description_placeholder")}
                onChange={(e) => update({ description: e.target.value })}
                className={inputClass}
              />
              <p className="text-right text-xs text-muted-foreground">
                {form.description.length}/{COHORT_DESCRIPTION_MAX}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("group_classes.form_status")}</Label>
              <SearchableSelect
                value={form.status}
                onChange={(v) => update({ status: v === "running" ? "running" : "forming" })}
                options={[
                  { value: "forming", label: t("group_classes.state_forming") },
                  { value: "running", label: t("group_classes.state_running") },
                ]}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">{t("group_classes.form_status_hint")}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                {t("group_classes.cancel")}
              </Button>
              <Button
                type="button"
                onClick={save}
                disabled={
                  saving ||
                  !form.title.trim() ||
                  !form.curriculum ||
                  !form.subject.trim() ||
                  !form.studentLevel.trim() ||
                  !form.weeklySchedule.trim() ||
                  !form.perStudentRateHkd ||
                  (form.mode === "in_person" && !form.district.trim()) ||
                  seats < 0
                }
              >
                {t(form.id ? "group_classes.save" : "group_classes.create")}
              </Button>
            </div>
          </div>
        </DropdownModalContext.Provider>
      </DialogContent>
    </Dialog>
  );
}

export function GroupClassesSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CohortFormState>(EMPTY_FORM);
  const [closingId, setClosingId] = useState<string | null>(null);

  const cohortsQuery = useQuery({
    queryKey: ["group-classes", "mine"],
    queryFn: () => getMyGroupCohorts(),
  });

  const cohorts = cohortsQuery.data ?? [];

  const closeCohort = async (cohortId: string) => {
    setClosingId(cohortId);
    try {
      await closeMyGroupCohort({ data: { cohortId } });
      toast.success(t("group_classes.closed_toast"));
      await queryClient.invalidateQueries({ queryKey: ["group-classes", "mine"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setClosingId(null);
    }
  };

  return (
    <SettingsCard
      title={t("group_classes.manager_title")}
      description={t("group_classes.manager_description")}
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditing(EMPTY_FORM);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("group_classes.create_title")}
          </Button>
        </div>

        {cohortsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("group_classes.loading")}</p>
        ) : cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("group_classes.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {cohorts.map((cohort) => (
              <li key={cohort.id} className="rounded-sm border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Users
                      className="h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm font-bold text-[color:var(--ink)]">
                      {cohort.title}
                    </span>
                    <StatePill state={cohort.state} />
                  </div>
                  <span className="text-sm font-semibold text-[color:var(--ink)]">
                    HK${cohort.perStudentRateHkd}
                    {t("group_classes.per_student")}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {cohort.curriculum} · {cohort.subject} · {cohort.studentLevel} ·{" "}
                  {cohort.weeklySchedule} ·{" "}
                  {cohort.mode === "online"
                    ? t("group_classes.mode_online")
                    : `${t("group_classes.mode_in_person")} · ${cohort.district ?? ""}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("group_classes.seats_summary", {
                    taken: cohort.seatsTaken,
                    max: cohort.maxSeats,
                    min: cohort.minSeats,
                  })}
                </p>
                {cohort.description ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {cohort.description}
                  </p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cohort.status === "closed"}
                    onClick={() => {
                      setEditing(formFromCohort(cohort));
                      setDialogOpen(true);
                    }}
                  >
                    {t("group_classes.edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cohort.status === "closed" || closingId === cohort.id}
                    onClick={() => closeCohort(cohort.id)}
                  >
                    {t("group_classes.close_cohort")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CohortFormDialog open={dialogOpen} initial={editing} onClose={() => setDialogOpen(false)} />
    </SettingsCard>
  );
}
