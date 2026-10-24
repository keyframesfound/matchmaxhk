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
import { toCurrencyCode, SUPPORTED_CURRENCIES } from "@/lib/money";
import { approxHkdText } from "@/features/currency/convert";
import { useExchangeRates } from "@/features/currency/display-currency-context";
import { MAX_ACADEMIC_HEADLINE, academicHeadlineError } from "@/lib/academic-headline";
import { MAX_CUSTOM_HEADLINE } from "@/features/tutors/custom-headline";
import { draftChineseHeadline } from "@/features/tutors/headline-translate";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MtrStationMultiSelect } from "@/components/ui/mtr-station-select";
import { SettingsCard } from "@/features/settings/option-card";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { requestAccountDeletion } from "@/lib/account.functions";
import { contactFilterError } from "@/lib/contact-filter";
import { notifyTutorPriceChange } from "@/lib/tutor-pricing.functions";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import {
  COURSE_GRADE_OPTIONS,
  KINDERGARTEN_TOPICS,
  MAX_UNIVERSITY_COURSES,
  TARGET_TEACHING_LEVELS,
  YEARS_OF_STUDY,
  normalizeUniversityGpa,
} from "@/features/tutors/verticals";
import { useVerticalLabels } from "@/features/tutors/verticals-labels";
import {
  selectedTargetLevels,
  toggleKindergartenTopic,
  toggleTargetLevel,
} from "@/features/tutors/verticals-form";
import { SEN_CATEGORY_OPTIONS } from "@/features/tutors/sen";
import { useSenCategoryLabels } from "@/features/tutors/sen-labels";
import { ProfileTagsField } from "@/features/tutors/profile-tags-field";
import { TutorGradesEditor } from "@/features/settings/sections/tutor-grades-editor";
import { getSystem } from "@/features/tutors/examSystems";
import { GRADE_SLIP_ACCEPT_ATTRIBUTE } from "@/features/tutors/grades";
import {
  CREDENTIAL_EDIT_FIELDS,
  MAX_EVIDENCE_BYTES,
  validateCredentialEditInput,
  type CredentialEditField,
} from "@/features/tutors/credential-edits";
import {
  changedCredentialFields,
  credentialEditRejectionsMessage,
  submitCredentialEdit,
  type SubmitCredentialEditResult,
} from "@/features/tutors/credential-edit.functions";
import {
  MAX_RATE_ROWS,
  RATE_MAX,
  RATE_MIN,
  RATE_NOTE_MAX,
  RATE_ROW_DESCRIPTION_MAX,
  RATE_ROW_LABEL_MAX,
  RATE_ROW_MODES,
  TRAVEL_NOTE_MAX,
  normalizeTutorRateRows,
  type TutorRateRowMode,
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
 * "My tutor profile", full self-serve editing for tutors whose MatchMax
 * account is linked to a tutor card (tutors.user_id, set by admins in the
 * editor's Assigned Account section, issue #160). Saves go live immediately:
 * the tutors_owner_update RLS policy (also issue #160) allows the assigned
 * account to UPDATE its own row, with user_id pinned by WITH CHECK. Admins
 * keep full control via the tutor editor.
 */

/** Columns the tutor-facing editor reads/writes. Mirrors SELECT_COLS minus
 * admin-managed identity (tutor_code, created_at, referral). */
const MY_TUTOR_COLUMNS =
  "id, display_name, headline, card_highlights, academic_headline, custom_headline_en, custom_headline_zh, undergrad_university, undergrad_degree, undergrad_graduation_year, has_postgrad, postgrad_university, postgrad_degree, secondary_school, target_students, university_year_of_study, university_gpa, university_courses, course_specific_grades, qualifications_summary, self_introduction, subjects, district, stations, lesson_mode, hourly_rate, pricing_tiers, online_rate, inperson_rate, rate_rows, travel_note, rate_note, currency, photo_url, profile_tags, tutor_code, is_published, start_immediately, earliest_start_date, experience_years, languages, exam_results, achievements, ia_ee_tok_support, ia_ee_tok_notes, gender, tutor_status, verification_tier, sen_enabled, sen_categories, sen_experience, deletion_requested_at";

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

/** Draft shape for the rate editor (issue #319), strings so an empty input
 * stays distinguishable from a typed 0 while the tutor is mid-edit. #391:
 * each row carries its class mode and an optional 300-char description. */
type RateRowDraft = { label: string; rate: string; mode: string; description: string };

const EMPTY_RATE_ROW: RateRowDraft = { label: "", rate: "", mode: "one_on_one", description: "" };

type RatesDraft = {
  currency: string;
  onlineRate: string;
  inPersonRate: string;
  rows: RateRowDraft[];
  travelNote: string;
  rateNote: string;
};

/** Validated rate columns written to the tutors row on save. */
type SavedRateColumns = {
  currency: string;
  online_rate: number | null;
  inperson_rate: number | null;
  rate_rows: {
    label: string;
    rate: number;
    mode?: TutorRateRowMode;
    description?: string;
  }[];
  travel_note: string | null;
  rate_note: string | null;
};

/** "10.0 MB", evidence documents share the grade-slip 10 MB cap. */
function readableEvidenceSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Issue #284: uploaded evidence files travel to the server fn as base64. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Deep-clone a form value so the saved baseline never aliases live drafts. */
function cloneFormDataValue(value: unknown): unknown {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/** One tutor_credential_edits row as the owner sees it (RLS SELECT). */
type TutorCredentialEditRow = {
  id: string;
  field: string;
  status: "pending" | "approved" | "rejected";
  staff_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function ratesFromRow(row: MyTutorRow): RatesDraft {
  const savedRows = Array.isArray(row.rate_rows) ? row.rate_rows : [];
  return {
    currency: toCurrencyCode(row.currency),
    onlineRate: typeof row.online_rate === "number" ? String(row.online_rate) : "",
    inPersonRate: typeof row.inperson_rate === "number" ? String(row.inperson_rate) : "",
    rows: savedRows.slice(0, MAX_RATE_ROWS).map((rateRow) => ({
      label: rateRow.label ?? "",
      rate: String(rateRow.rate ?? ""),
      mode:
        rateRow.mode && (RATE_ROW_MODES as readonly string[]).includes(rateRow.mode)
          ? rateRow.mode
          : "one_on_one",
      description: rateRow.description ?? "",
    })),
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
 * Issue #319, curricula the suggest-a-rate query anchors to. Exam systems
 * use their display label ("IB Diploma"); pricing-tier curricula are the
 * tutor's own teachable curriculum names.
 */
function suggestCurriculaFor(form: TutorFormData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (curriculum: string) => {
    const name = curriculum.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  for (const result of form.exam_results) {
    push(getSystem(result.system)?.label ?? result.system);
  }
  for (const tier of form.pricing_tiers) push(tier.curriculum);
  return out;
}

export function MyTutorProfileSection() {
  const { t } = useTranslation();
  const senCategoryLabels = useSenCategoryLabels();
  const verticalLabels = useVerticalLabels();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<TutorFormData | null>(null);
  const [preferredName, setPreferredName] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [rates, setRates] = React.useState<RatesDraft | null>(null);
  // Issue #319 review: a mid-edit refetch (window focus, invalidation) must
  // not clobber unsaved rate edits, same race class as the #323 headline
  // fix. Once dirty, the draft only resets after a successful save.
  const ratesDirtyRef = React.useRef(false);
  const [suggestPending, setSuggestPending] = React.useState(false);
  const [suggestHint, setSuggestHint] = React.useState<string | null>(null);
  // Issue #284: per-field evidence documents for verified tutors' credential
  // changes, plus the form as the row loaded (to detect what actually changed).
  const [evidenceFiles, setEvidenceFiles] = React.useState<
    Partial<Record<CredentialEditField, File>>
  >({});
  const [editsSubmitting, setEditsSubmitting] = React.useState(false);
  const baselineFormRef = React.useRef<TutorFormData | null>(null);

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
    baselineFormRef.current = nextForm;
    if (!ratesDirtyRef.current) setRates(ratesFromRow(tutorQuery.data));
    // Epic #280 P2: preferred name is owner-editable, independent of the
    // tutor code. Held outside TutorFormData, the shared admin schema
    // derives display_name from tutor_code; owners set it directly.
    setPreferredName(tutorQuery.data.display_name ?? "");
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
  const submitEdit = useServerFn(submitCredentialEdit);

  const current = tutorQuery.data;
  const loading = tutorQuery.isLoading;

  // Epic #280 P3 / issue #284: verified tutors cannot write credential fields
  // directly (tutors_owner_verified_guard rejects the row), changes go
  // through the evidence-gated review queue instead.
  const isVerified = (current?.verification_tier ?? "tier_1_standard") === "tier_2_verified";

  const save = useMutation({
    mutationFn: async ({
      data,
      rates: savedRates,
      displayName,
    }: {
      data: TutorFormData;
      rates: SavedRateColumns;
      displayName: string;
    }) => {
      // Reuse the admin editor's normalization, minus fields the tutor must
      // never change: tutor_code (their public slug) and field state. Capacity
      // and the availability grid are omitted too, they have their own
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
      // Epic #280 P2: preferred name is owner-set, not derived from the code.
      rest.display_name = displayName.trim() || rest.display_name;
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
      // Issue #284: verified tutors never write the locked credential columns
      // directly, the owner guard would reject the whole row. Their changes
      // were already submitted through the evidence queue in handleSubmit.
      if (isVerified) {
        for (const field of CREDENTIAL_EDIT_FIELDS) delete payload[field];
        // Issue #367: the headline is frozen read-only for verified tutors
        // (tutors_owner_verified_guard freezes it), never send it in the
        // direct save either, or one stale form value fails the whole UPDATE.
        delete payload.academic_headline;
      }

      const { error } = await supabase
        .from("tutors")
        .update(payload as never)
        .eq("user_id", user!.id);
      if (error) throw error;

      // Issue #110: after a successful save, ping the admin safety-guardrail
      // when pricing actually changed. Best-effort, a notification failure
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
      ratesDirtyRef.current = false;
      await queryClient.invalidateQueries({
        queryKey: ["settings", "my-tutor-profile", user?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      toast.success(t("settings.my_tutor.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Issue #284: the tutor's own credential-edit requests (owner RLS SELECT —
  // status, staff reason, review time; no client write path exists).
  const credEditsQuery = useQuery({
    queryKey: ["tutor-credential-edits", user?.id],
    queryFn: async () => {
      const { data, error } = (await supabase
        .from("tutor_credential_edits" as never)
        .select("id, field, status, staff_reason, created_at, reviewed_at")
        .order("created_at", { ascending: false })
        .limit(20)) as unknown as {
        data: TutorCredentialEditRow[] | null;
        error: { message: string } | null;
      };
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: Boolean(user) && isVerified,
  });

  const credEdits = credEditsQuery.data ?? [];

  // Credential fields the verified tutor has changed relative to the loaded
  // row, these need documents before the form can be submitted. Recomputed
  // every render (11 fields): the baseline mutates on successful submits, so a
  // memo keyed on form alone would go stale.
  const changedCredFields =
    form && baselineFormRef.current ? changedCredentialFields(baselineFormRef.current, form) : [];

  // Issue #319: suggest-a-rate anchors to the subjects picked in THIS form
  // plus the curricula already on the card (exam systems + pricing tiers).
  const suggestCurricula = React.useMemo(() => (form ? suggestCurriculaFor(form) : []), [form]);

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
      // Fill only the empty base fields, a typed number is never overwritten.
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
      // Auth/ownership failures are swallowed, suggesting is best-effort.
      console.error("[my-tutor] suggest-a-rate failed:", suggestError);
    } finally {
      setSuggestPending(false);
    }
  };

  const handleRateField = (patch: Partial<RatesDraft>) => {
    ratesDirtyRef.current = true;
    setRates((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // Issue #411: RULE-BASED Auto-Translate DRAFT (no AI/LLM service, AI
  // features are parked in this repo). Fills the ZH input only so the tutor
  // can edit; whatever is saved is exactly what renders (CEO lock).
  const handleAutoTranslate = () => {
    if (!form) return;
    if (!form.custom_headline_en.trim()) {
      toast.info(t("settings.my_tutor.auto_translate_empty"));
      return;
    }
    setForm({ ...form, custom_headline_zh: draftChineseHeadline(form.custom_headline_en) });
    toast.success(t("settings.my_tutor.auto_translate_done"));
  };

  // Issue #113: live ≈HK$ equivalents under each rate input, following the
  // selected quoting currency (hidden for HKD, no conversion to show).
  const rateFxRates = useExchangeRates();
  const ratesCurrency = rates ? toCurrencyCode(rates.currency) : "HKD";
  const onlineApprox = rates
    ? approxHkdText(Number(rates.onlineRate), ratesCurrency, rateFxRates)
    : null;
  const inPersonApprox = rates
    ? approxHkdText(Number(rates.inPersonRate), ratesCurrency, rateFxRates)
    : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || !rates || !current) return;
    // Issue #215 / epic #280 P3: block the save when public free text carries
    // a phone number, email, link, or chat-app handle. Client-side twin of the
    // tutors_owner_contact_guard trigger.
    const contactErrors = [
      {
        field: "academic_headline" as const,
        error: contactFilterError(form.academic_headline ?? ""),
      },
      // Issue #411: the custom headlines are public text, mirror the DB
      // owner contact guard so the tutor sees the reason inline.
      {
        field: "custom_headline_en" as const,
        error: contactFilterError(form.custom_headline_en ?? ""),
      },
      {
        field: "custom_headline_zh" as const,
        error: contactFilterError(form.custom_headline_zh ?? ""),
      },
      {
        field: "qualifications_summary" as const,
        error: contactFilterError(form.qualifications_summary ?? ""),
      },
      {
        field: "self_introduction" as const,
        error: contactFilterError(form.self_introduction ?? ""),
      },
      // Issue #190: course tags and graded course codes are public text —
      // the DB owner guard scans them, mirror it here for inline UX.
      {
        field: "university_courses" as const,
        error: contactFilterError(
          [
            ...(form.university_courses ?? []),
            ...form.course_grade_rows.map((row) => row.course),
          ].join(", "),
        ),
      },
    ].filter((entry) => Boolean(entry.error));
    if (contactErrors.length > 0) {
      setErrors((current) => {
        const next = { ...current };
        for (const entry of contactErrors) next[entry.field] = entry.error as string;
        return next;
      });
      toast.error(contactErrors[0].error as string);
      return;
    }
    // Issue #323 review: the headline stays optional here (pre-#323 tutors may
    // have none), but a non-empty value must pass the shared 40-char +
    // contact-filter rule the public cards rely on, tutorFormSchema still
    // allows max 120 for admin-edited legacy rows.
    const headlineValue = (form.academic_headline ?? "").trim();
    if (headlineValue) {
      const headlineError = academicHeadlineError(headlineValue);
      if (headlineError) {
        setErrors((current) => ({ ...current, academic_headline: headlineError }));
        toast.error(headlineError);
        return;
      }
    }

    const nextErrors: Record<string, string> = {};

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

    // Issue #319 review: a rate for a mode the tutor does not offer is
    // dropped on save (same rule as /join), the card floor then recomputes
    // from the remaining base rates only.
    const onlineDropped = form.lesson_mode === "in_person";
    const inPersonDropped = form.lesson_mode === "online";
    const onlineValue = onlineDropped ? null : onlineParsed;
    const inPersonValue = inPersonDropped ? null : inPersonParsed;

    // Issue #319 AC: the last base rate cannot be deleted. Once the saved row
    // carries a base rate, an edit that clears both is rejected instead of
    // silently falling back to the legacy pricing fields.
    const hadBaseRate =
      (current?.online_rate ?? null) !== null || (current?.inperson_rate ?? null) !== null;
    if (
      hadBaseRate &&
      onlineValue !== "invalid" &&
      inPersonValue !== "invalid" &&
      onlineValue === null &&
      inPersonValue === null
    ) {
      nextErrors.online_rate = t("settings.my_tutor.rate_last_required");
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
      } else if (travelNote && !inPersonDropped && inPersonParsed === null) {
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

    // Issue #190: GPA is a free decimal 0–4.3 (blank allowed); an out-of-band
    // value is named here instead of being silently dropped on save.
    const gpaText = form.university_gpa.trim();
    if (gpaText && normalizeUniversityGpa(gpaText) === null) {
      nextErrors.university_gpa = t("verticals.editor_gpa_invalid");
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

    // Issue #284: verified tutors' credential changes never enter the direct
    // write. Each changed field is submitted as its own evidence-gated review
    // request; the rest of the form still saves normally (credential columns
    // are stripped from the verified payload in the save mutation).
    let workingForm: TutorFormData = form;
    if (isVerified && baselineFormRef.current) {
      const changedFields = changedCredentialFields(baselineFormRef.current, workingForm);
      if (changedFields.length > 0) {
        for (const field of changedFields) {
          const file = evidenceFiles[field];
          if (!file) {
            toast.error(t("credEdits.evidence_missing", { field: credFieldLabel(field) }));
            return;
          }
          // Same validation the server runs, fail fast, name the problem.
          const rejections = validateCredentialEditInput({
            field,
            newValue: (workingForm as unknown as Record<string, unknown>)[field],
            evidence: { name: file.name, size: file.size, type: file.type },
          });
          if (rejections.length > 0) {
            toast.error(credentialEditRejectionsMessage(rejections));
            return;
          }
        }
        setEditsSubmitting(true);
        try {
          for (const field of changedFields) {
            const file = evidenceFiles[field];
            if (!file) continue;
            const content = await fileToBase64(file);
            const result = (await submitEdit({
              data: {
                tutorId: current.id,
                field,
                newValue: (workingForm as unknown as Record<string, unknown>)[field],
                file: { filename: file.name, contentType: file.type, size: file.size, content },
              },
            })) as SubmitCredentialEditResult;
            if (result.ok) {
              toast.success(t("credEdits.submitted_toast"));
              setEvidenceFiles((previous) => {
                const next = { ...previous };
                delete next[field];
                return next;
              });
              // Freeze the baseline so the submitted value stops counting as
              // an unsaved change.
              baselineFormRef.current = {
                ...baselineFormRef.current,
                [field]: cloneFormDataValue(
                  (workingForm as unknown as Record<string, unknown>)[field],
                ),
              };
            } else {
              // One-open-per-field: a request for this field is already in the
              // queue. Snap the draft back to the public value and continue.
              toast.info(t("credEdits.already_review_toast", { field: credFieldLabel(field) }));
              const baselineRecord = baselineFormRef.current as Record<string, unknown>;
              workingForm = {
                ...workingForm,
                [field]: cloneFormDataValue(baselineRecord[field]),
              } as TutorFormData;
            }
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t("credEdits.submit_failed"));
          return;
        } finally {
          setEditsSubmitting(false);
        }
        await queryClient.invalidateQueries({
          queryKey: ["tutor-credential-edits", user?.id],
        });
      }
    }
    if (workingForm !== form) setForm(workingForm);

    save.mutate({
      data: workingForm,
      rates: {
        currency: toCurrencyCode(rates.currency),
        online_rate: onlineValue === "invalid" ? null : onlineValue,
        inperson_rate: inPersonValue === "invalid" ? null : inPersonValue,
        rate_rows: rowsResult.rows,
        travel_note: inPersonDropped ? null : travelNote || null,
        rate_note: rateNote || null,
      },
      displayName: preferredName,
    });
  };

  /** Existing-translation labels first; raw field name as the fallback. */
  const credFieldLabel = (field: string) => t(`credEdits.field_${field}`, { defaultValue: field });

  // Epic #280 P3: verified tutors cannot edit academic_headline (the guard
  // locks it and it has no evidence queue); the 11 credential fields below are
  // reopened by issue #284's evidence-gated review flow.

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
                data-tour="tutor-preview"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--ink)] underline-offset-4 hover:underline"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t("settings.my_tutor.view_public")}
              </Link>
            </div>
          ) : null}

          {/* Issue #101: instant visibility toggle, reuses is_published. */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3">
            <div>
              <Label className="text-sm font-medium text-[color:var(--ink)]">
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

          {/* Issue #101: deletion requests are queued for admin review, no
              self-serve wipe, so active cases and matching fees stay settled. */}
          <div className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3">
            <Label className="text-sm font-medium text-[color:var(--ink)]">
              {t("settings.my_tutor.deletion_label")}
            </Label>
            <p className="mt-1 text-xs leading-5 text-[color:var(--ink)]/60">
              {t("settings.my_tutor.deletion_help")}
            </p>
            {deletionPending ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
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

          {/* Issue #284: the evidence rule replaces the old hard lock note. */}
          {isVerified ? (
            <p className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3 text-xs leading-5 text-[color:var(--ink)]/70">
              {t("credEdits.lock_note")}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="myt-name" className="text-[color:var(--ink)]">
              {t("settings.my_tutor.display_name")}
            </Label>
            <Input
              id="myt-name"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              maxLength={60}
              className="bg-[color:var(--surface)]"
            />
            <p className="text-xs text-[color:var(--ink)]/55">
              {t("settings.my_tutor.display_name_hint")}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="myt-academic" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.academic_headline")}
              </Label>
              <Input
                id="myt-academic"
                value={form.academic_headline}
                maxLength={MAX_ACADEMIC_HEADLINE}
                onChange={(e) => setForm({ ...form, academic_headline: e.target.value })}
                disabled={isVerified}
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
              {/* Verified tutors edit this through the #284 evidence queue, same
                  as undergrad degree, the owner guard blocks a direct write. */}
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

          {/* Issue #411: dual-language custom headline, the card's bold Row 1.
              60-char cap mirrors the DB CHECK; the live counter shows the room
              left. Saved through the section's owner UPDATE (the tutors_owner_
              contact_guard trigger and CHECK enforce the server side). */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="myt-headline-en" className="text-[color:var(--ink)]">
                {t("settings.my_tutor.custom_headline_en")}
              </Label>
              <Input
                id="myt-headline-en"
                value={form.custom_headline_en}
                maxLength={MAX_CUSTOM_HEADLINE}
                onChange={(e) => setForm({ ...form, custom_headline_en: e.target.value })}
                placeholder="e.g. IBDP 41/45 | Imperial Aero Eng"
                className="bg-[color:var(--surface)]"
              />
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-[color:var(--ink)]/55">
                  {t("settings.my_tutor.custom_headline_hint")}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {form.custom_headline_en.length}/{MAX_CUSTOM_HEADLINE}
                </span>
              </div>
              {errors.custom_headline_en ? (
                <p className="text-xs font-medium text-destructive">{errors.custom_headline_en}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="myt-headline-zh" className="text-[color:var(--ink)]">
                  {t("settings.my_tutor.custom_headline_zh")}
                </Label>
                {/* Issue #411 CEO lock: DRAFT assist only, rule-based, no AI. */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoTranslate}
                  className="shrink-0"
                >
                  {t("settings.my_tutor.auto_translate")}
                </Button>
              </div>
              <Input
                id="myt-headline-zh"
                value={form.custom_headline_zh}
                maxLength={MAX_CUSTOM_HEADLINE}
                onChange={(e) => setForm({ ...form, custom_headline_zh: e.target.value })}
                placeholder="例如：IBDP 41/45 | 帝國理工航空工程"
                className="bg-[color:var(--surface)]"
              />
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-[color:var(--ink)]/55">
                  {t("settings.my_tutor.auto_translate_hint")}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {form.custom_headline_zh.length}/{MAX_CUSTOM_HEADLINE}
                </span>
              </div>
              {errors.custom_headline_zh ? (
                <p className="text-xs font-medium text-destructive">{errors.custom_headline_zh}</p>
              ) : null}
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

          {/* Issue #284: one document per changed credential field. Appears as
              soon as a verified tutor edits one of the reopened inputs. */}
          {isVerified && changedCredFields.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-4">
              <Label className="text-[color:var(--ink)]">{t("credEdits.documents_heading")}</Label>
              <p className="text-xs leading-5 text-[color:var(--ink)]/60">
                {t("credEdits.documents_hint", { max: readableEvidenceSize(MAX_EVIDENCE_BYTES) })}
              </p>
              {changedCredFields.map((field) => {
                const file = evidenceFiles[field];
                return (
                  <div key={field} className="space-y-1">
                    <Label
                      htmlFor={`cred-evidence-${field}`}
                      className="cursor-pointer text-xs font-medium text-[color:var(--brand-link)] underline-offset-2 hover:underline"
                    >
                      {t("credEdits.field_evidence_label", { field: credFieldLabel(field) })}
                    </Label>
                    <input
                      id={`cred-evidence-${field}`}
                      type="file"
                      className="sr-only"
                      accept={GRADE_SLIP_ACCEPT_ATTRIBUTE}
                      onChange={(event) => {
                        const picked = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (picked) {
                          setEvidenceFiles((previous) => ({ ...previous, [field]: picked }));
                        }
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {file
                        ? t("credEdits.document_chosen", { name: file.name })
                        : t("credEdits.document_none")}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Issue #284: the tutor's own requests, old value stays public
              while a change is pending. */}
          {isVerified ? (
            <div className="space-y-3 rounded-xl border border-[color:var(--ink)]/10 p-4">
              <Label className="text-[color:var(--ink)]">{t("credEdits.pending_heading")}</Label>
              <p className="text-xs leading-5 text-[color:var(--ink)]/60">
                {t("credEdits.pending_rule")}
              </p>
              {credEditsQuery.isLoading ? (
                <div
                  className="h-12 animate-pulse rounded-lg bg-[color:var(--ink)]/5"
                  aria-hidden
                />
              ) : credEdits.length === 0 ? (
                <p className="text-xs text-[color:var(--ink)]/60">{t("credEdits.pending_empty")}</p>
              ) : (
                <div className="space-y-2">
                  {credEdits.map((edit) => (
                    <div
                      key={edit.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[color:var(--ink)]/10 px-3 py-2.5"
                    >
                      <span className="text-sm font-medium text-[color:var(--ink)]">
                        {credFieldLabel(edit.field)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          edit.status === "pending" &&
                            "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                          edit.status === "approved" &&
                            "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                          edit.status === "rejected" && "bg-destructive/10 text-destructive",
                        )}
                      >
                        {t(`credEdits.status_${edit.status}`)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {edit.reviewed_at
                          ? t("credEdits.reviewed_at", {
                              date: new Date(edit.reviewed_at).toLocaleString("en-HK", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }),
                            })
                          : t("credEdits.submitted_at", {
                              date: new Date(edit.created_at).toLocaleString("en-HK", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }),
                            })}
                      </span>
                      {edit.status === "rejected" && edit.staff_reason ? (
                        <p className="w-full text-xs font-medium text-destructive">
                          {t("credEdits.staff_reason", { reason: edit.staff_reason })}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

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

          {/* Issue #309: per-grade slip upload + staff review status, replacing
              the old join-time evidence uploads. */}
          <TutorGradesEditor />

          {/* Issue #199: SEN experience & qualifications. Feeds the SEN search
              filter and the SEN badge on the public card. */}
          <div className="space-y-3 rounded-xl border border-[color:var(--ink)]/10 p-4">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <Label className="text-[color:var(--ink)]">{t("sen.experience_label")}</Label>
                <span className="mt-0.5 block text-xs text-[color:var(--ink)]/55">
                  {t("sen.profile_toggle_hint")}
                </span>
              </span>
              <Checkbox
                checked={form.sen_enabled}
                onCheckedChange={(checked) => setForm({ ...form, sen_enabled: checked === true })}
              />
            </label>

            {form.sen_enabled ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {SEN_CATEGORY_OPTIONS.map((category) => {
                    const active = form.sen_categories.includes(category);
                    return (
                      <label
                        key={category}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                          active
                            ? "border-[color:var(--ring)] bg-[color:var(--ring)]/[0.08] text-[color:var(--ink)]"
                            : "border-border bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-muted/40",
                        )}
                      >
                        <Checkbox
                          checked={active}
                          onCheckedChange={(checked) =>
                            setForm({
                              ...form,
                              sen_categories: checked
                                ? [...form.sen_categories, category]
                                : form.sen_categories.filter((item) => item !== category),
                            })
                          }
                        />
                        <span>{senCategoryLabels[category]}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="myt-sen-experience" className="text-[color:var(--ink)]">
                    {t("sen.details_label")}
                  </Label>
                  <Textarea
                    id="myt-sen-experience"
                    value={form.sen_experience}
                    onChange={(e) => setForm({ ...form, sen_experience: e.target.value })}
                    rows={3}
                    maxLength={2000}
                    className="bg-[color:var(--surface)]"
                    placeholder={t("sen.details_placeholder")}
                  />
                </div>
              </>
            ) : null}
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
          <div
            data-tour="tutor-rates"
            className="space-y-4 rounded-xl border border-[color:var(--ink)]/10 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-[color:var(--ink)]">
                {t("settings.my_tutor.rates_heading")}
              </Label>
              <div className="flex items-center gap-2">
                {/* Issue #113: the currency every rate field is quoted in.
                    Changing it re-snapshots the HKD bounds on save. */}
                <Label
                  htmlFor="myt-rate-currency"
                  className="text-xs font-medium text-[color:var(--ink)]/70"
                >
                  {t("settings.my_tutor.rates_currency")}
                </Label>
                <select
                  id="myt-rate-currency"
                  aria-label={t("settings.my_tutor.rates_currency")}
                  value={rates.currency}
                  onChange={(e) => handleRateField({ currency: e.target.value })}
                  className="h-9 rounded-md border border-[color:var(--ink)]/15 bg-[color:var(--surface)] px-2 text-sm font-medium text-[color:var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                >
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
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
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="myt-rate-online" className="text-[color:var(--ink)]">
                  {t("settings.my_tutor.rates_online", { currency: rates.currency })}
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
                {ratesCurrency !== "HKD" && onlineApprox ? (
                  <p className="text-xs text-muted-foreground">&asymp; {onlineApprox} / hr</p>
                ) : null}
                {errors.online_rate ? (
                  <p className="text-xs font-medium text-destructive">{errors.online_rate}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="myt-rate-inperson" className="text-[color:var(--ink)]">
                  {t("settings.my_tutor.rates_in_person", { currency: rates.currency })}
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
                {ratesCurrency !== "HKD" && inPersonApprox ? (
                  <p className="text-xs text-muted-foreground">&asymp; {inPersonApprox} / hr</p>
                ) : null}
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
                  <div key={index} className="space-y-2 rounded-sm border border-border p-2.5">
                    <div className="flex gap-2">
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
                      {/* #391: what the rate buys, 1-on-1, per-student group
                          band or bootcamp. Group rows never touch the card
                          floor (they are profile-only extras, issue #319). */}
                      <SearchableSelect
                        value={row.mode}
                        onChange={(v) => {
                          const nextRows = [...rates.rows];
                          nextRows[index] = { ...row, mode: v || "one_on_one" };
                          handleRateField({ rows: nextRows });
                        }}
                        options={RATE_ROW_MODES.map((mode) => ({
                          value: mode,
                          label: t(`settings.my_tutor.rate_mode_${mode}`),
                        }))}
                        placeholder={t("settings.my_tutor.rate_mode_placeholder")}
                        searchPlaceholder={t("settings.my_tutor.rate_mode_placeholder")}
                        className="w-44 shrink-0 bg-[color:var(--surface)]"
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
                    {row.mode !== "one_on_one" ? (
                      <div>
                        <Textarea
                          value={row.description}
                          maxLength={RATE_ROW_DESCRIPTION_MAX}
                          rows={2}
                          placeholder={t("settings.my_tutor.rate_row_description_placeholder")}
                          aria-label={t("settings.my_tutor.rate_row_description_placeholder")}
                          onChange={(e) => {
                            const nextRows = [...rates.rows];
                            nextRows[index] = { ...row, description: e.target.value };
                            handleRateField({ rows: nextRows });
                          }}
                          className="bg-[color:var(--surface)]"
                        />
                        <p className="mt-1 text-right text-xs text-muted-foreground">
                          {row.description.length}/{RATE_ROW_DESCRIPTION_MAX}
                        </p>
                      </div>
                    ) : null}
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
              onClick={() => handleRateField({ rows: [...rates.rows, { ...EMPTY_RATE_ROW }] })}
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

          {/* Issue #190: canonical teaching levels tick into the same
              target_students array; curriculum strings stay untouched. */}
          <div className="space-y-2">
            <Label className="text-[color:var(--ink)]">{t("verticals.editor_target_levels")}</Label>
            <p className="text-xs text-[color:var(--ink)]/55">
              {t("verticals.editor_target_levels_hint")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {TARGET_TEACHING_LEVELS.map((level) => {
                const active = selectedTargetLevels(form.target_students).includes(level);
                return (
                  <label
                    key={level}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-[color:var(--ring)] bg-[color:var(--ring)]/[0.08] text-[color:var(--ink)]"
                        : "border-border bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-muted/40",
                    )}
                  >
                    <Checkbox
                      checked={active}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          target_students: toggleTargetLevel(
                            form.target_students,
                            level,
                            checked === true,
                          ),
                        })
                      }
                    />
                    <span>{verticalLabels.levels[level]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Issue #190: University vertical, self-reported, owner-writable
              plain fields (not part of credential verification). */}
          {selectedTargetLevels(form.target_students).includes("University") ? (
            <div className="space-y-4 rounded-xl border border-[color:var(--ink)]/10 p-4">
              <Label className="text-[color:var(--ink)]">{t("verticals.editor_university")}</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="myt-uni-year"
                    className="text-xs font-medium text-[color:var(--ink)]/70"
                  >
                    {t("verticals.editor_year_of_study")}
                  </Label>
                  <SearchableSelect
                    value={form.university_year_of_study}
                    onChange={(v) => setForm({ ...form, university_year_of_study: v })}
                    options={[
                      { value: "", label: t("verticals.editor_none") },
                      ...YEARS_OF_STUDY.map((year) => ({
                        value: year,
                        label: verticalLabels.years[year],
                      })),
                    ]}
                    placeholder={t("verticals.editor_none")}
                    className="bg-[color:var(--surface)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="myt-uni-gpa"
                    className="text-xs font-medium text-[color:var(--ink)]/70"
                  >
                    {t("verticals.editor_gpa")}
                  </Label>
                  <Input
                    id="myt-uni-gpa"
                    value={form.university_gpa}
                    inputMode="decimal"
                    onChange={(e) => setForm({ ...form, university_gpa: e.target.value })}
                    placeholder="e.g. 3.85"
                    aria-invalid={errors.university_gpa ? true : undefined}
                    className="bg-[color:var(--surface)]"
                  />
                  {errors.university_gpa ? (
                    <p className="text-xs font-medium text-destructive">{errors.university_gpa}</p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[color:var(--ink)]">{t("verticals.editor_courses")}</Label>
                <p className="text-xs text-[color:var(--ink)]/55">
                  {t("verticals.editor_courses_hint")}
                </p>
                <SearchableSelect
                  value=""
                  onChange={(course) => {
                    if (!course || form.university_courses.includes(course)) return;
                    setForm({
                      ...form,
                      university_courses: [...form.university_courses, course].slice(
                        0,
                        MAX_UNIVERSITY_COURSES,
                      ),
                    });
                  }}
                  options={[]}
                  allowCustom
                  placeholder={t("verticals.editor_courses_placeholder")}
                />
                {form.university_courses.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {form.university_courses.map((course) => (
                      <span
                        key={course}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ink)]/15 px-3 py-1 text-xs font-medium text-[color:var(--ink)]"
                      >
                        {course}
                        <button
                          type="button"
                          aria-label={`${t("settings.my_tutor.remove_subject")} ${course}`}
                          className="text-[color:var(--ink)]/50 hover:text-[color:var(--ink)]"
                          onClick={() =>
                            setForm({
                              ...form,
                              university_courses: form.university_courses.filter(
                                (c) => c !== course,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {errors.university_courses ? (
                  <p className="text-xs font-medium text-destructive">
                    {errors.university_courses}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-[color:var(--ink)]">
                    {t("verticals.editor_course_grades")}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={form.course_grade_rows.length >= MAX_UNIVERSITY_COURSES}
                    onClick={() =>
                      setForm({
                        ...form,
                        course_grade_rows: [...form.course_grade_rows, { course: "", grade: "" }],
                      })
                    }
                  >
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {t("verticals.editor_add_course_grade")}
                  </Button>
                </div>
                {form.course_grade_rows.map((row, index) => (
                  <div key={index} className="flex flex-wrap gap-2">
                    <Input
                      value={row.course}
                      maxLength={40}
                      placeholder={t("verticals.editor_course_placeholder")}
                      aria-label={t("verticals.editor_course_placeholder")}
                      onChange={(e) => {
                        const rows = [...form.course_grade_rows];
                        rows[index] = { ...row, course: e.target.value };
                        setForm({ ...form, course_grade_rows: rows });
                      }}
                      className="flex-1 bg-[color:var(--surface)]"
                    />
                    <SearchableSelect
                      value={row.grade}
                      onChange={(grade) => {
                        const rows = [...form.course_grade_rows];
                        rows[index] = { ...row, grade };
                        setForm({ ...form, course_grade_rows: rows });
                      }}
                      options={COURSE_GRADE_OPTIONS.map((grade) => ({
                        value: grade,
                        label: grade,
                      }))}
                      placeholder={t("verticals.editor_grade_placeholder")}
                      className="w-28 bg-[color:var(--surface)]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={t("verticals.editor_remove_course_grade")}
                      onClick={() =>
                        setForm({
                          ...form,
                          course_grade_rows: form.course_grade_rows.filter((_, i) => i !== index),
                        })
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Issue #190: Kindergarten topics are canonical tags inside
              subjects[], ticking edits the shared subjects list. */}
          {selectedTargetLevels(form.target_students).includes("Kindergarten") ? (
            <div className="space-y-3 rounded-xl border border-[color:var(--ink)]/10 p-4">
              <Label className="text-[color:var(--ink)]">
                {t("verticals.editor_kindergarten")}
              </Label>
              <p className="text-xs text-[color:var(--ink)]/55">
                {t("verticals.editor_kindergarten_hint")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {KINDERGARTEN_TOPICS.map((topic) => {
                  const active = form.subjects.some(
                    (subject) => subject.trim().toLowerCase() === topic.toLowerCase(),
                  );
                  return (
                    <label
                      key={topic}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-[color:var(--ring)] bg-[color:var(--ring)]/[0.08] text-[color:var(--ink)]"
                          : "border-border bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={active}
                        onCheckedChange={(checked) =>
                          setForm({
                            ...form,
                            subjects: toggleKindergartenTopic(
                              form.subjects,
                              topic,
                              checked === true,
                            ),
                          })
                        }
                      />
                      <span>{verticalLabels.topics[topic]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={save.isPending || editsSubmitting}
            className="font-medium"
          >
            {save.isPending || editsSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editsSubmitting ? t("credEdits.submitting") : t("settings.my_tutor.saving")}
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
