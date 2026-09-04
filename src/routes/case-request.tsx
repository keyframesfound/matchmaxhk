import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";

export const Route = createFileRoute("/case-request")({
  head: () => ({
    meta: [
      { title: "Request a Tutor Match for Free | MatchMax" },
      {
        name: "description",
        content:
          "Skip the manual filters — tell us what you need and the MatchMax team will source a verified tutor match for you, completely free.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Request a Tutor Match for Free | MatchMax" },
      {
        property: "og:description",
        content:
          "Tell us your requirements and we'll hand-pick verified tutors for your family — free for parents.",
      },
      { property: "og:url", content: "https://matchmax.hk/case-request" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/case-request" }],
  }),
  component: CaseRequestPage,
});

const LEVEL_OPTIONS = [
  { value: "Primary", label: "Primary" },
  { value: "Junior secondary", label: "Junior secondary (S1–S3)" },
  { value: "Senior secondary", label: "Senior secondary (S4–S6)" },
  { value: "University", label: "University" },
  { value: "Other", label: "Other" },
];

const EXAM_SYSTEM_OPTIONS = [
  { value: "IB", label: "IB" },
  { value: "DSE", label: "DSE" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "AP", label: "AP" },
  { value: "A-Level", label: "A-Level" },
  { value: "Not sure yet", label: "Not sure yet" },
];

const MODE_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "in_person", label: "In-person" },
  { value: "either", label: "Open to discussion" },
];

const FREQUENCY_OPTIONS = [
  { value: "1", label: "1 lesson / week" },
  { value: "2", label: "2 lessons / week" },
  { value: "3", label: "3 lessons / week" },
  { value: "4", label: "4+ lessons / week" },
];

const LENGTH_OPTIONS = [
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
  { value: "90", label: "90 minutes" },
  { value: "120", label: "120 minutes" },
];

const GENDER_OPTIONS = [
  { value: "any", label: "No preference" },
  { value: "female", label: "Female tutor" },
  { value: "male", label: "Male tutor" },
];

const START_OPTIONS = [
  { value: "asap", label: "As soon as possible" },
  { value: "two_weeks", label: "Within 2 weeks" },
  { value: "flexible", label: "Flexible" },
];

const labelClassName =
  "mb-1.5 block text-sm font-bold text-[color:var(--ink)] after:ml-0.5 after:text-[color:var(--brand-teal)]";
const controlClassName = "h-11 w-full rounded-sm";

type FormState = {
  parentName: string;
  contactPhone: string;
  level: string;
  examSystem: string;
  subject1: string;
  subject2: string;
  mode: string;
  district: string;
  frequency: string;
  lengthMinutes: string;
  budgetMin: string;
  budgetMax: string;
  gender: string;
  start: string;
  notes: string;
};

const INITIAL_FORM: FormState = {
  parentName: "",
  contactPhone: "",
  level: "",
  examSystem: "",
  subject1: "",
  subject2: "",
  mode: "",
  district: "",
  frequency: "",
  lengthMinutes: "",
  budgetMin: "",
  budgetMax: "",
  gender: "any",
  start: "",
  notes: "",
};

function CaseRequestPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState("");

  const update = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const subjectOptions = getSubjectOptionsForCategory(form.examSystem);

  const handleExamSystemChange = (value: string) => {
    const nextOptions = getSubjectOptionsForCategory(value);
    update({
      examSystem: value,
      subject1: nextOptions.includes(form.subject1) ? form.subject1 : "",
      subject2: nextOptions.includes(form.subject2) ? form.subject2 : "",
    });
  };

  const buildMessage = (f: FormState) => {
    const lines = [
      "Hi MatchMax! I'd like to request a tutor match (case request).",
      "",
      `• Parent: ${f.parentName.trim()}`,
      `• Contact: ${f.contactPhone.trim()}`,
      `• Student level: ${f.level}`,
      f.examSystem ? `• Curriculum: ${f.examSystem}` : "",
      `• Subjects: ${[f.subject1, f.subject2].filter(Boolean).join(", ")}`,
      `• Lesson mode: ${MODE_OPTIONS.find((m) => m.value === f.mode)?.label ?? f.mode}`,
      f.district ? `• District: ${f.district}` : "",
      f.frequency
        ? `• Frequency: ${FREQUENCY_OPTIONS.find((o) => o.value === f.frequency)?.label ?? f.frequency}`
        : "",
      f.lengthMinutes
        ? `• Lesson length: ${LENGTH_OPTIONS.find((o) => o.value === f.lengthMinutes)?.label ?? f.lengthMinutes}`
        : "",
      f.budgetMin || f.budgetMax
        ? `• Budget: HK$${f.budgetMin || "?"}–HK$${f.budgetMax || "?"}/hr`
        : "",
      `• Tutor gender: ${GENDER_OPTIONS.find((g) => g.value === f.gender)?.label ?? "No preference"}`,
      f.start ? `• Start: ${START_OPTIONS.find((o) => o.value === f.start)?.label ?? f.start}` : "",
      f.notes.trim() ? `• Notes: ${f.notes.trim()}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.parentName.trim()) nextErrors.parentName = "Please enter your name.";
    if (!form.contactPhone.trim()) nextErrors.contactPhone = "Please enter your WhatsApp number.";
    if (!form.level) nextErrors.level = "Please select the student level.";
    if (!form.subject1.trim()) nextErrors.subject1 = "Please tell us at least one subject.";
    if (!form.mode) nextErrors.mode = "Please choose a lesson mode.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fill in the highlighted fields.");
      return;
    }

    const digits = (form.contactPhone ?? "").replace(/[^\d]/g, "");
    const message = buildMessage(form);
    const url = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
      : buildTutorWhatsAppUrl("", "");
    setWhatsappUrl(url);
    setSubmitted(true);
    toast.success("Case request ready — opening WhatsApp.");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <PublicPage>
      <PageIntro
        align="center"
        description="Skip the manual filters — tell us what you need and our team will hand-pick verified tutors for you. Completely free for parents."
        eyebrow="Case request"
        title="Let us source the perfect match"
        width="default"
      />

      <section className="pb-16 pt-10 sm:pb-20">
        <PageContainer width="default">
          {submitted ? (
            <div className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-8 text-center shadow-[var(--shadow-brand)] sm:p-12">
              <CheckCircle2
                className="mx-auto h-12 w-12 text-[color:var(--brand-teal)]"
                aria-hidden="true"
              />
              <h2 className="mt-4 text-3xl font-black text-[color:var(--ink)]">
                Case request ready
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                WhatsApp should have opened with your requirements pre-filled. If it didn&rsquo;t,
                use the button below — our team replies within one business day.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button
                  asChild
                  className="h-11 rounded-sm bg-[#25D366] px-6 font-bold text-white hover:bg-[#1ebe57]"
                >
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> Open WhatsApp
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-sm px-6 font-bold"
                  onClick={() => {
                    setForm(INITIAL_FORM);
                    setSubmitted(false);
                  }}
                >
                  Submit another request
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-5 shadow-[var(--shadow-brand)] sm:p-8"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClassName} htmlFor="cr-name">
                    Your name
                  </label>
                  <Input
                    id="cr-name"
                    className={controlClassName}
                    placeholder="e.g. Mrs. Chan"
                    value={form.parentName}
                    onChange={(e) => update({ parentName: e.target.value })}
                  />
                  {errors.parentName ? (
                    <p className="mt-1 text-xs font-semibold text-destructive">
                      {errors.parentName}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-phone">
                    WhatsApp number
                  </label>
                  <Input
                    id="cr-phone"
                    className={controlClassName}
                    placeholder="e.g. +852 9123 4567"
                    inputMode="tel"
                    value={form.contactPhone}
                    onChange={(e) => update({ contactPhone: e.target.value })}
                  />
                  {errors.contactPhone ? (
                    <p className="mt-1 text-xs font-semibold text-destructive">
                      {errors.contactPhone}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-level">
                    Student level
                  </label>
                  <SearchableSelect
                    value={form.level}
                    onChange={(v) => update({ level: v })}
                    options={LEVEL_OPTIONS}
                    placeholder="Select level"
                    searchPlaceholder="Search level..."
                    className={controlClassName}
                  />
                  {errors.level ? (
                    <p className="mt-1 text-xs font-semibold text-destructive">{errors.level}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-system">
                    Curriculum
                  </label>
                  <SearchableSelect
                    value={form.examSystem}
                    onChange={handleExamSystemChange}
                    options={EXAM_SYSTEM_OPTIONS}
                    placeholder="Optional"
                    searchPlaceholder="Search curriculum..."
                    className={controlClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-subject1">
                    Subject(s) needed
                  </label>
                  <SearchableSelect
                    value={form.subject1}
                    onChange={(v) => update({ subject1: v })}
                    options={subjectOptions}
                    allowCustom
                    placeholder="e.g. Math AA HL"
                    searchPlaceholder="Search subject..."
                    emptyText="No matches — type to enter a custom subject."
                    className={controlClassName}
                  />
                  {errors.subject1 ? (
                    <p className="mt-1 text-xs font-semibold text-destructive">{errors.subject1}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-subject2">
                    Second subject (optional)
                  </label>
                  <SearchableSelect
                    value={form.subject2}
                    onChange={(v) => update({ subject2: v })}
                    options={subjectOptions}
                    allowCustom
                    placeholder="e.g. Chemistry"
                    searchPlaceholder="Search subject..."
                    emptyText="No matches — type to enter a custom subject."
                    className={controlClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-mode">
                    Lesson mode
                  </label>
                  <SearchableSelect
                    value={form.mode}
                    onChange={(v) => update({ mode: v })}
                    options={MODE_OPTIONS}
                    placeholder="Select mode"
                    searchPlaceholder="Search mode..."
                    className={controlClassName}
                  />
                  {errors.mode ? (
                    <p className="mt-1 text-xs font-semibold text-destructive">{errors.mode}</p>
                  ) : null}
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-district">
                    District
                  </label>
                  <SearchableSelect
                    value={form.district}
                    onChange={(v) => update({ district: v })}
                    options={["", ...HK_DISTRICTS].map((d) => ({
                      value: d,
                      label: d || "Any / open to discussion",
                    }))}
                    placeholder="Optional"
                    searchPlaceholder="Search district..."
                    className={controlClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-frequency">
                    Lessons per week
                  </label>
                  <SearchableSelect
                    value={form.frequency}
                    onChange={(v) => update({ frequency: v })}
                    options={FREQUENCY_OPTIONS}
                    placeholder="Optional"
                    searchPlaceholder="Search frequency..."
                    className={controlClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-length">
                    Lesson length
                  </label>
                  <SearchableSelect
                    value={form.lengthMinutes}
                    onChange={(v) => update({ lengthMinutes: v })}
                    options={LENGTH_OPTIONS}
                    placeholder="Optional"
                    searchPlaceholder="Search length..."
                    className={controlClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-budget-min">
                    Budget per hour (HK$)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="cr-budget-min"
                      className={controlClassName}
                      placeholder="Min"
                      inputMode="numeric"
                      value={form.budgetMin}
                      onChange={(e) => update({ budgetMin: e.target.value.replace(/[^\d]/g, "") })}
                    />
                    <span className="text-sm font-bold text-muted-foreground">–</span>
                    <Input
                      aria-label="Maximum budget per hour"
                      className={controlClassName}
                      placeholder="Max"
                      inputMode="numeric"
                      value={form.budgetMax}
                      onChange={(e) => update({ budgetMax: e.target.value.replace(/[^\d]/g, "") })}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClassName} htmlFor="cr-gender">
                    Tutor gender preference
                  </label>
                  <SearchableSelect
                    value={form.gender}
                    onChange={(v) => update({ gender: v || "any" })}
                    options={GENDER_OPTIONS}
                    placeholder="No preference"
                    searchPlaceholder="Search preference..."
                    className={controlClassName}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClassName} htmlFor="cr-start">
                    When do you want to start?
                  </label>
                  <SearchableSelect
                    value={form.start}
                    onChange={(v) => update({ start: v })}
                    options={START_OPTIONS}
                    placeholder="Optional"
                    searchPlaceholder="Search timing..."
                    className={controlClassName}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClassName} htmlFor="cr-notes">
                    Anything else we should know?
                  </label>
                  <Textarea
                    id="cr-notes"
                    rows={4}
                    className="w-full rounded-sm"
                    placeholder="Target grades, school, availability, trial lesson preference…"
                    value={form.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-6">
                <Button
                  type="submit"
                  className="h-12 w-full rounded-sm bg-[color:var(--surface-invert)] px-8 text-base font-bold text-white hover:bg-[color:var(--surface-invert-hover)] sm:w-auto"
                >
                  <MessageCircle className="mr-2 h-5 w-5" /> Send case request via WhatsApp
                </Button>
                <p className="text-center text-xs text-muted-foreground sm:text-sm">
                  Free for parents — you&rsquo;ll receive matched tutor profiles within one business
                  day.
                </p>
              </div>
            </form>
          )}
        </PageContainer>
      </section>
    </PublicPage>
  );
}
