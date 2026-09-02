import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import Stepper, { Step, type StepperIndicatorRenderArgs } from "@/components/ui/stepper";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_FILE_TYPES,
  COMMISSION_TEXT,
  CURRICULUM_OPTIONS,
  FORMAT_OPTIONS,
  MATERIALS_OPTIONS,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  PRIVACY_TEXT,
  STATUS_OPTIONS,
  tutorApplicationSchema,
} from "@/lib/tutor-application.schema";
import { submitTutorApplication } from "@/lib/tutor-application.functions";
import { MTR_LINES, toggleLineStations } from "@/features/tutor-application/mtr";
import { getGradesForSelection, getSystem } from "@/features/tutors/examSystems";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Apply to tutor with MatchMax — Tutor Application" },
      {
        name: "description",
        content:
          "Apply to join the MatchMax tutor team in Hong Kong. Share your academic results, teaching experience and availability in one short application form.",
      },
      { property: "og:title", content: "Apply to tutor with MatchMax" },
      {
        property: "og:description",
        content:
          "Join the MatchMax tutor network in Hong Kong — submit your academic results, experience and rate.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://matchmax.hk/join" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/join" }],
  }),
  component: JoinPage,
});

interface FormState {
  name: string;
  phone: string;
  email: string;
  startDate: string;
  status: string;
  statusOther: string;
  university: string;
  programme: string;
  highSchool: string;
  curriculum: string;
  curricula: string[];
  overallScore: string;
  subjectsConfident: string;
  subjectResults: string;
  awards: string;
  experience: string;
  hourlyRate: string;
  materials: string;
  format: string;
  maxStudents: string;
  locations: string;
  medium: string;
  notes: string;
}

interface SubjectScoreRow {
  subject: string;
  grade: string;
  details: string;
}

const CURRICULUM_SYSTEM_IDS: Record<string, string> = {
  IBDP: "ib",
  "A-Level": "alevel",
  "IGCSE / GCSE": "igcse",
  HKDSE: "dse",
  AP: "ap",
};

const initialState: FormState = {
  name: "",
  phone: "",
  email: "",
  startDate: "",
  status: "",
  statusOther: "",
  university: "",
  programme: "",
  highSchool: "",
  curriculum: "",
  curricula: [],
  overallScore: "",
  subjectsConfident: "",
  subjectResults: "",
  awards: "",
  experience: "",
  hourlyRate: "",
  materials: "",
  format: "",
  maxStudents: "",
  locations: "",
  medium: "",
  notes: "",
};

const STEP_TITLES = [
  "Contact",
  "Academic",
  "Teaching",
  "Consent",
] as const;

const STEP_FIELD_KEYS: ReadonlyArray<readonly string[]> = [
  ["name", "phone", "email", "startDate", "status"],
  ["university", "programme", "highSchool", "curriculum", "curricula", "overallScore"],
  ["subjectsConfident", "subjectResults", "awards", "experience", "hourlyRate", "materials", "format"],
  ["maxStudents", "locations", "medium", "notes", "attachments", "commissionAck", "privacyAck"],
];

function stepForField(field: string) {
  const step = STEP_FIELD_KEYS.findIndex((fields) => fields.includes(field));
  return step >= 0 ? step + 1 : 1;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label className="text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function RadioGroupField({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option;
        return (
          <label
            key={option}
            className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition ${
              selected
                ? "border-[color:var(--ink)] bg-[color:var(--surface-invert)] text-white"
                : "border-border bg-background text-muted-foreground hover:border-[color:var(--brand-teal)]"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option}
              checked={selected}
              onChange={() => onChange(option)}
            />
            {option}
          </label>
        );
      })}
    </div>
  );
}

