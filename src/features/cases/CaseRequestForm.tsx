import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Hash, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { useDisplayCurrency } from "@/features/currency/display-currency-context";
import { FEE_TERMS_VERSION } from "@/features/legal/terms";
import { approxHkdText } from "@/features/currency/convert";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, toCurrencyCode } from "@/lib/money";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MtrStationSelect } from "@/components/ui/mtr-station-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { submitCaseRequest } from "@/lib/cases.functions";
import {
  ADMISSIONS_CATEGORY_OPTIONS,
  ADMISSIONS_CURRICULUM,
  ADMISSIONS_CURRICULUM_LABEL,
  DELIVERY_MODE_OPTIONS,
  INSTRUCTION_LANGUAGE_OPTIONS,
  INTERVIEW_TEST_OPTIONS,
  LEVEL_OPTIONS,
  REQUESTER_TYPE_OPTIONS,
  SCHOOL_TYPE_OPTIONS,
  SUPPORT_TYPE_OPTIONS,
  TARGET_PATHWAY_OPTIONS,
  TARGET_SCHOOL_OPTIONS,
  TUTOR_BACKGROUND_OPTIONS,
  COMPONENT_SENTINEL,
  CLASS_FORMAT_OPTIONS,
  PACKAGE_TYPE_OPTIONS,
  RATE_UNIT_OPTIONS,
  STUDENT_COUNT_OPTIONS,
  getComponentOptionsForCurriculum,
  getCurriculumOptionsForLevel,
  getSubjectOptionsForCurriculum,
} from "@/features/cases/case-options";
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { MAX_PROFILE_TAGS, PRESET_PROFILE_TAGS } from "@/features/tutors/profile-tags";
import { SEN_CATEGORY_OPTIONS } from "@/features/tutors/sen";
import { useSenCategoryLabels } from "@/features/tutors/sen-labels";
import {
  FIELDS_OF_STUDY,
  KINDERGARTEN_TOPICS,
  UNIVERSITY_SUGGESTIONS,
} from "@/features/tutors/verticals";
import { kindergartenTopicLabel } from "@/features/tutors/verticals-labels";
import {
  FUNNEL_LEVELS,
  SECONDARY_BANDS,
  storedStudentLevel,
} from "@/features/cases/case-verticals";
import { useFormDraft } from "@/lib/use-form-draft";
import { useWhatsAppNumber } from "@/lib/use-whatsapp-number";
import { buildCaseTitle } from "@/features/cases/case-title";
import { cn } from "@/lib/utils";

const PHONE_REGEX = /^[+(\d][\d\s()./+-]{4,19}\d$/;

const labelClassName =
  "mb-1.5 block text-sm font-medium text-[color:var(--ink)] after:ml-0.5 after:text-[color:var(--muted-foreground)]";
const controlClassName = "h-11 w-full rounded-sm";
const invalidInputClassName =
  "border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30";

function RequiredFlag() {
  return <span className="ml-2 align-middle text-xs font-medium text-destructive">Required</span>;
}

type ValidationIssue = { path?: unknown[]; message: string };

function parseValidationIssues(message: string): ValidationIssue[] | null {
  if (!message.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(message);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof (parsed[0] as ValidationIssue)?.message === "string"
    ) {
      return parsed as ValidationIssue[];
    }
  } catch {
    // Not a validation issue payload
  }
  return null;
}

type FormState = {
  // Page 1: Contact
  requesterType: string;
  // Issue #437: "Who is this for?", demographics live on the case, never
  // the account (no account-level gender/role/photo for clients).
  whoFor: string;
  parentName: string;
  contactPhone: string;
  supportType: string;
  // Issue #190: the level-first funnel question (step 1) and its cascades.
  academicLevel: string;
  secondaryBand: string;
  uniField: string;
  uniName: string;
  uniProgram: string;
  uniCourseCodes: string;
  kindergartenTopics: string[];
  // Page 2, Path A: Subject tutoring
  curriculum: string;
  subject1: string;
  subject2: string;
  subject3: string;
  subject4: string;
  specificComponent: string;
  instructionLanguage: string[];
  year: string;
  schoolName: string;
  schoolType: string;
  // Issue #437: case-level student demographics (never on the account).
  studentGender: string;
  // Page 2, Path B: Admissions
  admissionsCategory: string;
  targetPathway: string;
  targetSchool: string;
  interviewTest: string;
  // Page 3: Logistics
  deliveryMode: string;
  district: string;
  budgetMin: string;
  budgetMax: string;
  // Issue #423 (sections 2+3): structured package fields (hard dropdowns).
  packageType: string;
  studentCount: string;
  rateUnit: string;
  // Issue #391: 1-on-1 only | open to small group (lower rate) | either.
  classFormat: string;
  // Issue #114: the parent's native budget currency (HKD fallback).
  budgetCurrency: string;
  tutorBackground: string;
  // Issue #437: tutor gender preference is a case-level hard preference
  // (No preference / Male / Female), the board dims Apply on hard mismatch.
  tutorGenderPreference: string;
  notes: string;
  // Issue #199: SEN support requirements (step 3).
  senRequired: boolean;
  senCategories: string[];
  senDetails: string;
  // Issue #311: parent-picked preset tags (max MAX_PROFILE_TAGS), merged
  // with the derived requirement tags server-side by mergeCaseTags, which
  // always keeps the derived tags regardless of how many presets are picked.
  tags: string[];
  termsAgreed: boolean;
  // Issue #253 (F2): matching-fee agreement, version fee-2026-10.
  feeAgreed: boolean;
  // Issue #412 E: parent B2C triage (compliance screening).
  engager: string;
  nonTutoringDuties: string;
};

const INITIAL_FORM: FormState = {
  requesterType: "",
  whoFor: "",
  parentName: "",
  contactPhone: "",
  supportType: "",
  academicLevel: "",
  secondaryBand: "",
  uniField: "",
  uniName: "",
  uniProgram: "",
  uniCourseCodes: "",
  kindergartenTopics: [],
  curriculum: "",
  subject1: "",
  subject2: "",
  subject3: "",
  subject4: "",
  specificComponent: "",
  instructionLanguage: [],
  year: "",
  schoolName: "",
  schoolType: "",
  studentGender: "",
  admissionsCategory: "",
  targetPathway: "",
  targetSchool: "",
  interviewTest: "",
  deliveryMode: "",
  district: "",
  budgetMin: "",
  budgetMax: "",
  packageType: "ongoing_1_5",
  studentCount: "1",
  rateUnit: "hr",
  classFormat: "either",
  budgetCurrency: DEFAULT_CURRENCY,
  tutorBackground: "any",
  tutorGenderPreference: "any",
  notes: "",
  senRequired: false,
  senCategories: [],
  senDetails: "",
  tags: [],
  termsAgreed: false,
  feeAgreed: false,
  engager: "",
  nonTutoringDuties: "no",
};

/** Issue #311: the preset tag seeds shown as one-tap chips on the case form
 * (same vocabulary as tutor profile tags). */
const CASE_TAG_OPTIONS: string[] = [...PRESET_PROFILE_TAGS];

/** Issue #412 E: parent B2C triage options. A third-party engager or
 * non-tutoring duties drops the request into compliance_hold server-side. */
