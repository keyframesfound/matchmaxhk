import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExternalLink, Loader2, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MtrStationMultiSelect } from "@/components/ui/mtr-station-select";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { requestAccountDeletion } from "@/lib/account.functions";
import { contactFilterError } from "@/lib/contact-filter";
import { notifyTutorPriceChange } from "@/lib/tutor-pricing.functions";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import { ProfileTagsField } from "@/features/tutors/profile-tags-field";
import { getSystem } from "@/features/tutors/examSystems";
import {
  ACADEMIC_HEADLINE_MAX,
  MAX_RATE_ROWS,
  RATE_MAX,
  RATE_MIN,
  RATE_NOTE_MAX,
  RATE_ROW_LABEL_MAX,
  TRAVEL_NOTE_MAX,
  buildSmartHeadline,
  normalizeTutorRateRows,
} from "@/features/tutors/rates";
import { suggestTutorRates } from "@/features/tutors/rates.functions";
import {
  TARGET_STUDENT_OPTIONS,
  formDataToPayload,
  tutorFormSchema,
  tutorToFormData,
  type TutorFormData,
} from "@/features/tutors/admin/TutorEditor";
import { fetchEducationValues, fetchPublishedTutors, type Tutor } from "@/features/tutors/queries";
import { popularProfileTags } from "@/features/tutors/profile-tags";
import {
  collectEducationValueSets,
  highSchoolEditorOptions,
  majorEditorOptions,
  universityEditorOptions,
} from "@/features/tutors/education-filters";

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
  "id, display_name, headline, card_highlights, academic_headline, undergrad_university, undergrad_degree, undergrad_graduation_year, has_postgrad, postgrad_university, postgrad_degree, secondary_school, target_students, qualifications_summary, self_introduction, subjects, district, stations, lesson_mode, hourly_rate, pricing_tiers, online_rate, inperson_rate, rate_rows, travel_note, rate_note, photo_url, profile_tags, tutor_code, is_published, start_immediately, earliest_start_date, experience_years, languages, exam_results, achievements, ia_ee_tok_support, ia_ee_tok_notes, gender, tutor_status, deletion_requested_at";

type MyTutorRow = Tutor & {
  user_id?: string | null;
  deletion_requested_at?: string | null;
};

/** Normalized tier list for change detection (issue #110). */
function sortTiersForCompare(tiers: { curriculum: string; rate: number }[]) {
  return [...tiers]
    .map((tier) => ({ curriculum: tier.curriculum.trim().toLowerCase(), rate: tier.rate }))
    .sort((a, b) => a.curriculum.localeCompare(b.curriculum) || a.rate - b.rate);
}

/** Draft shape for the rate editor (issue #319) — strings so an empty input
 * stays distinguishable from a typed 0 while the tutor is mid-edit. */
type RateRowDraft = { label: string; rate: string };

type RatesDraft = {
  onlineRate: string;
  inPersonRate: string;
  rows: RateRowDraft[];
  travelNote: string;
  rateNote: string;
};

/** Validated rate columns written to the tutors row on save. */
type SavedRateColumns = {
  online_rate: number | null;
  inperson_rate: number | null;
  rate_rows: { label: string; rate: number }[];
  travel_note: string | null;
  rate_note: string | null;
};

function ratesFromRow(row: MyTutorRow): RatesDraft {
  const savedRows = Array.isArray(row.rate_rows) ? row.rate_rows : [];
  return {
    onlineRate: typeof row.online_rate === "number" ? String(row.online_rate) : "",
    inPersonRate: typeof row.inperson_rate === "number" ? String(row.inperson_rate) : "",
    rows: savedRows
      .slice(0, MAX_RATE_ROWS)
      .map((rateRow) => ({ label: rateRow.label ?? "", rate: String(rateRow.rate ?? "") })),
    travelNote: row.travel_note ?? "",
    rateNote: row.rate_note ?? "",
  };
}

/** "" → null (cleared); whole dollars inside the 50-3000 band → number;
 * anything else → "invalid" (decimals, out of range). */