function SampleProfile() {
  const { t } = useTranslation();
  const items = [
    { label: "Name", value: t("join.sample_name") },
    { label: "Current status", value: t("join.sample_status") },
    { label: "University / institution", value: t("join.sample_university") },
    { label: "Degree / programme", value: t("join.sample_programme") },
    { label: "High school and graduation year", value: t("join.sample_high_school") },
    { label: "Curriculum completed", value: t("join.sample_curriculum") },
    { label: "Overall achieved score", value: t("join.sample_overall_score") },
    { label: "Subjects confident teaching", value: t("join.sample_subjects") },
    { label: "Relevant subject results", value: t("join.sample_results") },
    { label: "Awards / achievements", value: t("join.sample_awards") },
    { label: "Teaching experience", value: t("join.sample_experience") },
    { label: "Normal hourly rate", value: t("join.sample_rate") },
    { label: "Teaching materials", value: t("join.sample_materials") },
    { label: "Preferred format", value: t("join.sample_format") },
    { label: "Max students", value: t("join.sample_max_students") },
    { label: "Preferred locations", value: t("join.sample_locations") },
    { label: "Medium of instruction", value: t("join.sample_medium") },
    { label: "Anything else", value: t("join.sample_notes") },
  ];

  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none flex-col gap-1 p-4 text-sm font-semibold text-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{t("join.sample_title")}</span>
        <span className="text-xs font-normal text-muted-foreground">{t("join.sample_summary")}</span>
      </summary>
      <div className="border-t border-border p-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

function StepHeading({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-teal)]">
        Step {step} of {STEP_TITLES.length}
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--ink)] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {description}
      </p>
    </div>
  );
}

function renderJoinStepIndicator({
  step,
  currentStep,
  onStepClick,
}: StepperIndicatorRenderArgs) {
  const status = currentStep === step ? "active" : currentStep > step ? "complete" : "inactive";

  return (
    <button
      type="button"
      className="join-stepper-indicator"
      aria-current={status === "active" ? "step" : undefined}
      aria-label={`Go to step ${step}: ${STEP_TITLES[step - 1]}`}
      onClick={() => onStepClick(step)}
    >
      <span
        className={cn(
          "join-stepper-circle",
          status === "active" && "join-stepper-circle--active",
          status === "complete" && "join-stepper-circle--complete",
        )}
      >
        {status === "complete" ? "✓" : status === "active" ? <span className="join-stepper-active-dot" /> : step}
      </span>
      <span className={cn("join-stepper-label", status === "active" && "join-stepper-label--active")}>
        {STEP_TITLES[step - 1]}
      </span>
    </button>
  );
}

