import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MtrStationMultiSelect } from "@/components/ui/mtr-station-select";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { requestAccountDeletion } from "@/lib/account.functions";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import {
  TARGET_STUDENT_OPTIONS,
  formDataToPayload,
  tutorFormSchema,
  tutorToFormData,
  type TutorFormData,
} from "@/features/tutors/admin/TutorEditor";
import type { Tutor } from "@/features/tutors/queries";

/**
 * "My tutor profile" — full self-serve editing for tutors whose MatchMax
 * account is linked to a tutor card (tutors.user_id, set by admins in the
 * editor's Assigned Account section, issue #160). Saves go live immediately:
 * the tutors_owner_update RLS policy (also issue #160) allows the assigned
 * account to UPDATE its own row, with user_id pinned by WITH CHECK. Admins
 * keep full control via the tutor editor.
 */

/** Columns the tutor-facing editor reads/writes. Mirrors SELECT_COLS minus
 * admin-managed identity (tutor_code, created_at, referral). */
const MY_TUTOR_COLUMNS =
  "id, display_name, headline, card_highlights, academic_headline, undergrad_university, undergrad_degree, undergrad_graduation_year, has_postgrad, postgrad_university, postgrad_degree, secondary_school, target_students, qualifications_summary, self_introduction, subjects, district, stations, lesson_mode, hourly_rate, pricing_tiers, photo_url, tutor_code, is_published, start_immediately, earliest_start_date, experience_years, languages, exam_results, achievements, ia_ee_tok_support, ia_ee_tok_notes, gender, tutor_status, deletion_requested_at";

type MyTutorRow = Tutor & {
  user_id?: string | null;
  deletion_requested_at?: string | null;
};