function parseRateInput(raw: string): number | null | "invalid" {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d+$/u.test(text)) return "invalid";
  const value = Number(text);
  return value >= RATE_MIN && value <= RATE_MAX ? value : "invalid";
}

/**
 * Issue #323 — curricula the Smart Default headline is derived from. Exam
 * systems use their display label ("IB Diploma"); pricing-tier curricula are
 * the tutor's own teachable curriculum names. Scores are intentionally blank
 * here: this editor doesn't edit per-subject grades, so the Smart Default
 * leans on rule 3 ("IB Diploma Tutor").
 */
function smartHeadlineEntries(form: TutorFormData) {
  const entries: { curriculum: string; score?: string | null }[] = [];
  const seen = new Set<string>();
  const push = (curriculum: string) => {
    const name = curriculum.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    entries.push({ curriculum: name, score: null });
  };
  for (const result of form.exam_results) {
    push(getSystem(result.system)?.label ?? result.system);
  }
  for (const tier of form.pricing_tiers) push(tier.curriculum);
  return entries;
}

export function MyTutorProfileSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<TutorFormData | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [rates, setRates] = React.useState<RatesDraft | null>(null);
  // Issue #323: false while the headline still exactly equals the Smart
  // Default (safe to auto-update); any manual edit flips it to true and the
  // custom text is then protected from regeneration.
  const [headlineDirty, setHeadlineDirty] = React.useState(true);
  const [suggestPending, setSuggestPending] = React.useState(false);
  const [suggestHint, setSuggestHint] = React.useState<string | null>(null);

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
    if (!tutorQuery.data) return;
    const nextForm = tutorToFormData(tutorQuery.data);
    setForm(nextForm);
    setRates(ratesFromRow(tutorQuery.data));
    // Issue #323: a saved headline exactly matching the Smart Default is a
    // generated value (isDirty=false → may auto-update later); anything else
    // is the tutor's custom text (isDirty=true → protected).
    const smart = buildSmartHeadline(smartHeadlineEntries(nextForm));
    setHeadlineDirty((tutorQuery.data.academic_headline ?? "").trim() !== smart);
  }, [tutorQuery.data]);

  // Institution spellings already in use on tutor profiles, so tutors pick an
  // existing university/school/major instead of typing a new variant.
  const educationValuesQuery = useQuery({
    queryKey: ["tutors", "education-values"],
    queryFn: fetchEducationValues,
  });

  // Issue #311: tags used by 3+ tutors, for type-ahead suggestions with
  // their tutor counts.
  const tagSuggestionsQuery = useQuery({
    queryKey: ["tutors", "tag-suggestions"],
    queryFn: fetchPublishedTutors,
    select: (tutors) => popularProfileTags(tutors),
    staleTime: 5 * 60 * 1000,
  });
  const educationValues = React.useMemo(
    () => collectEducationValueSets(educationValuesQuery.data ?? []),
    [educationValuesQuery.data],
  );

  const notifyPriceChange = useServerFn(notifyTutorPriceChange);

  const save = useMutation({
    mutationFn: async ({
      data,
      rates: savedRates,
    }: {
      data: TutorFormData;
      rates: SavedRateColumns;
    }) => {
      // Reuse the admin editor's normalization, minus fields the tutor must
      // never change: tutor_code (their public slug) and field state. Capacity
      // and the availability grid are omitted too — they have their own
      // self-serve editors in the Availability section (update_my_capacity /
      // update_my_availability_grid RPCs) and this form doesn't read them, so
      // carrying them through would overwrite real values with defaults.
      const {
        tutor_code: _keepCode,
        remaining_student_slots: _slots,
        is_accepting_students: _accepting,
        preferred_time_windows: _windows,
        availability_grid: _grid,
        ...rest
      } = formDataToPayload(data);
      const previous = tutorQuery.data;

      // Issue #319: the new base-rate columns always follow this form. With at
      // least one base rate set, hourly_rate is kept consistent for legacy
      // surfaces (min of the two, matching the DB trigger's card floor).
      // With neither set, the columns are nulled and the legacy pricing
      // fields are left exactly as the row already has them.
      const hasBaseRate = savedRates.online_rate !== null || savedRates.inperson_rate !== null;
      const payload: Record<string, unknown> = { ...rest, ...savedRates };
      if (hasBaseRate) {
        payload.hourly_rate = Math.min(
          savedRates.online_rate ?? Number.POSITIVE_INFINITY,
          savedRates.inperson_rate ?? Number.POSITIVE_INFINITY,
        );
      } else {
        delete payload.hourly_rate;
        delete payload.pricing_tiers;
      }

      const { error } = await supabase
        .from("tutors")
        .update(payload as never)
        .eq("user_id", user!.id);
      if (error) throw error;

      // Issue #110: after a successful save, ping the admin safety-guardrail
      // when pricing actually changed. Best-effort — a notification failure
      // must never block the tutor's save (the server fn also swallows).
      const nextTiers = Array.isArray(payload.pricing_tiers)
        ? (payload.pricing_tiers as { curriculum: string; rate: number }[])
        : undefined;
      const pricingChanged =
        previous &&
        (("hourly_rate" in payload && previous.hourly_rate !== payload.hourly_rate) ||
          (nextTiers !== undefined &&
            JSON.stringify(sortTiersForCompare(previous.pricing_tiers ?? [])) !==
              JSON.stringify(sortTiersForCompare(nextTiers))));
      if (pricingChanged && current?.tutor_code) {
        try {
          await notifyPriceChange({
            data: {
              tutorCode: current.tutor_code,
              displayName: current.display_name ?? "",
              hourlyRate:
                typeof payload.hourly_rate === "number"
                  ? payload.hourly_rate
                  : (previous.hourly_rate ?? 0),
              pricingTiers: nextTiers ?? previous.pricing_tiers ?? [],
              previousHourlyRate: previous.hourly_rate ?? 0,
              previousPricingTiers: previous.pricing_tiers ?? [],
            },
          });
        } catch (notifyError) {
          console.error("[my-tutor] price-change notification failed:", notifyError);
        }
      }
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

  const current = tutorQuery.data;
  const loading = tutorQuery.isLoading;

  const smartHeadline = React.useMemo(
    () => (form ? buildSmartHeadline(smartHeadlineEntries(form)) : ""),
    [form],
  );

  // Issue #319: suggest-a-rate anchors to the subjects picked in THIS form
  // plus the curricula already on the card (exam systems + pricing tiers).
  const suggestCurricula = React.useMemo(
    () => (form ? smartHeadlineEntries(form).map((entry) => entry.curriculum) : []),
    [form],
  );

  const handleSuggestRate = async () => {
    if (!current?.tutor_code || !form) return;
    setSuggestHint(null);
    setSuggestPending(true);
    try {
      const result = await suggestTutorRates({
        data: {
          tutorCode: current.tutor_code,
          subjects: form.subjects,
          curricula: suggestCurricula,
        },
      });
      if (result.status === "not_enough_data") {
        setSuggestHint(t("settings.my_tutor.suggest_not_enough_data"));
        return;
      }
      // Fill only the empty base fields — a typed number is never overwritten.
      setRates((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          onlineRate:
            prev.onlineRate === "" && result.online !== null
              ? String(result.online)
              : prev.onlineRate,
          inPersonRate:
            prev.inPersonRate === "" && result.inPerson !== null
              ? String(result.inPerson)
              : prev.inPersonRate,
        };
      });
    } catch (suggestError) {
      // Auth/ownership failures are swallowed — suggesting is best-effort.
      console.error("[my-tutor] suggest-a-rate failed:", suggestError);
    } finally {
      setSuggestPending(false);
    }
  };

  const handleRateField = (patch: Partial<RatesDraft>) => {
    setRates((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || !rates) return;
    // Issue #215: block the save when the public introduction carries a
    // phone number, email, link, or chat-app handle. Client-side twin of
    // the same rule the concierge flow enforces at intake.
    const introContactError = contactFilterError(form.self_introduction ?? "");
    if (introContactError) {
      setErrors((currentErrors) => ({ ...currentErrors, self_introduction: introContactError }));
      toast.error(introContactError);
      return;
    }

    const nextErrors: Record<string, string> = {};

    // Issue #323: headline capped at 40 chars + contact-filtered.
    const headline = (form.academic_headline ?? "").trim();
    if (headline.length > ACADEMIC_HEADLINE_MAX) {
      nextErrors.academic_headline = t("settings.my_tutor.academic_headline_max");
    } else {
      const headlineContactError = contactFilterError(headline);
      if (headlineContactError) nextErrors.academic_headline = headlineContactError;
    }

    // Issue #319: base rates must be whole dollars inside 50-3000, and the
    // failing field is named.
    const onlineParsed = parseRateInput(rates.onlineRate);
    const inPersonParsed = parseRateInput(rates.inPersonRate);
    if (onlineParsed === "invalid") {
      nextErrors.online_rate = t("settings.my_tutor.rate_invalid_online");
    }
    if (inPersonParsed === "invalid") {
      nextErrors.inperson_rate = t("settings.my_tutor.rate_invalid_in_person");
    }

    // Extra rows: normalizeTutorRateRows rejects half-filled rows, out-of-band
    // rates and contact details in labels; empty rows are dropped silently.
    const rowsResult = normalizeTutorRateRows(rates.rows);
    if (!rowsResult.ok) {
      nextErrors.rate_rows = rowsResult.errors.join(" ");
    }

    // Travel note exists only for in-person lessons.
    const travelNote = rates.travelNote.trim();
    if (travelNote.length > TRAVEL_NOTE_MAX) {
      nextErrors.travel_note = t("settings.my_tutor.travel_note_max");
    } else {
      const travelContactError = contactFilterError(travelNote);
      if (travelContactError) {
        nextErrors.travel_note = travelContactError;
      } else if (travelNote && inPersonParsed === null) {
        nextErrors.travel_note = t("settings.my_tutor.travel_note_needs_in_person");
      }
    }

    const rateNote = rates.rateNote.trim();
    if (rateNote.length > RATE_NOTE_MAX) {
      nextErrors.rate_note = t("settings.my_tutor.rate_note_max");
    } else {
      const rateNoteContactError = contactFilterError(rateNote);
      if (rateNoteContactError) nextErrors.rate_note = rateNoteContactError;
    }

    const parsed = tutorFormSchema.safeParse(form);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(t("settings.my_tutor.form_errors"));
      return;
    }
    setErrors({});
    save.mutate({
      data: parsed.data as TutorFormData,
      rates: {
        online_rate: onlineParsed === "invalid" ? null : onlineParsed,
        inperson_rate: inPersonParsed === "invalid" ? null : inPersonParsed,
        rate_rows: rowsResult.rows,
        travel_note: travelNote || null,
        rate_note: rateNote || null,
      },
    });
  };

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
      ) : !current || !form || !rates ? (
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
                maxLength={ACADEMIC_HEADLINE_MAX}
                onChange={(e) => {
                  setForm({ ...form, academic_headline: e.target.value });
                  // Issue #323: manual typing protects the text for the session.
                  setHeadlineDirty(true);
                }}
                onBlur={() => {
                  // Issue #323: emptying the field and blurring falls back to
                  // a freshly generated Smart Default (and unlocks auto-update).
                  if (!(form.academic_headline ?? "").trim()) {
                    setForm({ ...form, academic_headline: smartHeadline });
                    setHeadlineDirty(false);
                  }
                }}
                placeholder="e.g. IBDP 44/45 or HKDSE Best 5: 32"
                className="bg-[color:var(--surface)]"
              />
              {errors.academic_headline ? (
                <p className="text-xs font-medium text-destructive">{errors.academic_headline}</p>
              ) : !headlineDirty && smartHeadline ? (
                <p className="text-xs text-[color:var(--ink)]/55">
                  {t("settings.my_tutor.academic_headline_auto_hint")}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="myt-secondary" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.secondary_school")}
              </Label>
              <SearchableSelect
                value={form.secondary_school ?? ""}
                onChange={(v) => setForm({ ...form, secondary_school: v })}
                options={highSchoolEditorOptions(
                  form.secondary_school,
                  educationValues.highSchools,
                )}
                emptyText={t("settings.my_tutor.education_empty_hint")}
                allowCustom
                className="bg-[color:var(--surface)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="myt-undergrad-uni" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.undergrad_university")}
              </Label>
              <SearchableSelect
                value={form.undergrad_university ?? ""}
                onChange={(v) => setForm({ ...form, undergrad_university: v })}
                options={universityEditorOptions(
                  form.undergrad_university,
                  educationValues.universities,
                )}
                emptyText={t("settings.my_tutor.education_empty_hint")}
                allowCustom
                className="bg-[color:var(--surface)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="myt-undergrad-degree" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.undergrad_degree")}
              </Label>
              <SearchableSelect
                value={form.undergrad_degree ?? ""}
                onChange={(v) => setForm({ ...form, undergrad_degree: v })}
                options={majorEditorOptions(form.undergrad_degree, educationValues.majors)}
                emptyText={t("settings.my_tutor.education_empty_hint")}
                allowCustom
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
              aria-invalid={errors.self_introduction ? true : undefined}
              className={cn(
                "bg-[color:var(--surface)]",
                errors.self_introduction && "border-destructive",
              )}
            />
            {errors.self_introduction ? (
              <p className="text-xs font-medium text-destructive">{errors.self_introduction}</p>
            ) : null}
            <p className="text-xs text-[color:var(--ink)]/55">
              {t("settings.my_tutor.self_introduction_hint")}
            </p>
          </div>

          {/* Issue #217/#311: up to five free-text tags, shown on the public
              card. Type-ahead suggests existing tags with tutor counts. */}
          <ProfileTagsField
            tags={form.profile_tags}
            onChange={(profile_tags) => setForm({ ...form, profile_tags })}
            suggestions={tagSuggestionsQuery.data}
          />

          {/* Issue #319: base rates + extra rows + travel/rate notes. At least
              one base rate keeps hourly_rate in sync; with neither set the
              legacy pricing fields are left untouched. */}
          <div className="space-y-4 rounded-xl border border-[color:var(--ink)]/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-[color:var(--ink)]">
                {t("settings.my_tutor.rates_heading")}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={form.subjects.length === 0 || suggestPending}
                onClick={handleSuggestRate}
              >
                {suggestPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    {t("settings.my_tutor.suggest_a_rate")}
                  </>
                ) : (
                  t("settings.my_tutor.suggest_a_rate")
                )}
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="myt-rate-online" className="text-[color:var(--ink)]">
                  {t("settings.my_tutor.rates_online")}
                </Label>
                <Input
                  id="myt-rate-online"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={RATE_MIN}
                  max={RATE_MAX}
                  value={rates.onlineRate}
                  onChange={(e) =>
                    handleRateField({
                      onlineRate: e.target.value.replace(/[^\d]/gu, "").slice(0, 4),
                    })
                  }
                  aria-invalid={errors.online_rate ? true : undefined}
                  className="bg-[color:var(--surface)]"
                />
                {errors.online_rate ? (
                  <p className="text-xs font-medium text-destructive">{errors.online_rate}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="myt-rate-inperson" className="text-[color:var(--ink)]">
                  {t("settings.my_tutor.rates_in_person")}
                </Label>
                <Input
                  id="myt-rate-inperson"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={RATE_MIN}
                  max={RATE_MAX}
                  value={rates.inPersonRate}
                  onChange={(e) =>
                    handleRateField({
                      inPersonRate: e.target.value.replace(/[^\d]/gu, "").slice(0, 4),
                    })
                  }
                  aria-invalid={errors.inperson_rate ? true : undefined}
                  className="bg-[color:var(--surface)]"
                />
                {errors.inperson_rate ? (
                  <p className="text-xs font-medium text-destructive">{errors.inperson_rate}</p>
                ) : null}
              </div>
            </div>
            {suggestHint ? (
              <p className="text-xs text-[color:var(--ink)]/60">{suggestHint}</p>
            ) : null}

            {rates.rows.length > 0 || errors.rate_rows ? (
              <div className="space-y-2">
                <Label className="text-[color:var(--ink)]">
                  {t("settings.my_tutor.rate_rows_label")}
                </Label>
                {rates.rows.map((row, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={row.label}
                      maxLength={RATE_ROW_LABEL_MAX}
                      placeholder={t("settings.my_tutor.rate_row_label")}
                      aria-label={t("settings.my_tutor.rate_row_label")}
                      onChange={(e) => {
                        const nextRows = [...rates.rows];
                        nextRows[index] = { ...row, label: e.target.value };
                        handleRateField({ rows: nextRows });
                      }}
                      className="flex-1 bg-[color:var(--surface)]"
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      step={1}
                      min={RATE_MIN}
                      max={RATE_MAX}
                      value={row.rate}
                      placeholder={t("settings.my_tutor.rate_row_rate")}
                      aria-label={t("settings.my_tutor.rate_row_rate")}
                      onChange={(e) => {
                        const nextRows = [...rates.rows];
                        nextRows[index] = {
                          ...row,
                          rate: e.target.value.replace(/[^\d]/gu, "").slice(0, 4),
                        };
                        handleRateField({ rows: nextRows });
                      }}
                      className="w-28 bg-[color:var(--surface)]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={t("settings.my_tutor.remove_rate_row")}
                      onClick={() =>
                        handleRateField({ rows: rates.rows.filter((_, i) => i !== index) })
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
                {errors.rate_rows ? (
                  <p className="text-xs font-medium text-destructive">{errors.rate_rows}</p>
                ) : null}
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rates.rows.length >= MAX_RATE_ROWS}
              onClick={() => handleRateField({ rows: [...rates.rows, { label: "", rate: "" }] })}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t("settings.my_tutor.add_rate_row")}
            </Button>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="myt-travel-note" className="text-[color:var(--ink)]">
                  {t("settings.my_tutor.travel_note")}
                </Label>
                <Input
                  id="myt-travel-note"
                  value={rates.travelNote}
                  maxLength={TRAVEL_NOTE_MAX}
                  disabled={rates.inPersonRate.trim() === ""}
                  placeholder={t("settings.my_tutor.travel_note_placeholder")}
                  aria-invalid={errors.travel_note ? true : undefined}
                  onChange={(e) => handleRateField({ travelNote: e.target.value })}
                  className="bg-[color:var(--surface)]"
                />
                {errors.travel_note ? (
                  <p className="text-xs font-medium text-destructive">{errors.travel_note}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="myt-rate-note" className="text-[color:var(--ink)]">
                  {t("settings.my_tutor.rate_note_label")}
                </Label>
                <Input
                  id="myt-rate-note"
                  value={rates.rateNote}
                  maxLength={RATE_NOTE_MAX}
                  placeholder={t("settings.my_tutor.rate_note_placeholder")}
                  aria-invalid={errors.rate_note ? true : undefined}
                  onChange={(e) => handleRateField({ rateNote: e.target.value })}
                  className="bg-[color:var(--surface)]"
                />
                {errors.rate_note ? (
                  <p className="text-xs font-medium text-destructive">{errors.rate_note}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="myt-mode" className="text-[color:var(--ink)]">
              {t("settings.my_tutor.lesson_mode")}
            </Label>
            <SearchableSelect
              value={form.lesson_mode}
              onChange={(v) => setForm({ ...form, lesson_mode: v as TutorFormData["lesson_mode"] })}
              options={[
                { value: "either", label: t("settings.my_tutor.mode_either") },
                { value: "online", label: t("settings.my_tutor.mode_online") },
                { value: "in_person", label: t("settings.my_tutor.mode_in_person") },
              ]}
            />
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