function JoinPage() {

  const { t } = useTranslation();
  const submit = useServerFn(submitTutorApplication);
  const [form, setForm] = useState<FormState>(initialState);
  const [files, setFiles] = useState<File[]>([]);
  const [commissionAck, setCommissionAck] = useState(false);
  const [privacyAck, setPrivacyAck] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isStepperPinned, setIsStepperPinned] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [subjectScoreRows, setSubjectScoreRows] = useState<SubjectScoreRow[]>([
    { subject: "", grade: "", details: "" },
  ]);
  const previousStepRef = useRef(currentStep);
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaWidgetIdRef = useRef<string | null>(null);
  const siteKey =
    import.meta.env.VITE_TURNSTILE_SITEKEY || "0x4AAAAAAEiLema3uiveM5pp";
  const isProfessional = [
    "Current school teacher",
    "Former school teacher",
    "Official examiner / moderator",
  ].includes(form.status);
  const applicationPath = isProfessional ? "Professional / Examiner" : form.curriculum;
  const screeningNotice = isProfessional
    ? "MatchMax's Professional tier is reserved for highly qualified educators. Teaching credentials or official examiner letters are required for verification, and your identity, CV, and current employment remain confidential to the MatchMax internal team."
    : form.curriculum === "IBDP"
      ? "For IBDP, MatchMax currently accepts candidates with an overall achieved score of 40 or above. Applications are reviewed by our team and unsuccessful candidates are informed by email."
      : form.curriculum === "A-Level"
        ? "For A-Level, MatchMax generally accepts candidates with a minimum overall achievement of A*AA or equivalent. Applications are reviewed by our team and unsuccessful candidates are informed by email."
        : form.curriculum === "IGCSE / GCSE"
          ? "For IGCSE / GCSE, MatchMax seeks a strong track record of A*/A or 7-9 grades, particularly in the subjects you wish to teach."
          : form.curriculum === "HKDSE"
            ? "For HKDSE, MatchMax accepts candidates with a minimum Best 5 score of 30. Applications are reviewed by our team and unsuccessful candidates are informed by email."
            : "MatchMax employs a rigorous screening process to maintain premium tutor standards."
  const overallScoreLabel =
    form.curriculum === "IBDP"
      ? "Overall achieved score (40-45)"
      : form.curriculum === "HKDSE"
        ? "Best 5 score"
        : form.curriculum === "A-Level" || form.curriculum === "IGCSE / GCSE"
          ? "Overall achieved grades"
          : "Overall achieved score or grades";
  const subjectResultLabel = isProfessional
    ? "Teaching credentials, examiner roles and track record"
    : "Subject scores and academic strengths";
  const examSystem = getSystem(CURRICULUM_SYSTEM_IDS[form.curriculum] ?? "other");

  useEffect(() => {
    const updateStickyState = () => {
      const progress = document.querySelector(".join-stepper-progress");
      const isMobile = window.matchMedia("(max-width: 639px)").matches;
      const isPinned = Boolean(isMobile && progress && progress.getBoundingClientRect().top <= 64);
      setIsStepperPinned(isPinned);
    };

    updateStickyState();
    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);
    return () => {
      window.removeEventListener("scroll", updateStickyState);
      window.removeEventListener("resize", updateStickyState);
    };
  }, []);

  useEffect(() => {
    if (previousStepRef.current === currentStep) return;
    previousStepRef.current = currentStep;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const content = document.querySelector(".join-stepper-content");
        if (!content) return;

        const isMobile = window.matchMedia("(max-width: 639px)").matches;
        const stickyProgress = document.querySelector(".join-stepper-progress");
        const siteHeader = document.querySelector(".join-site-header");
        const offset = isMobile
          ? (stickyProgress?.getBoundingClientRect().height ?? 0) + 16
          : (siteHeader?.getBoundingClientRect().height ?? 0) + 24;
        const nextTop = content.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 4 || !siteKey || !captchaContainerRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !captchaContainerRef.current || captchaWidgetIdRef.current) return;
      captchaWidgetIdRef.current = window.turnstile.render(captchaContainerRef.current, {
        sitekey: siteKey,
        action: "tutor_application",
        callback: setCaptchaToken,
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setCaptchaToken(null),
      });
    };

    const scriptSelector =
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]';
    const script = document.querySelector<HTMLScriptElement>(scriptSelector);
    if (script) {
      script.addEventListener("load", renderWidget);
      renderWidget();
      return () => script.removeEventListener("load", renderWidget);
    }

    const newScript = document.createElement("script");
    newScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    newScript.async = true;
    newScript.defer = true;
    newScript.addEventListener("load", renderWidget);
    document.head.appendChild(newScript);
    return () => newScript.removeEventListener("load", renderWidget);
  }, [currentStep, siteKey]);

  const set = (key: Exclude<keyof FormState, "curricula">) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function toggleCurriculum(curriculum: string) {
    setForm((previous) => {
      const curricula = previous.curricula.includes(curriculum)
        ? previous.curricula.filter((item) => item !== curriculum)
        : [...previous.curricula, curriculum];
      const primaryCurriculum = curricula.includes(previous.curriculum)
        ? previous.curriculum
        : (curricula[0] ?? "");
      return { ...previous, curricula, curriculum: primaryCurriculum };
    });
  }

  function toggleStation(station: string) {
    setSelectedStations((previous) => {
      const next = previous.includes(station)
        ? previous.filter((item) => item !== station)
        : [...previous, station];
      set("locations")(next.join(", "));
      return next;
    });
  }

  function toggleLine(line: (typeof MTR_LINES)[number]) {
    setSelectedStations((previous) => {
      const next = toggleLineStations(previous, line);
      set("locations")(next.join(", "));
      return next;
    });
  }

  function updateSubjectScore(index: number, patch: Partial<SubjectScoreRow>) {
    setSubjectScoreRows((previous) => {
      const next = previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      );
      set("subjectResults")(
        next
          .filter((row) => row.subject || row.grade || row.details)
          .map((row) => `${row.subject || "Subject"}: ${row.grade || "No grade"}${row.details ? ` (${row.details})` : ""}`)
          .join("\n"),
      );
      return next;
    });
  }

  function validateCurrentStep(step: number): boolean {
    const requiredFields = STEP_FIELD_KEYS[step - 1] ?? [];
    const fieldErrors: Record<string, string> = {};

    for (const field of requiredFields) {
      if (["startDate", "university", "programme", "awards", "maxStudents", "locations", "notes"].includes(field)) {
        continue;
      }
      if (field === "attachments") {
        if (files.length === 0) fieldErrors[field] = "Please attach your results.";
        continue;
      }
      if (field === "commissionAck" && !commissionAck) {
        fieldErrors[field] = "Please accept the commission terms.";
        continue;
      }
      if (field === "privacyAck" && !privacyAck) {
        fieldErrors[field] = "Please accept the privacy notice.";
        continue;
      }
      if (field === "curricula" && form.curricula.length === 0) {
        fieldErrors[field] = "Select at least one curriculum.";
        continue;
      }
      const value = form[field as keyof FormState];
      if (typeof value === "string" && !value.trim()) fieldErrors[field] = "Required";
    }

    if (form.status === "Other" && !form.statusOther.trim()) fieldErrors.statusOther = "Required";
    if (step === 4 && form.format !== "Online" && selectedStations.length === 0) {
      fieldErrors.locations = "Select at least one possible teaching location.";
    }

    setErrors((previous) => ({ ...previous, ...fieldErrors }));
    if (Object.keys(fieldErrors).length === 0) return true;

    const firstField = Object.keys(fieldErrors)[0];
    setFormError("Please complete the highlighted questions before continuing.");
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
    });
    return false;
  }

  function handleBeforeStepChange(step: number, nextStep: number) {
    if (nextStep > step + 1) {
      setFormError("Complete each page in order before continuing.");
      return false;
    }
    return nextStep <= step || validateCurrentStep(step);
  }

  function handleStepChange(nextStep: number) {
    setCurrentStep(nextStep);
    setFormError(null);
  }

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).slice(0, MAX_FILES);
    const rejected = picked.filter(
      (f) => !ACCEPTED_FILE_TYPES.includes(f.type) || f.size > MAX_FILE_BYTES,
    );
    if (rejected.length > 0) {
      setErrors((prev) => ({
        ...prev,
        attachments: "Only PDF, JPG, PNG or DOC(X) files up to 10 MB each are accepted.",
      }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next["attachments"];
        return next;
      });
    }
    setFiles(picked.filter((f) => !rejected.includes(f)));
  }

  async function submitApplication() {
    setFormError(null);

    if (!siteKey) {
      setCurrentStep(4);
      setFormError("Application verification is unavailable. Please try again later.");
      return;
    }
    if (!captchaToken) {
      setCurrentStep(4);
      setFormError("Please complete the security check before submitting.");
      return;
    }

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      setErrors((prev) => ({ ...prev, attachments: "Attachments exceed 20 MB in total." }));
      return;
    }

    setSubmitting(true);
    try {
      const attachments = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          content: await toBase64(file),
        })),
      );

      const parsed = tutorApplicationSchema.safeParse({
        ...form,
        turnstileToken: captchaToken,
        commissionAck,
        privacyAck,
        attachments,
      });

      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? "form");
          if (!fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        const firstError = Object.keys(fieldErrors)[0];
        if (firstError) setCurrentStep(stepForField(firstError));
        setFormError("Please check the highlighted questions and try again.");
        setSubmitting(false);
        return;
      }

      setErrors({});
      await submit({ data: parsed.data });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
      if (captchaWidgetIdRef.current && window.turnstile) {
        setCaptchaToken(null);
        window.turnstile.reset(captchaWidgetIdRef.current);
      }
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[color:var(--brand-teal)]" />
            <h1 className="mt-4 text-2xl font-black tracking-tight text-[color:var(--ink)]">
              {t("join.success_title")}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your application has been received{isProfessional ? " securely" : ""}! Please note that parents can directly source and request you for lessons via our MatchMax WhatsApp hotline. Keep an eye on your messages!
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                asChild
                className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
              >
                <Link to="/">{t("join.back_home")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/tutors">{t("join.browse_tutors")}</Link>
              </Button>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader className={cn("join-site-header", isStepperPinned && "join-site-header--hidden")} />
      <main className="flex-1">
        <section className="pt-8 sm:pt-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h1 className="text-3xl font-black tracking-tight text-[color:var(--ink)] sm:text-4xl lg:text-5xl">
              {t("join.title")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("join.subtitle")}
            </p>
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground">{t("join.consent")}</p>
          </div>
        </section>

        <section className="py-8 sm:py-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mb-8">
              <SampleProfile />
            </div>

            {form.status || form.curriculum ? (
              <aside className="mb-8 rounded-lg border border-[color:var(--brand-teal)]/30 bg-[color:var(--brand-teal)]/8 px-4 py-3 text-sm leading-relaxed text-foreground">
                <span className="font-semibold">{applicationPath || "Tutor"} application:</span> {screeningNotice}
              </aside>
            ) : null}

            <form
              className="join-stepper-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submitApplication();
              }}
            >
              <Stepper
                className={cn("join-stepper", isStepperPinned && "join-stepper--pinned")}
                stepContainerClassName="join-stepper-progress"
                footerClassName="join-stepper-mobile-footer"
                contentClassName="join-stepper-content"
                currentStep={currentStep}
                initialStep={1}
                onStepChange={handleStepChange}
                onBeforeStepChange={handleBeforeStepChange}
                onFinalStepCompleted={() => void submitApplication()}
                backButtonText="Previous"
                nextButtonText="Continue"
                completeButtonText="Submit application"
                nextButtonProps={{ disabled: submitting }}
                renderStepIndicator={renderJoinStepIndicator}
              >
                <Step>
                  <StepHeading
                    step={1}
                    title="Basic details & status"
                    description="Choose your current status before continuing to your academic qualifications."
                  />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Name" required error={errors["name"]}>
                      <Input
                        value={form.name}
                        onChange={(e) => set("name")(e.target.value)}
                        placeholder="Jayden Lau"
                      />
                    </Field>
                    <Field label="Contact number / WhatsApp" required error={errors["phone"]}>
                      <Input
                        value={form.phone}
                        onChange={(e) => set("phone")(e.target.value)}
                        placeholder="+852 9123 4567"
                      />
                    </Field>
                    <Field label="Email address" required error={errors["email"]}>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => set("email")(e.target.value)}
                        placeholder="jayden.lau@example.com"
                      />
                    </Field>
                    <Field label="Earliest start date" error={errors["startDate"]}>
                      <Input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => set("startDate")(e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Current status"
                      required
                      hint="Choose the option that best describes you right now."
                      error={errors["status"]}
                      className="sm:col-span-2"
                    >
                      <RadioGroupField
                        name="status"
                        options={STATUS_OPTIONS}
                        value={form.status}
                        onChange={set("status")}
                      />
                      {form.status === "Other" ? (
                        <Input
                          className="mt-2"
                          value={form.statusOther}
                          onChange={(e) => set("statusOther")(e.target.value)}
                          placeholder="Gap year, working full-time in finance"
                        />
                      ) : null}
                    </Field>
                  </div>
                </Step>

                <Step>
                  <StepHeading
                    step={2}
                    title="Academic background & qualifications"
                    description="Choose your primary curriculum, then include every other curriculum you completed."
                  />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Current university / institution" error={errors["university"]}>
                      <Input
                        value={form.university}
                        onChange={(e) => set("university")(e.target.value)}
                        placeholder="The University of Hong Kong"
                      />
                    </Field>
                    <Field label="Degree / programme" error={errors["programme"]}>
                      <Input
                        value={form.programme}
                        onChange={(e) => set("programme")(e.target.value)}
                        placeholder="BBA (Law), Year 2"
                      />
                    </Field>
                    <Field label="High school and graduation year" required error={errors["highSchool"]}>
                      <Input
                        value={form.highSchool}
                        onChange={(e) => set("highSchool")(e.target.value)}
                        placeholder="Diocesan Boys' School, 2023"
                      />
                    </Field>
                    <Field label="Curriculum completed" required error={errors["curriculum"]}>
                      <RadioGroupField
                        name="curriculum"
                        options={CURRICULUM_OPTIONS}
                        value={form.curriculum}
                        onChange={(curriculum) => {
                          setSubjectScoreRows([{ subject: "", grade: "", details: "" }]);
                          setForm((previous) => ({
                            ...previous,
                            curriculum,
                            subjectResults: "",
                            curricula: previous.curricula.includes(curriculum)
                              ? previous.curricula
                              : [...previous.curricula, curriculum],
                          }));
                        }}
                      />
                    </Field>
                    <Field
                      label="Other curricula completed"
                      required
                      hint="Select every curriculum you completed. You can add subject results for each in the next version of this form."
                      error={errors["curricula"]}
                      className="sm:col-span-2"
                    >
                      <div className="flex flex-wrap gap-x-5 gap-y-3">
                        {CURRICULUM_OPTIONS.map((curriculum) => (
                          <label key={curriculum} className="flex items-center gap-2 text-sm text-foreground">
                            <Checkbox
                              checked={form.curricula.includes(curriculum)}
                              onCheckedChange={() => toggleCurriculum(curriculum)}
                            />
                            <span>{curriculum}</span>
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field
                      label={overallScoreLabel}
                      required
                      error={errors["overallScore"]}
                      className="sm:col-span-2"
                    >
                      <Input
                        value={form.overallScore}
                        onChange={(e) => set("overallScore")(e.target.value)}
                        placeholder="IB 43/45"
                      />
                    </Field>
                  </div>
                </Step>

                <Step>
                  <StepHeading
                    step={3}
                    title={isProfessional ? "Subjects taught & credentials" : "Subject scores & teaching profile"}
                    description={isProfessional ? "Show the curricula, subjects and experience you teach." : "List your academic footprint, then highlight the subjects you teach."}
                  />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field
                      label="Subjects and levels you are confident teaching"
                      required
                      error={errors["subjectsConfident"]}
                      className="sm:col-span-2"
                    >
                      <Textarea
                        rows={3}
                        value={form.subjectsConfident}
                        onChange={(e) => set("subjectsConfident")(e.target.value)}
                        placeholder="History HL, Economics HL, Business Management HL, Chemistry SL"
                      />
                    </Field>
                    {examSystem && !isProfessional ? (
                      <Field
                        label={subjectResultLabel}
                        required
                        hint="Add every subject you completed. Specific paper marks are optional and help parents find the right tutor."
                        error={errors["subjectResults"]}
                        className="sm:col-span-2"
                      >
                        <div className="grid gap-3">
                          {subjectScoreRows.map((row, index) => {
                            const grades = getGradesForSelection(examSystem.id, row.subject);
                            return (
                              <div key={index} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_9rem_auto]">
                                <Select value={row.subject} onValueChange={(subject) => updateSubjectScore(index, { subject, grade: "" })}>
                                  <SelectTrigger aria-label={`Subject ${index + 1}`}><SelectValue placeholder="Subject" /></SelectTrigger>
                                  <SelectContent>{examSystem.subjects.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={row.grade} onValueChange={(grade) => updateSubjectScore(index, { grade })} disabled={!row.subject}>
                                  <SelectTrigger aria-label={`Grade ${index + 1}`}><SelectValue placeholder="Grade" /></SelectTrigger>
                                  <SelectContent>{grades.map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}</SelectContent>
                                </Select>
                                {subjectScoreRows.length > 1 ? <Button type="button" variant="outline" onClick={() => setSubjectScoreRows((previous) => previous.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button> : null}
                                <Input className="sm:col-span-3" value={row.details} onChange={(event) => updateSubjectScore(index, { details: event.target.value })} placeholder="Specific paper grades or breakdown (optional)" />
                              </div>
                            );
                          })}
                          <Button type="button" variant="outline" className="w-fit" onClick={() => setSubjectScoreRows((previous) => [...previous, { subject: "", grade: "", details: "" }])}>+ Add another subject</Button>
                        </div>
                      </Field>
                    ) : (
                      <Field label={subjectResultLabel} required error={errors["subjectResults"]} className="sm:col-span-2">
                        <Textarea rows={3} value={form.subjectResults} onChange={(event) => set("subjectResults")(event.target.value)} placeholder="Teaching credentials, examining boards, subjects and years of experience" />
                      </Field>
                    )}
                    <Field
                      label="Awards, scholarships or notable achievements"
                      error={errors["awards"]}
                      className="sm:col-span-2"
                    >
                      <Textarea
                        rows={3}
                        value={form.awards}
                        onChange={(e) => set("awards")(e.target.value)}
                        placeholder="HKU Foundation Entrance Scholarship 2023; HK Economics Olympiad gold"
                      />
                    </Field>
                    <Field
                      label="Teaching / tutoring experience"
                      required
                      error={errors["experience"]}
                      className="sm:col-span-2"
                    >
                      <Textarea
                        rows={4}
                        value={form.experience}
                        onChange={(e) => set("experience")(e.target.value)}
                        placeholder="2 years of 1-on-1 IB tutoring (6 students); 1 year of small-group DSE English"
                      />
                    </Field>
                    <Field label="Normal hourly rate (HKD)" required error={errors["hourlyRate"]}>
                      <Input
                        type="number"
                        min={0}
                        value={form.hourlyRate}
                        onChange={(e) => set("hourlyRate")(e.target.value)}
                        placeholder="450"
                      />
                    </Field>
                    <Field
                      label="Do you have your own teaching materials or resources?"
                      required
                      error={errors["materials"]}
                    >
                      <RadioGroupField
                        name="materials"
                        options={MATERIALS_OPTIONS}
                        value={form.materials}
                        onChange={set("materials")}
                      />
                    </Field>
                    <Field label="Preferred tutoring format" required error={errors["format"]}>
                      <RadioGroupField
                        name="format"
                        options={FORMAT_OPTIONS}
                        value={form.format}
                        onChange={set("format")}
                      />
                    </Field>
                  </div>
                </Step>

                <Step>
                  <StepHeading
                    step={4}
                    title="Availability & consent"
                    description="Finish with your availability, supporting documents and acknowledgements."
                  />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field label="Maximum number of students you can take" error={errors["maxStudents"]}>
                      <Input
                        type="number"
                        min={0}
                        value={form.maxStudents}
                        onChange={(e) => set("maxStudents")(e.target.value)}
                        placeholder="4"
                      />
                    </Field>
                    <Field
                      label="Possible Teaching Locations (MTR Network)"
                      hint="Select all lines and stations you can realistically travel to. Broader coverage creates more matching opportunities."
                      error={errors["locations"]}
                      className="sm:col-span-2"
                    >
                      <div className="grid gap-3">
                        {MTR_LINES.map((line) => {
                          const allSelected = line.stations.every((station) => selectedStations.includes(station));
                          return (
                            <details key={line.id} className="rounded-lg border border-border bg-card px-4 py-3">
                              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-foreground">
                                <span>{line.label}</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                  {line.stations.filter((station) => selectedStations.includes(station)).length}/{line.stations.length}
                                </span>
                              </summary>
                              <div className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-foreground sm:col-span-3">
                                  <Checkbox checked={allSelected} onCheckedChange={() => toggleLine(line)} />
                                  <span>Select all {line.label}</span>
                                </label>
                                {line.stations.map((station) => (
                                  <label key={`${line.id}-${station}`} className="flex items-center gap-2 text-sm text-foreground">
                                    <Checkbox checked={selectedStations.includes(station)} onCheckedChange={() => toggleStation(station)} />
                                    <span>{station}</span>
                                  </label>
                                ))}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="Preferred medium of instruction" required error={errors["medium"]}>
                      <Input
                        value={form.medium}
                        onChange={(e) => set("medium")(e.target.value)}
                        placeholder="English / Cantonese"
                      />
                    </Field>
                    <Field label="Anything else?" error={errors["notes"]} className="sm:col-span-2">
                      <Textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => set("notes")(e.target.value)}
                        placeholder="Available weekday evenings only? ; Can only take students in certain districts? ; Prefer to teach certain subjects?"
                      />
                    </Field>
                    <Field
                      label="Academic transcript / proof of results"
                      required
                      hint={`Up to ${MAX_FILES} files, 10 MB each (PDF, JPG, PNG, DOC or DOCX).`}
                      error={errors["attachments"]}
                      className="sm:col-span-2"
                    >
                      <Input
                        type="file"
                        multiple
                        accept={ACCEPT_ATTRIBUTE}
                        onChange={(e) => handleFiles(e.target.files)}
                      />
                      {files.length > 0 ? (
                        <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          {files.map((file) => (
                            <li key={file.name} className="flex items-center gap-2">
                              <Paperclip className="h-3 w-3" />
                              {file.name} ({Math.round(file.size / 1024)} KB)
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </Field>
                    <div className="grid gap-4 sm:col-span-2">
                      <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                        <Checkbox
                          checked={commissionAck}
                          onCheckedChange={(checked) => setCommissionAck(checked === true)}
                          className="mt-0.5"
                        />
                        <span>{COMMISSION_TEXT}</span>
                      </label>
                      {errors["commissionAck"] ? (
                        <p className="text-xs font-medium text-destructive">Please accept the commission terms.</p>
                      ) : null}
                      <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                        <Checkbox
                          checked={privacyAck}
                          onCheckedChange={(checked) => setPrivacyAck(checked === true)}
                          className="mt-0.5"
                        />
                        <span>{PRIVACY_TEXT}</span>
                      </label>
                      {errors["privacyAck"] ? (
                        <p className="text-xs font-medium text-destructive">Please accept the privacy notice.</p>
                      ) : null}
                    </div>
                    <div ref={captchaContainerRef} className="min-h-[65px] sm:col-span-2" />
                  </div>
                </Step>
              </Stepper>
              {formError ? (
                <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}