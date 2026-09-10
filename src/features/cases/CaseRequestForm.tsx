import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MtrStationSelect } from "@/components/ui/mtr-station-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { submitCaseRequest } from "@/lib/cases.functions";
import {
  CURRICULUM_OPTIONS,
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
  getComponentOptionsForCurriculum,
  getSubjectOptionsForCurriculum,
} from "@/features/cases/case-options";
import { useFormDraft } from "@/lib/use-form-draft";
import { cn } from "@/lib/utils";

const PHONE_REGEX = /^[+(\d][\d\s()./+-]{4,19}\d$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const labelClassName =
  "mb-1.5 block text-sm font-bold text-[color:var(--ink)] after:ml-0.5 after:text-[color:var(--muted-foreground)]";
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
  parentName: string;
  contactPhone: string;
  contactEmail: string;
  supportType: string;
  // Page 2 — Path A: Subject tutoring
  curriculum: string;
  subject1: string;
  subject2: string;
  specificComponent: string;
  instructionLanguage: string[];
  year: string;
  schoolName: string;
  schoolType: string;
  // Page 2 — Path B: Admissions
  targetPathway: string;
  targetSchool: string;
  interviewTest: string;
  // Page 3: Logistics
  deliveryMode: string;
  district: string;
  budgetMin: string;
  budgetMax: string;
  tutorBackground: string;
  notes: string;
};

const INITIAL_FORM: FormState = {
  requesterType: "",
  parentName: "",
  contactPhone: "",
  contactEmail: "",
  supportType: "",
  curriculum: "",
  subject1: "",
  subject2: "",
  specificComponent: "",
  instructionLanguage: [],
  year: "",
  schoolName: "",
  schoolType: "",
  targetPathway: "",
  targetSchool: "",
  interviewTest: "",
  deliveryMode: "",
  district: "",
  budgetMin: "",
  budgetMax: "",
  tutorBackground: "any",
  notes: "",
};

type CaseRequestFormProps = {
  idPrefix?: string;
  onSubmitted?: (result: { caseCode: string }) => void;
};