export function MyTutorProfileSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<TutorFormData | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const tutorQuery = useQuery({
    queryKey: ["settings", "my-tutor-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(MY_TUTOR_COLUMNS)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as MyTutorRow | null;
    },
    enabled: Boolean(user),
  });

  React.useEffect(() => {
    if (tutorQuery.data) setForm(tutorToFormData(tutorQuery.data));
  }, [tutorQuery.data]);

  const save = useMutation({
    mutationFn: async (data: TutorFormData) => {
      // Reuse the admin editor's normalization, minus fields the tutor must
      // never change: tutor_code (their public slug) and field state.
      const { tutor_code: _keepCode, ...rest } = formDataToPayload(data);
      const { error } = await supabase
        .from("tutors")
        .update(rest as never)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["settings", "my-tutor-profile", user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      toast.success(t("settings.my_tutor.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const parsed = tutorFormSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path.join(".")] = issue.message;
      setErrors(errs);
      toast.error(t("settings.my_tutor.form_errors"));
      return;
    }
    setErrors({});
    save.mutate(parsed.data as TutorFormData);
  };

  const current = tutorQuery.data;
  const loading = tutorQuery.isLoading;

  // Issue #101: instant hide (reuses is_published) + admin-reviewed deletion.
  const [hidePending, setHidePending] = React.useState(false);
  const deletionPending = Boolean(current?.deletion_requested_at);

  const hideMutation = useMutation({
    mutationFn: async (checked: boolean) => {
      const { error } = await supabase
        .from("tutors")
        .update({ is_published: checked })
        .eq("user_id", user!.id);
      if (error) throw error;
      return checked;
    },
    onSuccess: async (checked) => {
      // Keep the form in sync when the toggle result differs from an
      // unsaved draft the tutor may have been editing.
      if (form) setForm({ ...form, is_published: checked });
      await queryClient.invalidateQueries({
        queryKey: ["settings", "my-tutor-profile", user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      toast.success(
        t(checked ? "settings.my_tutor.hidden_toast" : "settings.my_tutor.shown_toast"),
      );
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setHidePending(false),
  });

  const deletionMutation = useMutation({
    mutationFn: async () => {
      const result = await requestAccountDeletion({ data: {} });
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["settings", "my-tutor-profile", user?.id],
      });
      toast.success(t("settings.my_tutor.deletion_requested_toast"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SettingsCard
      title={t("settings.my_tutor.title")}
      description={t("settings.my_tutor.description")}
    >
      {loading ? (
        <div className="space-y-4" aria-hidden>
          <div className="h-10 animate-pulse rounded-xl bg-[color:var(--ink)]/5" />
          <div className="h-24 animate-pulse rounded-xl bg-[color:var(--ink)]/5" />
          <div className="h-10 animate-pulse rounded-xl bg-[color:var(--ink)]/5" />
        </div>
      ) : tutorQuery.isError ? (
        <p className="text-sm font-medium text-destructive">{t("settings.load_error")}</p>
      ) : !current || !form ? (
        <p className="text-sm leading-6 text-[color:var(--ink)]/70">
          {t("settings.my_tutor.not_linked")}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {current.tutor_code ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/tutors/$tutorCode"
                params={{ tutorCode: current.tutor_code }}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)] underline-offset-4 hover:underline"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t("settings.my_tutor.view_public")}
              </Link>
            </div>
          ) : null}

          {/* Issue #101: instant visibility toggle — reuses is_published. */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3">
            <div>
              <Label className="text-sm font-bold text-[color:var(--ink)]">
                {t("settings.my_tutor.hide_profile_label")}
              </Label>
              <p className="mt-0.5 text-xs text-[color:var(--ink)]/60">
                {t("settings.my_tutor.hide_profile_hint")}
              </p>
            </div>
            <Switch
              checked={!form.is_published}
              disabled={hidePending}
              onCheckedChange={(hide) => {
                setHidePending(true);
                hideMutation.mutate(!hide);
              }}
              aria-label={t("settings.my_tutor.hide_profile_label")}
            />
          </div>

          {/* Issue #101: deletion requests are queued for admin review — no
              self-serve wipe, so active cases and matching fees stay settled. */}
          <div className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3">
            <Label className="text-sm font-bold text-[color:var(--ink)]">
              {t("settings.my_tutor.deletion_label")}
            </Label>
            <p className="mt-1 text-xs leading-5 text-[color:var(--ink)]/60">
              {t("settings.my_tutor.deletion_help")}
            </p>
            {deletionPending ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                {t("settings.my_tutor.deletion_pending_badge")}
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={deletionMutation.isPending}
                onClick={() => deletionMutation.mutate()}
                className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {deletionMutation.isPending
                  ? t("settings.my_tutor.deletion_submitting")
                  : t("settings.my_tutor.deletion_button")}
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="myt-academic" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.academic_headline")}
              </Label>
              <Input
                id="myt-academic"
                value={form.academic_headline}
                onChange={(e) => setForm({ ...form, academic_headline: e.target.value })}
                placeholder="e.g. IBDP 44/45 or HKDSE Best 5: 32"
                className="bg-[color:var(--surface)]"
              />
              {errors.academic_headline ? (
                <p className="text-xs font-medium text-destructive">{errors.academic_headline}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="myt-secondary" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.secondary_school")}
              </Label>
              <Input
                id="myt-secondary"
                value={form.secondary_school}
                onChange={(e) => setForm({ ...form, secondary_school: e.target.value })}
                className="bg-[color:var(--surface)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="myt-undergrad-uni" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.undergrad_university")}
              </Label>
              <Input
                id="myt-undergrad-uni"
                value={form.undergrad_university}
                onChange={(e) => setForm({ ...form, undergrad_university: e.target.value })}
                className="bg-[color:var(--surface)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="myt-undergrad-degree" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.undergrad_degree")}
              </Label>
              <Input
                id="myt-undergrad-degree"
                value={form.undergrad_degree}
                onChange={(e) => setForm({ ...form, undergrad_degree: e.target.value })}
                className="bg-[color:var(--surface)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="myt-qualifications" className="text-[color:var(--ink)]">
              {t("settings.my_tutor.qualifications")}
            </Label>
            <Textarea
              id="myt-qualifications"
              value={form.qualifications_summary}
              onChange={(e) => setForm({ ...form, qualifications_summary: e.target.value })}
              rows={4}
              className="bg-[color:var(--surface)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="myt-intro" className="text-[color:var(--ink)]">
              {t("settings.my_tutor.self_introduction")}
            </Label>
            <Textarea
              id="myt-intro"
              value={form.self_introduction}
              onChange={(e) => setForm({ ...form, self_introduction: e.target.value })}
              rows={6}
              className="bg-[color:var(--surface)]"
            />
            <p className="text-xs text-[color:var(--ink)]/55">
              {t("settings.my_tutor.self_introduction_hint")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="myt-rate" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.hourly_rate")}
              </Label>
              <Input
                id="myt-rate"
                type="number"
                min={0}
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) || 0 })}
                className="bg-[color:var(--surface)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[color:var(--ink)]">
                {t("settings.my_tutor.lesson_mode")}
              </Label>
              <SearchableSelect
                value={form.lesson_mode}
                onChange={(v) =>
                  setForm({ ...form, lesson_mode: v as TutorFormData["lesson_mode"] })
                }
                options={[
                  { value: "either", label: t("settings.my_tutor.mode_either") },
                  { value: "online", label: t("settings.my_tutor.mode_online") },
                  { value: "in_person", label: t("settings.my_tutor.mode_in_person") },
                ]}
              />
            </div>
          </div>

          {form.lesson_mode !== "online" ? (
            <div className="space-y-2">
              <Label className="text-[color:var(--ink)]">{t("settings.my_tutor.stations")}</Label>
              <MtrStationMultiSelect
                value={form.stations}
                onChange={(stations) => setForm({ ...form, stations })}
              />
              {errors.stations ? (
                <p className="text-xs font-medium text-destructive">{errors.stations}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-[color:var(--ink)]">{t("settings.my_tutor.subjects")}</Label>
            <SearchableSelect
              value=""
              onChange={(subject) => {
                if (!subject || form.subjects.includes(subject)) return;
                setForm({ ...form, subjects: [...form.subjects, subject] });
              }}
              options={DEFAULT_SUBJECT_OPTIONS.filter((s) => !form.subjects.includes(s)).map(
                (s) => ({ value: s, label: s }),
              )}
              placeholder={t("settings.my_tutor.add_subject")}
            />
            {form.subjects.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {form.subjects.map((subject) => (
                  <span
                    key={subject}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ink)]/15 px-3 py-1 text-xs font-medium text-[color:var(--ink)]"
                  >
                    {subject}
                    <button
                      type="button"
                      aria-label={`${t("settings.my_tutor.remove_subject")} ${subject}`}
                      className="text-[color:var(--ink)]/50 hover:text-[color:var(--ink)]"
                      onClick={() =>
                        setForm({
                          ...form,
                          subjects: form.subjects.filter((s) => s !== subject),
                        })
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {errors.subjects ? (
              <p className="text-xs font-medium text-destructive">{errors.subjects}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-[color:var(--ink)]">
              {t("settings.my_tutor.target_students")}
            </Label>
            <SearchableSelect
              value=""
              onChange={(level) => {
                if (!level || form.target_students.includes(level)) return;
                setForm({ ...form, target_students: [...form.target_students, level] });
              }}
              options={TARGET_STUDENT_OPTIONS.filter(
                (level) => !form.target_students.includes(level),
              ).map((level) => ({ value: level, label: level }))}
              placeholder={t("settings.my_tutor.add_level")}
            />
            {form.target_students.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {form.target_students.map((level) => (
                  <span
                    key={level}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ink)]/15 px-3 py-1 text-xs font-medium text-[color:var(--ink)]"
                  >
                    {level}
                    <button
                      type="button"
                      aria-label={`${t("settings.my_tutor.remove_level")} ${level}`}
                      className="text-[color:var(--ink)]/50 hover:text-[color:var(--ink)]"
                      onClick={() =>
                        setForm({
                          ...form,
                          target_students: form.target_students.filter((l) => l !== level),
                        })
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <Button type="submit" disabled={save.isPending} className="font-bold">
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("settings.my_tutor.saving")}
              </>
            ) : (
              t("settings.my_tutor.save")
            )}
          </Button>
        </form>
      )}
    </SettingsCard>
  );
}
