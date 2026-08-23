import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Paperclip } from "lucide-react";

import { cn } from "@/lib/utils";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  curriculumOther: string;
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
  curriculumOther: "",
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
                ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
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

function MobileScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      <div
        className="fixed left-0 right-0 top-[64px] z-50 h-[3px] w-full bg-border/60 lg:hidden"
        role="progressbar"
        aria-label="Page scroll progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className="h-full bg-gradient-to-r from-[color:var(--brand-teal)] to-[color:var(--brand-navy)] transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="h-[3px] lg:hidden" aria-hidden="true" />
    </>
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

  const set = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

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
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[color:var(--brand-teal)]" />
            <h1 className="mt-4 text-2xl font-black tracking-tight text-[color:var(--brand-navy)]">
              {t("join.success_title")}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t("join.success_message")}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                asChild
                className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
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
      <SiteHeader />
      <MobileScrollProgress />
      <main className="flex-1">
        <section className="pt-8 sm:pt-12">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h1 className="text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl lg:text-5xl">
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

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
              <form onSubmit={handleSubmit} className="grid gap-8">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

                <hr className="border-border" />

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                      onChange={set("curriculum")}
                    />
                    {form.curriculum === "Other" ? (
                      <Input
                        className="mt-2"
                        value={form.curriculumOther}
                        onChange={(e) => set("curriculumOther")(e.target.value)}
                        placeholder="HKDSE / GCSE / IGCSE"
                      />
                    ) : null}
                  </Field>
                  <Field
                    label="Overall achieved score in your high school qualification"
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

                <hr className="border-border" />

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  <Field
                    label="Relevant subject results / academic strengths"
                    required
                    error={errors["subjectResults"]}
                    className="sm:col-span-2"
                  >
                    <Textarea
                      rows={3}
                      value={form.subjectResults}
                      onChange={(e) => set("subjectResults")(e.target.value)}
                      placeholder="History HL 7, Economics HL 7, EE in History grade A"
                    />
                  </Field>
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
                    className="sm:col-span-2 lg:col-span-3"
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
                  <Field label="Maximum number of students you can take" error={errors["maxStudents"]}>
                    <Input
                      type="number"
                      min={0}
                      value={form.maxStudents}
                      onChange={(e) => set("maxStudents")(e.target.value)}
                      placeholder="4"
                    />
                  </Field>
                  <Field label="Preferred teaching location(s) if in-person" error={errors["locations"]}>
                    <Input
                      value={form.locations}
                      onChange={(e) => set("locations")(e.target.value)}
                      placeholder="Causeway Bay, Wan Chai, Kowloon Tong"
                    />
                  </Field>
                  <Field label="Preferred medium of instruction" required error={errors["medium"]}>
                    <Input
                      value={form.medium}
                      onChange={(e) => set("medium")(e.target.value)}
                      placeholder="English / Cantonese"
                    />
                  </Field>
                  <Field
                    label="Anything else?"
                    error={errors["notes"]}
                    className="sm:col-span-2 lg:col-span-3"
                  >
                    <Textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => set("notes")(e.target.value)}
                      placeholder="Available weekday evenings only? ; Can only take students in certain districts? ; Prefer to teach certain subjects?"
                    />
                  </Field>
                </div>

                <hr className="border-border" />

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field
                    label="Academic transcript / proof of results"
                    required
                    hint={`Up to ${MAX_FILES} files, 10 MB each (PDF, JPG, PNG, DOC or DOCX).`}
                    error={errors["attachments"]}
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

                  <div className="grid gap-4">
                    <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                      <Checkbox
                        checked={commissionAck}
                        onCheckedChange={(checked) => setCommissionAck(checked === true)}
                        className="mt-0.5"
                      />
                      <span>{COMMISSION_TEXT}</span>
                    </label>
                    {errors["commissionAck"] ? (
                      <p className="text-xs font-medium text-destructive">
                        Please accept the commission terms.
                      </p>
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
                      <p className="text-xs font-medium text-destructive">
                        Please accept the privacy notice.
                      </p>
                    ) : null}
                  </div>
                </div>

                {formError ? (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                    {formError}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Submit application"
                  )}
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