export function CaseRequestForm({ idPrefix = "cr", onSubmitted }: CaseRequestFormProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<{ caseCode: string } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());
  const { restored, savedAt, saveDraft, clearDraft } = useFormDraft<FormState>("case-request-v5");

  useEffect(() => {
    if (!restored) return;
    setForm((prev) => ({ ...prev, ...restored }));
  }, [restored]);

  const isBlankDraft = (value: FormState) =>
    Object.entries(value).every(
      ([key, v]) =>
        v === "" ||
        (Array.isArray(v) && v.length === 0) ||
        (key === "tutorBackground" && v === "any"),
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
  const subjectOptions = getSubjectOptionsForCurriculum(form.curriculum);
  const componentOptions = getComponentOptionsForCurriculum(form.curriculum);
  const showMtr = form.deliveryMode !== "" && form.deliveryMode !== "online";

  // Curriculum locking: subjects/components only populate for the active
  // curriculum; changing it instantly resets them to blank.
  const handleCurriculumChange = (value: string) => {
    update({ curriculum: value, subject1: "", subject2: "", specificComponent: "" });
  };

  // MTR is hidden for online-only requests — clear any stale selection.
  const handleDeliveryModeChange = (value: string) => {
    update(value === "online" ? { deliveryMode: value, district: "" } : { deliveryMode: value });
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
      if (!form.requesterType) nextErrors.requesterType = "Required";
      if (!form.parentName.trim()) nextErrors.parentName = "Required";
      if (!form.contactPhone.trim()) {
        nextErrors.contactPhone = "Required";
      } else if (!PHONE_REGEX.test(form.contactPhone.trim())) {
        nextErrors.contactPhone = "Please enter a valid WhatsApp number (e.g. +852 9123 4567).";
      }
      if (!form.contactEmail.trim()) {
        nextErrors.contactEmail = "Required";
      } else if (!EMAIL_REGEX.test(form.contactEmail.trim())) {
        nextErrors.contactEmail = "Please enter a valid email address.";
      }
      if (!form.supportType) nextErrors.supportType = "Required";
    }
    if (target === 2) {
      if (form.supportType === "admissions") {
        if (!form.targetPathway) nextErrors.targetPathway = "Required";
        if (!form.interviewTest) nextErrors.interviewTest = "Required";
      } else {
        if (!form.curriculum) nextErrors.curriculum = "Required";
        if (!form.subject1) nextErrors.subject1 = "Required";
        if (!form.instructionLanguage.length) nextErrors.instructionLanguage = "Required";
      }
    }
    if (target === 3) {
      if (!form.deliveryMode) nextErrors.deliveryMode = "Required";
      if (form.deliveryMode !== "online" && !form.district) nextErrors.district = "Required";
      if (!form.budgetMax.trim()) nextErrors.budgetMax = "Required";
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
      const subjects = admissions
        ? []
        : [form.subject1, form.subject2]
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 4);
      return submitCaseRequest({
        data: {
          requesterType: form.requesterType as "parent" | "student",
          parentName: form.parentName,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
          supportType: form.supportType as "subject_tutoring" | "admissions",
          curriculum: admissions ? null : form.curriculum,
          subjects,
          specificComponent:
            !admissions && form.specificComponent !== "None"
              ? form.specificComponent || null
              : null,
          instructionLanguage: admissions ? [] : form.instructionLanguage,
          year: form.year || null,
          schoolName: form.schoolName.trim() || null,
          schoolType: admissions ? null : form.schoolType || null,
          targetPathway: admissions ? form.targetPathway : null,
          targetSchool: admissions ? form.targetSchool.trim() || null : null,
          interviewTest: admissions ? form.interviewTest : null,
          mode: form.deliveryMode as "online" | "offline" | "both" | "no_pref",
          district: form.deliveryMode !== "online" ? form.district || null : null,
          budgetMin: form.budgetMin ? Number(form.budgetMin) : null,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
          tutorBackground: (form.tutorBackground || "any") as
            "uni_student" | "official_examiner" | "any",
          notes: form.notes.trim() || null,
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
      <div className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-8 text-center shadow-[var(--shadow-brand)] sm:p-12">
        <CheckCircle2
          className="mx-auto h-12 w-12 text-[color:var(--muted-foreground)]"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-3xl font-bold text-[color:var(--ink)]">Case request received</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Keep this reference for your records.
        </p>
        <p className="mt-4 font-mono text-2xl font-bold tracking-tight text-[color:var(--ink)]">
          {result.caseCode}
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm font-bold text-[color:var(--ink)]">
          The MatchMax team will contact you shortly on WhatsApp.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
          Our team reviews every request — once approved, your case appears on this board so
          qualified tutors can apply.
        </p>
        <div className="mt-8 flex justify-center">
          <Button variant="outline" className="h-11 rounded-sm px-6 font-bold" onClick={resetForm}>
            Submit another request
          </Button>
        </div>
      </div>
    );
  }

  const stepLabels = ["Contact", isAdmissions ? "Admissions" : "Tutoring", "Logistics"];

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-5 shadow-[var(--shadow-brand)] sm:p-8"
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
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors",
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
                  "truncate text-xs font-bold sm:text-sm",
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

      <div className="grid gap-4 sm:grid-cols-2">
        {step === 1 ? (
          <>
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
                <p className="mt-1 text-xs font-semibold text-destructive">
                  {errors.requesterType}
                </p>
              ) : null}
            </div>
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-support-type`}>
                Type of support
                {errors.supportType === "Required" ? <RequiredFlag /> : null}
              </label>
              <SearchableSelect
                value={form.supportType}
                onChange={(v) => update({ supportType: v })}
                options={SUPPORT_TYPE_OPTIONS}
                placeholder="Select support type"
                searchPlaceholder="Search support type..."
                className={controlClassName}
                invalid={Boolean(errors.supportType)}
              />
              {errors.supportType && errors.supportType !== "Required" ? (
                <p className="mt-1 text-xs font-semibold text-destructive">{errors.supportType}</p>
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
                <p className="mt-1 text-xs font-semibold text-destructive">{errors.parentName}</p>
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
                <p className="mt-1 text-xs font-semibold text-destructive">{errors.contactPhone}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClassName} htmlFor={`${idPrefix}-email`}>
                Email
                {errors.contactEmail === "Required" ? <RequiredFlag /> : null}
              </label>
              <Input
                id={`${idPrefix}-email`}
                type="email"
                className={cn(controlClassName, errors.contactEmail && invalidInputClassName)}
                aria-invalid={errors.contactEmail ? true : undefined}
                placeholder="e.g. mrs.chan@example.com"
                inputMode="email"
                value={form.contactEmail}
                onChange={(e) => update({ contactEmail: e.target.value })}
              />
              {errors.contactEmail && errors.contactEmail !== "Required" ? (
                <p className="mt-1 text-xs font-semibold text-destructive">{errors.contactEmail}</p>
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
                options={CURRICULUM_OPTIONS}
                placeholder="Select curriculum"
                searchPlaceholder="Search curriculum..."
                className={controlClassName}
                invalid={Boolean(errors.curriculum)}
              />
              {errors.curriculum && errors.curriculum !== "Required" ? (
                <p className="mt-1 text-xs font-semibold text-destructive">{errors.curriculum}</p>
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
                emptyText="No matches — type to enter a custom subject."
                className={controlClassName}
                invalid={Boolean(errors.subject1)}
              />
              {errors.subject1 && errors.subject1 !== "Required" ? (
                <p className="mt-1 text-xs font-semibold text-destructive">{errors.subject1}</p>
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
                emptyText="No matches — type to enter a custom subject."
                className={controlClassName}
              />
            </div>
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
              {errors.instructionLanguage && errors.instructionLanguage !== "Required" ? (
                <p className="mt-1 text-xs font-semibold text-destructive">
                  {errors.instructionLanguage}
                </p>
              ) : null}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
              Student info
            </p>
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
                <p className="mt-1 text-xs font-semibold text-destructive">
                  {errors.targetPathway}
                </p>
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
                <p className="mt-1 text-xs font-semibold text-destructive">
                  {errors.interviewTest}
                </p>
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
                emptyText="No matches — type to enter a custom school."
                className={controlClassName}
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
              Student info
            </p>
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
                <p className="mt-1 text-xs font-semibold text-destructive">{errors.deliveryMode}</p>
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
                  <p className="mt-1 text-xs font-semibold text-destructive">{errors.district}</p>
                ) : null}
              </div>
            ) : null}
            <div>
              <label className={labelClassName} htmlFor={`${idPrefix}-budget-max`}>
                Hourly budget (HK$)
                {errors.budgetMax === "Required" ? <RequiredFlag /> : null}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={`${idPrefix}-budget-min`}
                  aria-label="Minimum hourly budget in HK$"
                  className={controlClassName}
                  placeholder="Min (optional)"
                  inputMode="numeric"
                  value={form.budgetMin}
                  onChange={(e) => update({ budgetMin: e.target.value.replace(/[^\d]/g, "") })}
                />
                <span className="text-sm font-bold text-muted-foreground">&ndash;</span>
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
              {errors.budgetMax && errors.budgetMax !== "Required" ? (
                <p className="mt-1 text-xs font-semibold text-destructive">{errors.budgetMax}</p>
              ) : null}
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
            <div className="sm:col-span-2">
              <label className={labelClassName} htmlFor={`${idPrefix}-notes`}>
                Additional needs (Optional)
              </label>
              <Textarea
                id={`${idPrefix}-notes`}
                rows={4}
                className="w-full rounded-sm"
                placeholder="Target grades, availability, trial lesson preference, anything else we should know…"
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
              />
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

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-sm px-6 font-bold"
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
            className="h-12 rounded-sm px-8 font-bold"
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
          Free for parents — our team will contact you on WhatsApp within one business day.
        </p>
        <p
          aria-live="polite"
          className={cn(
            "flex items-center justify-center gap-1.5 text-center text-xs font-medium text-[color:var(--muted-foreground)] transition-opacity duration-300",
            savedAt && !result ? "opacity-100" : "opacity-0",
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t("common.draft_saved")}
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
    field === "requesterType" ||
    field === "parentName" ||
    field === "contactPhone" ||
    field === "contactEmail" ||
    field === "supportType"
  ) {
    return 1;
  }
  if (
    field === "curriculum" ||
    field === "subject1" ||
    field === "instructionLanguage" ||
    field === "targetPathway" ||
    field === "interviewTest"
  ) {
    return 2;
  }
  return 3;
}