const PARENT_ENGAGER_OPTIONS = [
  { value: "myself_child", label: "Myself / my child" },
  { value: "organisation_third_party", label: "An organisation or third party" },
];
const PARENT_DUTIES_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];
// Issue #437: case-level demographics, these live on the Case Intake Form
// only (never on account signup / Account settings).
const WHO_FOR_OPTIONS = [
  { value: "my_child", label: "My child" },
  { value: "myself", label: "Myself" },
  { value: "someone_else", label: "Someone else" },
];
const STUDENT_GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const TUTOR_GENDER_OPTIONS = [
  { value: "any", label: "No preference" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

type CaseRequestFormProps = {
  idPrefix?: string;
  onSubmitted?: (result: { caseCode: string }) => void;
};

export function CaseRequestForm({ idPrefix = "cr", onSubmitted }: CaseRequestFormProps) {
  const { t } = useTranslation();
  const senCategoryLabels = useSenCategoryLabels();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<{ caseCode: string } | null>(null);
  // Issue #114: pre-fill the budget currency from the visitor's active
  // display currency, but ONLY until the visitor (or a restored draft)
  // has made their own choice. #380 review: re-syncing on every
  // displayCurrency change clobbered an intentional HKD pick, so a
  // touched flag freezes the field once the select is edited or a draft
  // restores its own value.
  const { currency: displayCurrency, rates: fxRates } = useDisplayCurrency();
  const budgetCurrencyTouched = useRef(false);
  useEffect(() => {
    if (budgetCurrencyTouched.current) return;
    setForm((prev) =>
      prev.budgetCurrency === DEFAULT_CURRENCY
        ? { ...prev, budgetCurrency: displayCurrency }
        : prev,
    );
  }, [displayCurrency]);
  const honeypot = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());
  // Issue #114: "≈ HK$350 – HK$450 / hr" baseline under the budget inputs.
  const budgetApproxNote = useMemo(() => {
    const currency = toCurrencyCode(form.budgetCurrency);
    const min = Number(form.budgetMin);
    const max = Number(form.budgetMax);
    if (!Number.isFinite(min) || !Number.isFinite(max) || (min <= 0 && max <= 0)) return null;
    const parts = [
      approxHkdText(min, currency, fxRates),
      approxHkdText(max, currency, fxRates),
    ].filter((part): part is string => part !== null);
    if (parts.length === 0) return null;
    return parts.join(" – ");
  }, [form.budgetMin, form.budgetMax, form.budgetCurrency, fxRates]);
  const { restored, saveDraft, clearDraft } = useFormDraft<FormState>("case-request-v6");
  // Issue #186: deep link to the MatchMax hotline with a summary of the
  // request once the case code exists (enabled only after a successful
  // submit so the message can include it).
  const whatsappDigits = useWhatsAppNumber(Boolean(result));
  const whatsappSummary = result
    ? [
        `Hi MatchMax! I have just submitted a case request (${result.caseCode}).`,
        form.parentName ? `Name: ${form.parentName}` : null,
        form.curriculum ? `Curriculum: ${form.curriculum}` : null,
        form.subject1
          ? `Subjects: ${[form.subject1, form.subject2].filter(Boolean).join(", ")}`
          : null,
        form.budgetMin || form.budgetMax
          ? `Budget: ${form.budgetMin ? `${form.budgetCurrency} ${form.budgetMin}` : ""}${form.budgetMax ? `–${form.budgetCurrency} ${form.budgetMax}` : ""}${budgetApproxNote ? ` (≈ ${budgetApproxNote}/hr)` : ""}`
          : null,
        form.district ? `District: ${form.district}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const whatsappHref =
    result && whatsappDigits
      ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappSummary)}`
      : "";

  useEffect(() => {
    if (!restored) return;
    // Drop stale option values (e.g. the removed "bilingual" token) from
    // older drafts so submit-time validation can't reject them.
    const languages = Array.isArray(restored.instructionLanguage)
      ? restored.instructionLanguage.filter((v) =>
          INSTRUCTION_LANGUAGE_OPTIONS.some((o) => o.value === v),
        )
      : [];
    // Issue #311: drafts saved before tags existed have no tags array.
    const tags = Array.isArray(restored.tags) ? restored.tags : [];
    // Issue #190: sanitize pre-vertical drafts (or tampered localStorage) —
    // only canonical funnel levels and K topics survive a restore.
    const academicLevel = FUNNEL_LEVELS.includes(
      restored.academicLevel as (typeof FUNNEL_LEVELS)[number],
    )
      ? restored.academicLevel
      : "";
    const secondaryBand = SECONDARY_BANDS.includes(
      restored.secondaryBand as (typeof SECONDARY_BANDS)[number],
    )
      ? restored.secondaryBand
      : "";
    const kindergartenTopics = Array.isArray(restored.kindergartenTopics)
      ? restored.kindergartenTopics.filter((topic) =>
          (KINDERGARTEN_TOPICS as readonly string[]).includes(topic),
        )
      : [];
    // Issue #423 bug 3: a stale draft can carry a curriculum outside the
    // restored level's lock, drop it so step 2 re-asks coherently.
    const allowedCurricula = getCurriculumOptionsForLevel(academicLevel).map((o) => o.value);
    const curriculum = allowedCurricula.includes(restored.curriculum) ? restored.curriculum : "";
    // Issue #423: sanitize the package dropdowns against tampered drafts.
    const packageType = PACKAGE_TYPE_OPTIONS.some((o) => o.value === restored.packageType)
      ? restored.packageType
      : "ongoing_1_5";
    const studentCount = STUDENT_COUNT_OPTIONS.some((o) => o.value === restored.studentCount)
      ? restored.studentCount
      : "1";
    const rateUnit = RATE_UNIT_OPTIONS.some((o) => o.value === restored.rateUnit)
      ? restored.rateUnit
      : "hr";
    const classFormat = CLASS_FORMAT_OPTIONS.some((o) => o.value === restored.classFormat)
      ? restored.classFormat
      : "either";
    // #380 review: a restored draft's budget currency (even an explicit
    // HKD) is the visitor's own choice, never re-sync it afterwards.
    budgetCurrencyTouched.current = true;
    // GLM review 2026-10-23: drafts saved under the old 2000-char cap restore
    // over-length notes, maxLength only blocks NEW typing, and the server
    // zod .max(500) would reject submit. Truncate to the live cap here.
    const notes = typeof restored.notes === "string" ? restored.notes.slice(0, 500) : "";
    // Issue #412 E: sanitize the triage answers against tampered drafts.
    const engager = PARENT_ENGAGER_OPTIONS.some((o) => o.value === restored.engager)
      ? restored.engager
      : "";
    const nonTutoringDuties = PARENT_DUTIES_OPTIONS.some(
      (o) => o.value === restored.nonTutoringDuties,
    )
      ? restored.nonTutoringDuties
      : "no";
    // Issue #437: sanitize the demographics answers against tampered drafts.
    const whoFor = WHO_FOR_OPTIONS.some((o) => o.value === restored.whoFor) ? restored.whoFor : "";
    const studentGender = STUDENT_GENDER_OPTIONS.some((o) => o.value === restored.studentGender)
      ? restored.studentGender
      : "";
    const tutorGenderPreference = TUTOR_GENDER_OPTIONS.some(
      (o) => o.value === restored.tutorGenderPreference,
    )
      ? restored.tutorGenderPreference
      : "any";
    setForm((prev) => ({
      ...prev,
      ...restored,
      academicLevel,
      secondaryBand,
      kindergartenTopics,
      curriculum,
      packageType,
      studentCount,
      rateUnit,
      classFormat,
      notes,
      engager,
      nonTutoringDuties,
      whoFor,
      studentGender,
      tutorGenderPreference,
      instructionLanguage: languages,
      tags,
    }));
  }, [restored]);

  const isBlankDraft = (value: FormState) =>
    Object.entries(value).every(
      ([key, v]) =>
        v === "" ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === "boolean" && !v) ||
        (key === "tutorBackground" && v === "any") ||
        // Issue #423: the package defaults are the blank state.
        (key === "packageType" && v === "ongoing_1_5") ||
        (key === "studentCount" && v === "1") ||
        (key === "rateUnit" && v === "hr") ||
        (key === "classFormat" && v === "either") ||
        // Issue #412 E: triage defaults are the blank state.
        (key === "engager" && v === "") ||
        (key === "nonTutoringDuties" && v === "no") ||
        // Issue #437: demographics defaults are the blank state.
        (key === "whoFor" && v === "") ||
        (key === "studentGender" && v === "") ||
        (key === "tutorGenderPreference" && v === "any"),
    );

  const update = (patch: Partial<FormState>) => {
    const next = { ...form, ...patch };
    if (isBlankDraft(next)) clearDraft();
    else saveDraft(next);
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const keys = Object.keys(patch) as (keyof FormState)[];
      if (!keys.some((key) => prev[key])) return prev;
      const nextErrors = { ...prev };
      keys.forEach((key) => delete nextErrors[key]);
      return nextErrors;
    });
  };

  const isAdmissions = form.supportType === "admissions";
  // Issue #423 (sections 2+3): the title is no longer typed, it is this
  // live preview, generated from the structured fields in the #411
  // dual-language pattern. Parents never type a title for new cases.
  const titlePreview = useMemo(() => {
    const subjects = [form.subject1, form.subject2].map((s) => s.trim()).filter(Boolean);
    const fields = {
      curriculum: form.curriculum || null,
      subjects,
      grade: form.secondaryBand || form.year || form.academicLevel || null,
    };
    return {
      en: buildCaseTitle(fields, "en"),
      zh: buildCaseTitle(fields, "zh-HK"),
    };
  }, [
    form.curriculum,
    form.subject1,
    form.subject2,
    form.secondaryBand,
    form.year,
    form.academicLevel,
  ]);
  const subjectOptions = getSubjectOptionsForCurriculum(form.curriculum);
  // Issue #423 bug 3: curricula locked to the chosen academic tier, a
  // Primary case can only pick "Primary School", never IBDP.
  const curriculumOptions = getCurriculumOptionsForLevel(form.academicLevel);
  // Admissions sub-category ("Standardized Testing & Language" vs
  // "Application & Admissions Support") narrows the umbrella's subject pool.
  const admissionsSubjectOptions = form.admissionsCategory
    ? getSubjectOptionsForCategory(form.admissionsCategory)
    : subjectOptions;
  const componentOptions = getComponentOptionsForCurriculum(form.curriculum);
  const showMtr = form.deliveryMode !== "" && form.deliveryMode !== "online";

  // Curriculum locking: subjects/components only populate for the active
  // curriculum; changing it instantly resets them to blank.
  const handleCurriculumChange = (value: string) => {
    update({
      curriculum: value,
      subject1: "",
      subject2: "",
      subject3: "",
      subject4: "",
      specificComponent: "",
    });
  };

  // Admissions auto-locks the curriculum to "University Admissions & Test
  // Prep", its subjects (IELTS, SAT, ACT, TOEFL, UCAT, ISAT, Personal
  // Statement…) come from that pool; the tutoring curriculum resets when
  // switching back.
  const handleSupportTypeChange = (value: string) => {
    update(
      value === "admissions"
        ? {
            supportType: value,
            curriculum: ADMISSIONS_CURRICULUM,
            admissionsCategory: "",
            subject1: "",
            subject2: "",
            subject3: "",
            subject4: "",
            specificComponent: "",
          }
        : {
            supportType: value,
            curriculum: form.curriculum === ADMISSIONS_CURRICULUM ? "" : form.curriculum,
            admissionsCategory: "",
            subject1: "",
            subject2: "",
            subject3: "",
            subject4: "",
            specificComponent: "",
          },
    );
  };

  // Switching the admissions sub-category narrows the subject pool and
  // clears any subject that may no longer belong.
  const handleAdmissionsCategoryChange = (value: string) => {
    update({ admissionsCategory: value, subject1: "", subject2: "", subject3: "", subject4: "" });
  };

  // MTR is hidden for online-only requests, clear any stale selection.
  const handleDeliveryModeChange = (value: string) => {
    update(value === "online" ? { deliveryMode: value, district: "" } : { deliveryMode: value });
  };

  // Issue #190: the level-first funnel. Picking a level reveals its
  // slide-down region and resets the other verticals' fields; the stored
  // student level (form.year) follows the funnel answer directly.
  // Issue #423 bug 3: the level also locks the curriculum, a Primary case
  // can never carry the IB curriculum, so the step-2 selection (and its
  // subjects) resets whenever the level changes; a level with exactly one
  // coherent curriculum (Kindergarten/Primary/University) pre-selects it.
  const handleAcademicLevelChange = (value: string) => {
    const patch: Partial<FormState> = {
      academicLevel: value,
      secondaryBand: "",
      uniField: "",
      uniName: "",
      uniProgram: "",
      uniCourseCodes: "",
      kindergartenTopics: [],
      curriculum: "",
      subject1: "",
      subject2: "",
      subject3: "",
      subject4: "",
      specificComponent: "",
    };
    const levelOptions = getCurriculumOptionsForLevel(value);
    if (levelOptions.length === 1) patch.curriculum = levelOptions[0].value;
    const level = storedStudentLevel(
      FUNNEL_LEVELS.includes(value as (typeof FUNNEL_LEVELS)[number])
        ? (value as (typeof FUNNEL_LEVELS)[number])
        : null,
    );
    if (level) patch.year = level;
    update(patch);
  };

  const handleSecondaryBandChange = (value: string) => {
    update({ secondaryBand: value, year: value });
  };

  // Kindergarten focus multi-toggle: picking one topic never collapses the
  // others (same anatomy as the SEN category multi-select).
  const handleKindergartenTopicToggle = (topic: string, checked: boolean) => {
    update({
      kindergartenTopics: checked
        ? [...form.kindergartenTopics, topic]
        : form.kindergartenTopics.filter((item) => item !== topic),
    });
  };

  // Multi-select language chips. "No preference" is exclusive: picking it
  // clears the others; picking a real language deselects "No preference".
  const handleLanguageToggle = (values: string[]) => {
    const next = values.includes("any") ? ["any"] : values.filter((v) => v !== "any");
    update({ instructionLanguage: next });
  };

  const validateStep = (target: number): Partial<Record<keyof FormState, string>> => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (target === 1) {
      if (!form.academicLevel) nextErrors.academicLevel = "Required";
      if (form.academicLevel === "Secondary" && !form.secondaryBand) {
        nextErrors.secondaryBand = "Required";
      }
      if (!form.requesterType) nextErrors.requesterType = "Required";
      // Issue #437: "Who is this for?" is a required case-level field.
      if (!form.whoFor) nextErrors.whoFor = "Required";
      if (!form.parentName.trim()) nextErrors.parentName = "Required";
      if (!form.contactPhone.trim()) {
        nextErrors.contactPhone = "Required";
      } else if (!PHONE_REGEX.test(form.contactPhone.trim())) {
        nextErrors.contactPhone = "Please enter a valid WhatsApp number (e.g. +852 9123 4567).";
      }
      if (!form.supportType) nextErrors.supportType = "Required";
    }
    if (target === 2) {
      // Issue #437: student gender is captured at case level on both paths.
      if (!form.studentGender) nextErrors.studentGender = "Required";
      if (form.supportType === "admissions") {
        if (!form.targetPathway) nextErrors.targetPathway = "Required";
        if (!form.interviewTest) nextErrors.interviewTest = "Required";
        if (!form.subject1) nextErrors.subject1 = "Required";
      } else {
        if (!form.curriculum) nextErrors.curriculum = "Required";
        if (!form.subject1) nextErrors.subject1 = "Required";
        if (!form.instructionLanguage.length) nextErrors.instructionLanguage = "Required";
      }
    }
    if (target === 3) {
      if (!form.deliveryMode) nextErrors.deliveryMode = "Required";
      // Issue #412 E: the engager question is a hard gate.
      if (!form.engager) nextErrors.engager = "Required";
      if (form.deliveryMode !== "online" && !form.district) nextErrors.district = "Required";
      if (!form.budgetMax.trim()) nextErrors.budgetMax = "Required";
      if (!form.termsAgreed) nextErrors.termsAgreed = "Required";
      if (!form.feeAgreed) nextErrors.feeAgreed = "Required";
    }
    return nextErrors;
  };

  const goToStep = (target: number) => {
    if (target > step) {
      const nextErrors = validateStep(step);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        toast.error("Please fill in the highlighted fields.");
        return;
      }
    }
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const admissions = isAdmissionsPath(form.supportType);
      const subjects = [form.subject1, form.subject2, form.subject3, form.subject4]
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      return submitCaseRequest({
        data: {
          requesterType: form.requesterType as "parent" | "student",
          // Issue #437: demographics live on the case, not the account.
          whoFor: form.whoFor as "my_child" | "myself" | "someone_else",
          studentGender: form.studentGender as "female" | "male" | "prefer_not_to_say",
          tutorGenderPreference: (form.tutorGenderPreference || "any") as "any" | "male" | "female",
          parentName: form.parentName,
          contactPhone: form.contactPhone,
          supportType: form.supportType as "subject_tutoring" | "admissions",
          // Issue #190: the level-first funnel answer drives the vertical
          // columns server-side (academic_tier + uni/K fields).
          academicLevel: form.academicLevel as
            "Kindergarten" | "Primary" | "Secondary" | "University",
          secondaryBand: form.secondaryBand || null,
          uniField: form.academicLevel === "University" ? form.uniField.trim() || null : null,
          uniName: form.academicLevel === "University" ? form.uniName.trim() || null : null,
          uniProgram: form.academicLevel === "University" ? form.uniProgram.trim() || null : null,
          uniCourseCodes:
            form.academicLevel === "University" ? form.uniCourseCodes.trim() || null : null,
          kindergartenTopics: form.academicLevel === "Kindergarten" ? form.kindergartenTopics : [],
          curriculum: admissions ? form.curriculum || ADMISSIONS_CURRICULUM : form.curriculum,
          subjects,
          specificComponent:
            !admissions && form.specificComponent !== COMPONENT_SENTINEL
              ? form.specificComponent || null
              : null,
          instructionLanguage: admissions ? [] : form.instructionLanguage,
          year: form.year || null,
          schoolName: form.schoolName.trim() || null,
          schoolType: admissions ? null : form.schoolType || null,
          targetPathway: admissions ? form.targetPathway : null,
          targetSchool: admissions ? form.targetSchool.trim() || null : null,
          interviewTest: admissions ? form.interviewTest : null,
          mode: (form.deliveryMode === "both" ? "no_pref" : form.deliveryMode) as
            "online" | "offline" | "both" | "no_pref",
          district: form.deliveryMode !== "online" ? form.district || null : null,
          budgetMin: form.budgetMin ? Number(form.budgetMin) : null,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
          // Issue #423 (sections 2+3): the structured package fields.
          packageType: (form.packageType || "ongoing_1_5") as
            "ongoing_1_5" | "short_20" | "pro_bono",
          studentCount: Number(form.studentCount) || 1,
          rateUnit: (form.rateUnit || "hr") as "hr" | "lesson" | "month",
          // Issue #391: class format preference (defaults to either).
          classFormat: (form.classFormat || "either") as
            "one_on_one_only" | "open_to_group" | "either",
          // Issue #114: the parent's native budget currency; the DB trigger
          // snapshots the HKD-equivalent bounds server-side.
          budgetCurrency: toCurrencyCode(form.budgetCurrency),
          tutorBackground: (form.tutorBackground || "any") as
            "uni_student" | "official_examiner" | "any",
          notes: form.notes.trim() || null,
          senRequired: form.senRequired,
          senCategories: form.senRequired ? form.senCategories : [],
          senDetails: form.senRequired ? form.senDetails.trim() || null : null,
          tags: form.tags,
          // Issue #412 E: parent B2C compliance triage.
          triage: {
            engager: form.engager as "myself_child" | "organisation_third_party",
            nonTutoringDuties: form.nonTutoringDuties as "no" | "yes",
          },
          termsAck: form.termsAgreed,
          feeTermsAck: form.feeAgreed,
          website: honeypot.current?.value || null,
          elapsedMs: Date.now() - startedAt.current,
        },
      });
    },
    onSuccess: (data) => {
      clearDraft();
      setResult(data);
      onSubmitted?.(data);
    },
    onError: (e: Error) => {
      const issues = parseValidationIssues(e.message);
      if (issues) {
        const first = issues[0];
        const field =
          typeof first?.path?.[0] === "string" && first.path[0] in form
            ? (first.path[0] as keyof FormState)
            : null;
        if (field) {
          setErrors({ [field]: first.message });
          const fieldStep = fieldStepOf(field);
          if (fieldStep < step) setStep(fieldStep);
        }
        toast.error(first?.message ?? "Please check the highlighted fields.");
        return;
      }
      toast.error(e.message);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step < 3) {
      goToStep(step + 1);
      return;
    }
    const nextErrors = validateStep(3);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fill in the highlighted fields.");
      return;
    }
    submitMutation.mutate();
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setStep(1);
    setResult(null);
    clearDraft();
    startedAt.current = Date.now();
  };

  if (result) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-8 text-center sm:p-12">
        <CheckCircle2
          className="mx-auto h-12 w-12 text-[color:var(--muted-foreground)]"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-3xl font-medium text-[color:var(--ink)]">Case request received</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Keep this reference for your records.
        </p>
        <p className="mt-4 font-mono text-2xl font-medium tracking-tight text-[color:var(--ink)]">
          {result.caseCode}
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm font-medium text-[color:var(--ink)]">
          The MatchMax team will contact you shortly on WhatsApp.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
          Our team reviews every request, once approved, your case appears on this board so
          qualified tutors can apply.
        </p>
        {whatsappHref ? (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-11 rounded-sm bg-[#25D366] px-6 font-medium text-white hover:bg-[#1ebe5b]"
            >
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                Continue on WhatsApp
              </a>
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-sm px-6 font-medium"
              onClick={resetForm}
            >
              Submit another request
            </Button>
          </div>
        ) : (
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              className="h-11 rounded-sm px-6 font-medium"
              onClick={resetForm}
            >
              Submit another request
            </Button>
          </div>
        )}
      </div>
    );
  }

  const stepLabels = ["Contact", isAdmissions ? "Admissions" : "Tutoring", "Logistics"];

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-5 sm:p-8"
    >
      {/* Progress header */}
      <ol className="mb-8 flex items-center gap-2 sm:gap-3" aria-label="Form progress">
        {stepLabels.map((label, index) => {
          const stepNumber = index + 1;
          const isComplete = stepNumber < step;
          const isCurrent = stepNumber === step;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                disabled={stepNumber >= step}
                onClick={() => setStep(stepNumber)}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                  isComplete &&
                    "cursor-pointer border-[color:var(--ink)] bg-[color:var(--ink)] text-white",
                  isCurrent &&
                    "border-[color:var(--ink)] bg-[color:var(--ink)]/[0.06] text-[color:var(--ink)]",
                  !isComplete && !isCurrent && "border-border text-muted-foreground",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : stepNumber}
              </button>
              <span
                className={cn(
                  "truncate text-xs font-medium sm:text-sm",
                  isCurrent || isComplete ? "text-[color:var(--ink)]" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {stepNumber < stepLabels.length ? (
                <span
                  className={cn(
                    "h-px flex-1",
                    stepNumber < step ? "bg-[color:var(--ink)]" : "bg-border",
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Issue #423: live auto-title preview, replaces manual title typing.
          Shown from step 2 on, once the structured fields exist. */}
      {step >= 2 ? (
        <div className="mb-8 rounded-sm border border-border bg-muted/40 p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {t("case_board.title_preview")}
          </p>
          <p className="mt-1.5 text-lg font-medium tracking-tight text-[color:var(--ink)]">
            {titlePreview.en || t("case_board.title_preview_empty")}
          </p>
          {titlePreview.zh && titlePreview.zh !== titlePreview.en ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{titlePreview.zh}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {step === 1 ? (
          <>
            {/* Issue #190: the funnel is level-first, the academic level
                question leads step 1 and its slide-down cascade sits
                directly beneath the chosen option. */}
            <div className="sm:col-span-2">
              <span className={labelClassName}>
                {t("case_request.funnel_level_label")}
                {errors.academicLevel === "Required" ? <RequiredFlag /> : null}
              </span>
              <div
                role="radiogroup"
                aria-label={t("case_request.funnel_level_label")}
                className="mt-2 flex flex-wrap gap-2"
              >
                {FUNNEL_LEVELS.map((level) => {
                  const active = form.academicLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => handleAcademicLevelChange(level)}
                      className={cn(
                        "inline-flex h-10 items-center rounded-full border px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                        active
                          ? "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/10 text-[color:var(--ink)]"
                          : "border-border text-muted-foreground hover:border-[color:var(--brand-link)] hover:text-[color:var(--ink)]",
                      )}
                    >
                      {t(
                        level === "Kindergarten"
                          ? "case_request.funnel_level_kindergarten"
                          : level === "Primary"
                            ? "case_request.funnel_level_primary"
                            : level === "Secondary"
                              ? "case_request.funnel_level_secondary"
                              : "case_request.funnel_level_university",
                      )}
                    </button>
                  );
                })}
              </div>
              {errors.academicLevel && errors.academicLevel !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.academicLevel}</p>
              ) : null}
            </div>

            {/* Slide-down region beneath the chosen level. */}
            {form.academicLevel === "Secondary" ? (
              <div>
                <label className={labelClassName} htmlFor={`${idPrefix}-secondary-band`}>
                  {t("case_request.funnel_secondary_band_label")}
                  {errors.secondaryBand === "Required" ? <RequiredFlag /> : null}
                </label>
                <SearchableSelect
                  value={form.secondaryBand}
                  onChange={handleSecondaryBandChange}
                  options={SECONDARY_BANDS.map((band) => ({
                    value: band,
                    label: t(
                      band === "Junior secondary"
                        ? "case_request.funnel_band_junior"
                        : "case_request.funnel_band_senior",
                    ),
                  }))}
                  placeholder={t("case_request.funnel_secondary_band_label")}
                  searchPlaceholder={t("case_request.funnel_secondary_band_label")}
                  className={controlClassName}
                  invalid={Boolean(errors.secondaryBand)}
                />
                {errors.secondaryBand && errors.secondaryBand !== "Required" ? (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    {errors.secondaryBand}
                  </p>
                ) : null}
              </div>
            ) : null}
            {form.academicLevel === "University" ? (
              <>
                <div>
                  <label className={labelClassName} htmlFor={`${idPrefix}-uni-field`}>
                    {t("case_request.uni_field_label")}
                  </label>
                  <SearchableSelect
                    value={form.uniField}
                    onChange={(v) => update({ uniField: v })}
                    options={FIELDS_OF_STUDY.map((field) => ({ value: field, label: field }))}
                    placeholder={t("case_request.uni_field_placeholder")}
                    searchPlaceholder={t("case_request.uni_field_placeholder")}
                    className={controlClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName} htmlFor={`${idPrefix}-uni-name`}>
                    {t("case_request.uni_name_label")}
                  </label>
                  <SearchableSelect
                    value={form.uniName}
                    onChange={(v) => update({ uniName: v })}
                    options={UNIVERSITY_SUGGESTIONS.map((name) => ({ value: name, label: name }))}
                    allowCustom
                    placeholder={t("case_request.uni_name_placeholder")}
                    searchPlaceholder={t("case_request.uni_name_placeholder")}
                    emptyText={t("case_request.uni_name_custom")}
                    className={controlClassName}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClassName} htmlFor={`${idPrefix}-uni-program`}>
                    {t("case_request.uni_program_label")}
                  </label>
                  <Input
                    id={`${idPrefix}-uni-program`}
                    className={controlClassName}
                    maxLength={120}
                    placeholder={t("case_request.uni_program_placeholder")}
                    value={form.uniProgram}
                    onChange={(e) => update({ uniProgram: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClassName} htmlFor={`${idPrefix}-uni-courses`}>
                    {t("case_request.uni_courses_label")}
                  </label>
                  <Textarea
                    id={`${idPrefix}-uni-courses`}
                    rows={4}
                    maxLength={2000}
                    className="w-full rounded-sm"
                    placeholder={t("case_request.uni_courses_placeholder")}
                    value={form.uniCourseCodes}
                    onChange={(e) => update({ uniCourseCodes: e.target.value })}
                  />
                </div>
              </>
            ) : null}
            {form.academicLevel === "Kindergarten" ? (
              <div className="sm:col-span-2">
                <span className={labelClassName}>{t("case_request.k_focus_label")}</span>
                <div
                  role="group"
                  aria-label={t("case_request.k_focus_aria")}
                  className="mt-2 space-y-1 rounded-sm border border-border p-3"
                >
                  {KINDERGARTEN_TOPICS.map((topic) => {
                    const active = form.kindergartenTopics.includes(topic);
                    return (
                      <label
                        key={topic}
                        className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-sm text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.04]"
                      >
                        <Checkbox
                          checked={active}
                          onCheckedChange={(checked) =>
                            handleKindergartenTopicToggle(topic, checked === true)
                          }
                        />
                        <span className="font-medium">{kindergartenTopicLabel(topic)}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t("case_request.k_focus_hint")}
                </p>
              </div>
            ) : null}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-requester-type`}>
                I am a{errors.requesterType === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.requesterType}
                onChange={(v) => update({ requesterType: v })}
                options={REQUESTER_TYPE_OPTIONS}
                placeholder="Select user type"
                searchPlaceholder="Search user type..."
                className={controlClassName}
                invalid={Boolean(errors.requesterType)}
              />
              {errors.requesterType && errors.requesterType !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.requesterType}</p>
              ) : null}
            </div>
            {/* Issue #437: required case-level "Who is this for?", when
                Myself is selected, the case-level student fields below ARE
                the student (there are no account demographics). */}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-who-for`}>
                Who is this for?
                {errors.whoFor === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.whoFor}
                onChange={(v) => update({ whoFor: v })}
                options={WHO_FOR_OPTIONS}
                placeholder="Who is this for?"
                searchPlaceholder="Search..."
                className={controlClassName}
                invalid={Boolean(errors.whoFor)}
              />
              {errors.whoFor && errors.whoFor !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.whoFor}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-support-type`}>
                Type of support
                {errors.supportType === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.supportType}
                onChange={handleSupportTypeChange}
                options={SUPPORT_TYPE_OPTIONS}
                placeholder="Select support type"
                searchPlaceholder="Search support type..."
                className={controlClassName}
                invalid={Boolean(errors.supportType)}
              />
              {errors.supportType && errors.supportType !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.supportType}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-name`}>
                Full name
                {errors.parentName === "Required" ? <RequiredFlag /> : null}
              </label>
              <Input
                id={`${idPrefix}-name`}
                className={cn(controlClassName, errors.parentName && invalidInputClassName)}
                aria-invalid={errors.parentName ? true : undefined}
                placeholder="e.g. Mrs. Chan"
                value={form.parentName}
                onChange={(e) => update({ parentName: e.target.value })}
              />
              {errors.parentName && errors.parentName !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.parentName}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-phone`}>
                WhatsApp number
                {errors.contactPhone === "Required" ? <RequiredFlag /> : null}
              </label>
              <Input
                id={`${idPrefix}-phone`}
                className={cn(controlClassName, errors.contactPhone && invalidInputClassName)}
                aria-invalid={errors.contactPhone ? true : undefined}
                placeholder="e.g. +852 9123 4567"
                inputMode="tel"
                value={form.contactPhone}
                onChange={(e) => update({ contactPhone: e.target.value })}
              />
              {errors.contactPhone && errors.contactPhone !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.contactPhone}</p>
              ) : null}
            </div>
          </>
        ) : null}

        {step === 2 && !isAdmissions ? (
          <>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-curriculum`}>
                Curriculum
                {errors.curriculum === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.curriculum}
                onChange={handleCurriculumChange}
                options={curriculumOptions}
                placeholder="Select curriculum"
                searchPlaceholder="Search curriculum..."
                className={controlClassName}
                invalid={Boolean(errors.curriculum)}
              />
              {errors.curriculum && errors.curriculum !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.curriculum}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-component`}>
                Specific component (Optional)
              </label>
              <SearchableSelect
                value={form.specificComponent}
                onChange={(v) => update({ specificComponent: v })}
                options={componentOptions}
                disabled={!form.curriculum}
                placeholder={form.curriculum ? "Optional" : "Select a curriculum first"}
                searchPlaceholder="Search component..."
                className={controlClassName}
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-subject1`}>
                Subject(s) needed
                {errors.subject1 === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.subject1}
                onChange={(v) => update({ subject1: v })}
                options={subjectOptions}
                allowCustom
                disabled={!form.curriculum}
                placeholder={form.curriculum ? "e.g. Math AA HL" : "Select a curriculum first"}
                searchPlaceholder="Search subject..."
                emptyText="No matches, type to enter a custom subject."
                className={controlClassName}
                invalid={Boolean(errors.subject1)}
              />
              {errors.subject1 && errors.subject1 !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.subject1}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-subject2`}>
                Second subject (Optional)
              </label>
              <SearchableSelect
                value={form.subject2}
                onChange={(v) => update({ subject2: v })}
                options={subjectOptions}
                allowCustom
                disabled={!form.curriculum}
                placeholder={form.curriculum ? "e.g. Chemistry" : "Select a curriculum first"}
                searchPlaceholder="Search subject..."
                emptyText="No matches, type to enter a custom subject."
                className={controlClassName}
              />
            </div>
            {/* Issue #183: 3rd/4th subjects, revealed progressively like the
                achievements/subjects pickers on the tutor application. */}
            {form.subject2 ? (
              <div>
                <label className={labelClassName} htmlFor={`${idPrefix}-subject3`}>
                  Third subject (Optional)
                </label>
                <SearchableSelect
                  value={form.subject3}
                  onChange={(v) => update({ subject3: v })}
                  options={subjectOptions}
                  allowCustom
                  disabled={!form.curriculum}
                  placeholder={form.curriculum ? "e.g. Physics" : "Select a curriculum first"}
                  searchPlaceholder="Search subject..."
                  emptyText="No matches, type to enter a custom subject."
                  className={controlClassName}
                />
              </div>
            ) : null}
            {form.subject3 ? (
              <div>
                <label className={labelClassName} htmlFor={`${idPrefix}-subject4`}>
                  Fourth subject (Optional)
                </label>
                <SearchableSelect
                  value={form.subject4}
                  onChange={(v) => update({ subject4: v })}
                  options={subjectOptions}
                  allowCustom
                  disabled={!form.curriculum}
                  placeholder={form.curriculum ? "e.g. Economics" : "Select a curriculum first"}
                  searchPlaceholder="Search subject..."
                  emptyText="No matches, type to enter a custom subject."
                  className={controlClassName}
                />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label className={labelClassName} htmlFor={`${idPrefix}-language`}>
                Instruction language
                {errors.instructionLanguage === "Required" ? <RequiredFlag /> : null}
              </label>
              <ToggleGroup
                type="multiple"
                variant="outline"
                className="flex-wrap justify-start gap-2"
                value={form.instructionLanguage}
                onValueChange={handleLanguageToggle}
                aria-label="Instruction language"
              >
                {INSTRUCTION_LANGUAGE_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "rounded-full border px-4",
                      errors.instructionLanguage && invalidInputClassName,
                    )}
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="mt-1.5 text-xs text-muted-foreground">You can select more than one.</p>
              {errors.instructionLanguage && errors.instructionLanguage !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">
                  {errors.instructionLanguage}
                </p>
              ) : null}
            </div>
            <p className="text-xs font-medium text-muted-foreground sm:col-span-2">Student info</p>
            {/* Issue #437: case-level student gender (both tutoring and
                admissions paths), never an account field. */}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-student-gender`}>
                Student gender
                {errors.studentGender === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.studentGender}
                onChange={(v) => update({ studentGender: v })}
                options={STUDENT_GENDER_OPTIONS}
                placeholder="Select gender"
                searchPlaceholder="Search gender..."
                className={controlClassName}
                invalid={Boolean(errors.studentGender)}
              />
              {errors.studentGender && errors.studentGender !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.studentGender}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-year`}>
                Year (Optional)
              </label>
              <SearchableSelect
                value={form.year}
                onChange={(v) => update({ year: v })}
                options={LEVEL_OPTIONS}
                placeholder="Select year"
                searchPlaceholder="Search year..."
                className={controlClassName}
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-school-type`}>
                School type (Optional)
              </label>
              <SearchableSelect
                value={form.schoolType}
                onChange={(v) => update({ schoolType: v })}
                options={SCHOOL_TYPE_OPTIONS}
                placeholder="Optional"
                searchPlaceholder="Search school type..."
                className={controlClassName}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClassName} htmlFor={`${idPrefix}-school-name`}>
                School name (Optional)
              </label>
              <Input
                id={`${idPrefix}-school-name`}
                className={controlClassName}
                placeholder="e.g. Island School"
                value={form.schoolName}
                onChange={(e) => update({ schoolName: e.target.value })}
              />
            </div>
          </>
        ) : null}

        {step === 2 && isAdmissions ? (
          <>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-admissions-curriculum`}>
                Curriculum
              </label>
              <SearchableSelect
                value={form.curriculum || ADMISSIONS_CURRICULUM}
                onChange={() => {}}
                options={[
                  {
                    value: ADMISSIONS_CURRICULUM,
                    label: ADMISSIONS_CURRICULUM_LABEL,
                  },
                ]}
                disabled
                placeholder={ADMISSIONS_CURRICULUM_LABEL}
                searchPlaceholder="Search curriculum..."
                className={controlClassName}
              />
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Locked for university admissions & standardized test requests.
              </p>
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-admissions-category`}>
                Category (Optional)
              </label>
              <SearchableSelect
                value={form.admissionsCategory}
                onChange={handleAdmissionsCategoryChange}
                options={ADMISSIONS_CATEGORY_OPTIONS}
                placeholder="All admissions subjects"
                searchPlaceholder="Search category..."
                className={controlClassName}
              />
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Standardized Testing &amp; Language (SAT, ACT, IELTS, TOEFL, UCAT, ISAT) or
                Application &amp; Admissions Support (interviews, personal statement, portfolio).
              </p>
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-admissions-subject1`}>
                Subject(s) needed
                {errors.subject1 === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.subject1}
                onChange={(v) => update({ subject1: v })}
                options={admissionsSubjectOptions}
                allowCustom
                placeholder="e.g. IELTS, SAT, Personal Statement"
                searchPlaceholder="Search subject..."
                emptyText="No matches, type to enter a custom subject."
                className={controlClassName}
                invalid={Boolean(errors.subject1)}
              />
              {errors.subject1 && errors.subject1 !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.subject1}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-admissions-subject2`}>
                Second subject (Optional)
              </label>
              <SearchableSelect
                value={form.subject2}
                onChange={(v) => update({ subject2: v })}
                options={admissionsSubjectOptions}
                allowCustom
                placeholder="e.g. UCAT"
                searchPlaceholder="Search subject..."
                emptyText="No matches, type to enter a custom subject."
                className={controlClassName}
              />
            </div>
            {/* Issue #183: 3rd/4th subjects for the admissions path too. */}
            {form.subject2 ? (
              <div>
                <label className={labelClassName} htmlFor={`${idPrefix}-admissions-subject3`}>
                  Third subject (Optional)
                </label>
                <SearchableSelect
                  value={form.subject3}
                  onChange={(v) => update({ subject3: v })}
                  options={admissionsSubjectOptions}
                  allowCustom
                  placeholder="e.g. SAT"
                  searchPlaceholder="Search subject..."
                  emptyText="No matches, type to enter a custom subject."
                  className={controlClassName}
                />
              </div>
            ) : null}
            {form.subject3 ? (
              <div>
                <label className={labelClassName} htmlFor={`${idPrefix}-admissions-subject4`}>
                  Fourth subject (Optional)
                </label>
                <SearchableSelect
                  value={form.subject4}
                  onChange={(v) => update({ subject4: v })}
                  options={admissionsSubjectOptions}
                  allowCustom
                  placeholder="e.g. IELTS"
                  searchPlaceholder="Search subject..."
                  emptyText="No matches, type to enter a custom subject."
                  className={controlClassName}
                />
              </div>
            ) : null}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-pathway`}>
                Target pathway
                {errors.targetPathway === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.targetPathway}
                onChange={(v) => update({ targetPathway: v })}
                options={TARGET_PATHWAY_OPTIONS}
                placeholder="Select pathway"
                searchPlaceholder="Search pathway..."
                className={controlClassName}
                invalid={Boolean(errors.targetPathway)}
              />
              {errors.targetPathway && errors.targetPathway !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.targetPathway}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-test`}>
                Interview / Test
                {errors.interviewTest === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.interviewTest}
                onChange={(v) => update({ interviewTest: v })}
                options={INTERVIEW_TEST_OPTIONS}
                placeholder="Select interview or test"
                searchPlaceholder="Search test..."
                className={controlClassName}
                invalid={Boolean(errors.interviewTest)}
              />
              {errors.interviewTest && errors.interviewTest !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.interviewTest}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClassName} htmlFor={`${idPrefix}-target-school`}>
                Target school (Optional)
              </label>
              <SearchableSelect
                value={form.targetSchool}
                onChange={(v) => update({ targetSchool: v })}
                options={TARGET_SCHOOL_OPTIONS}
                allowCustom
                placeholder="Search target university or school"
                searchPlaceholder="Search school..."
                emptyText="No matches, type to enter a custom school."
                className={controlClassName}
              />
            </div>
            <p className="text-xs font-medium text-muted-foreground sm:col-span-2">Student info</p>
            {/* Issue #437: case-level student gender (both tutoring and
                admissions paths), never an account field. */}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-student-gender`}>
                Student gender
                {errors.studentGender === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.studentGender}
                onChange={(v) => update({ studentGender: v })}
                options={STUDENT_GENDER_OPTIONS}
                placeholder="Select gender"
                searchPlaceholder="Search gender..."
                className={controlClassName}
                invalid={Boolean(errors.studentGender)}
              />
              {errors.studentGender && errors.studentGender !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.studentGender}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-year`}>
                Year (Optional)
              </label>
              <SearchableSelect
                value={form.year}
                onChange={(v) => update({ year: v })}
                options={LEVEL_OPTIONS}
                placeholder="Select year"
                searchPlaceholder="Search year..."
                className={controlClassName}
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-school-name`}>
                Current school name (Optional)
              </label>
              <Input
                id={`${idPrefix}-school-name`}
                className={controlClassName}
                placeholder="e.g. St. Paul's Co-educational College"
                value={form.schoolName}
                onChange={(e) => update({ schoolName: e.target.value })}
              />
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-delivery-mode`}>
                Delivery mode
                {errors.deliveryMode === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.deliveryMode}
                onChange={handleDeliveryModeChange}
                options={DELIVERY_MODE_OPTIONS}
                placeholder="Select delivery mode"
                searchPlaceholder="Search mode..."
                className={controlClassName}
                invalid={Boolean(errors.deliveryMode)}
              />
              {errors.deliveryMode && errors.deliveryMode !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.deliveryMode}</p>
              ) : null}
            </div>
            {showMtr ? (
              <div>
                <label className={labelClassName} htmlFor={`${idPrefix}-district`}>
                  Nearest MTR station
                  {errors.district === "Required" ? <RequiredFlag /> : null}
                </label>
                <MtrStationSelect
                  value={form.district}
                  onChange={(v) => update({ district: v })}
                  placeholder="Select station"
                  className={controlClassName}
                  invalid={Boolean(errors.district)}
                />
                {errors.district && errors.district !== "Required" ? (
                  <p className="mt-1 text-xs font-medium text-destructive">{errors.district}</p>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-budget-max`}>
                Hourly budget
                {errors.budgetMax === "Required" ? <RequiredFlag /> : null}
              </label>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Budget currency"
                  className="h-10 shrink-0 rounded-md border border-[color:var(--ink)]/15 bg-transparent px-2 text-sm font-medium text-[color:var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
                  value={form.budgetCurrency}
                  onChange={(e) => {
                    // #380 review: freeze the seed sync once the visitor
                    // picks a currency themselves.
                    budgetCurrencyTouched.current = true;
                    update({ budgetCurrency: e.target.value });
                  }}
                >
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                <Input
                  id={`${idPrefix}-budget-min`}
                  aria-label={`Minimum hourly budget in ${form.budgetCurrency}`}
                  className={controlClassName}
                  placeholder="Min (optional)"
                  inputMode="numeric"
                  value={form.budgetMin}
                  onChange={(e) => update({ budgetMin: e.target.value.replace(/[^\d]/g, "") })}
                />
                <span className="text-sm font-medium text-muted-foreground">&ndash;</span>
                <Input
                  id={`${idPrefix}-budget-max`}
                  className={cn(controlClassName, errors.budgetMax && invalidInputClassName)}
                  aria-invalid={errors.budgetMax ? true : undefined}
                  placeholder="Max"
                  inputMode="numeric"
                  value={form.budgetMax}
                  onChange={(e) => update({ budgetMax: e.target.value.replace(/[^\d]/g, "") })}
                />
              </div>
              {/* Issue #114: live HK$ baseline so parents see the equivalent
                  concierge works from, hidden for HKD (no conversion). */}
              {budgetApproxNote ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  &asymp; {budgetApproxNote} / hr
                </p>
              ) : null}
              {errors.budgetMax && errors.budgetMax !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.budgetMax}</p>
              ) : null}
            </div>
            {/* Issue #423 (sections 2+3): structured package dropdowns —
                no random input; these feed the card's fee pill, students
                row and rate suffix. */}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-package-type`}>
                {t("case_board.form_package_type")}
              </label>
              <SearchableSelect
                value={form.packageType}
                onChange={(v) => update({ packageType: v || "ongoing_1_5" })}
                options={PACKAGE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                placeholder={t("case_board.form_package_type")}
                searchPlaceholder={t("case_board.form_package_type")}
                className={controlClassName}
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-student-count`}>
                {t("case_board.form_student_count")}
              </label>
              <SearchableSelect
                value={form.studentCount}
                onChange={(v) => update({ studentCount: v || "1" })}
                options={STUDENT_COUNT_OPTIONS}
                placeholder={t("case_board.form_student_count")}
                searchPlaceholder={t("case_board.form_student_count")}
                className={controlClassName}
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-rate-unit`}>
                {t("case_board.form_rate_unit")}
              </label>
              <SearchableSelect
                value={form.rateUnit}
                onChange={(v) => update({ rateUnit: v || "hr" })}
                options={RATE_UNIT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                placeholder={t("case_board.form_rate_unit")}
                searchPlaceholder={t("case_board.form_rate_unit")}
                className={controlClassName}
              />
            </div>
            {/* Issue #391: class format preference, lets staff match the
                family into open small-group cohorts when they're open to it. */}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-class-format`}>
                {t("case_board.form_class_format")}
              </label>
              <SearchableSelect
                value={form.classFormat}
                onChange={(v) => update({ classFormat: v || "either" })}
                options={CLASS_FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                placeholder={t("case_board.form_class_format")}
                searchPlaceholder={t("case_board.form_class_format")}
                className={controlClassName}
              />
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-tutor-background`}>
                Tutor background (Optional)
              </label>
              <SearchableSelect
                value={form.tutorBackground}
                onChange={(v) => update({ tutorBackground: v || "any" })}
                options={TUTOR_BACKGROUND_OPTIONS}
                placeholder="No preference"
                searchPlaceholder="Search background..."
                className={controlClassName}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Note: Official Examiners typically command double the hourly rate of University
                Students
              </p>
            </div>
            {/* Issue #437: case-level tutor gender preference. Hard
                preference, the case board dims Apply on a mismatch. */}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-tutor-gender`}>
                Tutor gender preference
              </label>
              <SearchableSelect
                value={form.tutorGenderPreference}
                onChange={(v) => update({ tutorGenderPreference: v || "any" })}
                options={TUTOR_GENDER_OPTIONS}
                placeholder="No preference"
                searchPlaceholder="Search preference..."
                className={controlClassName}
              />
            </div>
            {/* Issue #412 E: parent B2C compliance triage. A third-party
                engager or non-tutoring duties puts the request on
                compliance_hold for staff re-screening before matching. */}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-engager`}>
                {t("case_request.triage_engager_label")}
                {errors.engager === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.engager}
                onChange={(v) => update({ engager: v || "" })}
                options={PARENT_ENGAGER_OPTIONS}
                placeholder={t("case_request.triage_engager_label")}
                searchPlaceholder={t("case_request.triage_engager_label")}
                className={controlClassName}
                invalid={Boolean(errors.engager)}
              />
              {errors.engager && errors.engager !== "Required" ? (
                <p className="mt-1 text-xs font-medium text-destructive">{errors.engager}</p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-non-tutoring-duties`}>
                {t("case_request.triage_duties_label")}
              </label>
              <SearchableSelect
                value={form.nonTutoringDuties}
                onChange={(v) => update({ nonTutoringDuties: v || "no" })}
                options={PARENT_DUTIES_OPTIONS}
                placeholder={t("case_request.triage_duties_label")}
                searchPlaceholder={t("case_request.triage_duties_label")}
                className={controlClassName}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("case_request.triage_duties_hint")}
              </p>
            </div>
            {/* Issue #199: SEN support section, Yes/No toggle reveals the
                category multi-select and optional details. */}
            <div className="sm:col-span-2">
              <span className={labelClassName}>{t("sen.case_toggle")}</span>
              <div className="mt-2 flex gap-2">
                {[
                  { value: false, label: t("sen.no") },
                  { value: true, label: t("sen.yes") },
                ].map((option) => {
                  const active = form.senRequired === option.value;
                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        update({
                          senRequired: option.value,
                          ...(option.value ? {} : { senCategories: [], senDetails: "" }),
                        })
                      }
                      className={cn(
                        "inline-flex h-9 items-center rounded-full border px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                        active
                          ? "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/10 text-[color:var(--ink)]"
                          : "border-border text-muted-foreground hover:border-[color:var(--brand-link)] hover:text-[color:var(--ink)]",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {form.senRequired ? (
                <div className="mt-4 space-y-4">
                  <div
                    role="group"
                    aria-label={t("sen.categories_aria")}
                    className="space-y-1 rounded-sm border border-border p-3"
                  >
                    {SEN_CATEGORY_OPTIONS.map((category) => {
                      const active = form.senCategories.includes(category);
                      return (
                        <label
                          key={category}
                          className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-sm text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.04]"
                        >
                          <Checkbox
                            checked={active}
                            onCheckedChange={(checked) =>
                              update({
                                senCategories: checked
                                  ? [...form.senCategories, category]
                                  : form.senCategories.filter((item) => item !== category),
                              })
                            }
                          />
                          <span className="font-medium">{senCategoryLabels[category]}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div>
                    <label className={labelClassName} htmlFor={`${idPrefix}-sen-details`}>
                      {t("sen.case_details_label")}
                    </label>
                    <Textarea
                      id={`${idPrefix}-sen-details`}
                      rows={3}
                      maxLength={2000}
                      className="w-full rounded-sm"
                      placeholder={t("sen.case_details_placeholder")}
                      value={form.senDetails}
                      onChange={(e) => update({ senDetails: e.target.value })}
                    />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClassName} htmlFor={`${idPrefix}-notes`}>
                Additional needs (Optional)
              </label>
              <Textarea
                id={`${idPrefix}-notes`}
                rows={4}
                maxLength={500}
                className="w-full rounded-sm"
                placeholder={t("case_board.notes_placeholder")}
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("case_board.notes_counter", { count: form.notes.length })}
              </p>
            </div>
            {/* Issue #311: preset tags as chips, one tap adds it, one tap on
                a saved chip removes it. Optional; typing stays on the notes
                field. Parent picks never displace the auto-derived subject
                tags (mergeCaseTags keeps those in full). Tutors search this
                vocabulary on /tutors. */}
            <div className="sm:col-span-2">
              <span className={labelClassName}>Tags (Optional)</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CASE_TAG_OPTIONS.map((tag) => {
                  const active = form.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        update({
                          tags: active
                            ? form.tags.filter((item) => item !== tag)
                            : form.tags.length < MAX_PROFILE_TAGS
                              ? [...form.tags, tag]
                              : form.tags,
                        })
                      }
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                        active
                          ? "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/10 text-[color:var(--ink)]"
                          : "border-border text-muted-foreground hover:border-[color:var(--brand-link)] hover:text-[color:var(--ink)]",
                      )}
                    >
                      <Hash className="h-3 w-3" aria-hidden="true" />
                      {tag}
                    </button>
                  );
                })}
              </div>
              {form.tags.length >= MAX_PROFILE_TAGS ? (
                <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                  Maximum of {MAX_PROFILE_TAGS} tags.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {/* Honeypot: hidden from humans, filled by bots */}
      <input
        ref={honeypot}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {step === 3 ? (
        <div className="mt-6 grid gap-1.5">
          {/* Issue #253 (F2): the fee rule, shown before the payer agrees. */}
          <div className="rounded-sm border border-border bg-muted/50 p-4 text-sm">
            <p className="font-medium">{t("case_request.fee_notice_title")}</p>
            <p className="mt-1 text-muted-foreground">{t("case_request.fee_notice")}</p>
          </div>
          <label className="flex gap-3 text-sm text-muted-foreground">
            <Checkbox
              checked={form.feeAgreed}
              onCheckedChange={(checked) => update({ feeAgreed: checked === true })}
              aria-invalid={errors.feeAgreed ? true : undefined}
              className={errors.feeAgreed ? "border-destructive" : undefined}
            />
            <span>
              {t("case_request.fee_agree_pre")}{" "}
              <Link
                className="font-medium text-[color:var(--brand-link)] underline underline-offset-4"
                to="/tos"
                hash="tos-matching"
                target="_blank"
              >
                {t("case_request.fee_agree_link")}
              </Link>
              {t("case_request.fee_agree_post", { version: FEE_TERMS_VERSION })}
              {errors.feeAgreed ? (
                <span className="ml-2 align-middle text-xs font-medium text-destructive">
                  Required
                </span>
              ) : null}
            </span>
          </label>
          <label className="flex gap-3 text-sm text-muted-foreground">
            <Checkbox
              checked={form.termsAgreed}
              onCheckedChange={(checked) => update({ termsAgreed: checked === true })}
              aria-invalid={errors.termsAgreed ? true : undefined}
              className={errors.termsAgreed ? "border-destructive" : undefined}
            />
            <span>
              I agree to the MatchMax{" "}
              <Link
                className="font-medium text-[color:var(--brand-link)] underline underline-offset-4"
                to="/tos"
                target="_blank"
              >
                Terms and Conditions
              </Link>{" "}
              and confirm the details above are accurate.
              {errors.termsAgreed ? (
                <span className="ml-2 align-middle text-xs font-medium text-destructive">
                  Required
                </span>
              ) : null}
            </span>
          </label>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-sm px-6 font-medium"
            disabled={step === 1}
            onClick={() => {
              setStep((prev) => Math.max(1, prev - 1));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <ArrowLeft className="mr-2 h-5 w-5" /> Back
          </Button>
          <Button
            type="submit"
            disabled={submitMutation.isPending}
            variant="solid"
            color="blue"
            className="h-12 rounded-sm px-8 font-medium"
          >
            {submitMutation.isPending ? (
              "Submitting…"
            ) : step < 3 ? (
              <>
                Next <ArrowRight className="ml-2 h-5 w-5" />
              </>
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" /> Submit case
              </>
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground sm:text-sm">
          Free for parents, our team will contact you on WhatsApp within one business day.
        </p>
      </div>
    </form>
  );
}

function isAdmissionsPath(supportType: string): boolean {
  return supportType === "admissions";
}

function fieldStepOf(field: keyof FormState): number {
  if (
    field === "academicLevel" ||
    field === "secondaryBand" ||
    field === "uniField" ||
    field === "uniName" ||
    field === "uniProgram" ||
    field === "uniCourseCodes" ||
    field === "kindergartenTopics" ||
    field === "requesterType" ||
    field === "whoFor" ||
    field === "parentName" ||
    field === "contactPhone" ||
    field === "supportType"
  ) {
    return 1;
  }
  if (
    field === "curriculum" ||
    field === "subject1" ||
    field === "instructionLanguage" ||
    field === "studentGender" ||
    field === "targetPathway" ||
    field === "interviewTest"
  ) {
    return 2;
  }
  return 3;
}
