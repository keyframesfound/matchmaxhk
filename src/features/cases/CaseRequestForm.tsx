import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { submitCaseRequest } from "@/lib/cases.functions";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { EXAM_SYSTEM_OPTIONS, LEVEL_OPTIONS } from "@/features/cases/case-options";

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

type CaseRequestFormProps = {
  idPrefix?: string;
  onSubmitted?: (result: { caseCode: string; duplicate: boolean }) => void;
};

export function CaseRequestForm({ idPrefix = "cr", onSubmitted }: CaseRequestFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<{ caseCode: string; duplicate: boolean } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());

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

  const submitMutation = useMutation({
    mutationFn: async () => {
      const subjects = [form.subject1, form.subject2]
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      return submitCaseRequest({
        data: {
          parentName: form.parentName,
          contactPhone: form.contactPhone,
          level: form.level,
          examSystem: form.examSystem || null,
          subjects,
          mode: form.mode as "online" | "in_person" | "either",
          district: form.district || null,
          sessionsPerWeek: form.frequency ? Number(form.frequency) : null,
          sessionLengthMinutes: form.lengthMinutes ? Number(form.lengthMinutes) : null,
          budgetMin: form.budgetMin ? Number(form.budgetMin) : null,
          budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
          preferredGender: (form.gender || "any") as "any" | "male" | "female",
          startTiming: (form.start || null) as "asap" | "two_weeks" | "flexible" | null,
          notes: form.notes.trim() || null,
          website: honeypot.current?.value || null,
          elapsedMs: Date.now() - startedAt.current,
        },
      });
    },
    onSuccess: (data) => {
      setResult(data);
      onSubmitted?.(data);
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
    submitMutation.mutate();
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setResult(null);
    startedAt.current = Date.now();
  };

  if (result) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-8 text-center shadow-[var(--shadow-brand)] sm:p-12">
        <CheckCircle2
          className="mx-auto h-12 w-12 text-[color:var(--brand-teal)]"
          aria-hidden="true"
        />
        <h2 className="mt-4 text-3xl font-black text-[color:var(--ink)]">Case request received</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          {result.duplicate
            ? "We already received a request from this number. Your reference:"
            : "Keep this reference for your records. Our team replies within one business day."}
        </p>
        <p className="mt-4 font-mono text-2xl font-black tracking-tight text-[color:var(--ink)]">
          {result.caseCode}
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

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-5 shadow-[var(--shadow-brand)] sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor={`${idPrefix}-name`}>
            Your name
          </label>
          <Input
            id={`${idPrefix}-name`}
            className={controlClassName}
            placeholder="e.g. Mrs. Chan"
            value={form.parentName}
            onChange={(e) => update({ parentName: e.target.value })}
          />
          {errors.parentName ? (
            <p className="mt-1 text-xs font-semibold text-destructive">{errors.parentName}</p>
          ) : null}
        </div>
        <div>
          <label className={labelClassName} htmlFor={`${idPrefix}-phone`}>
            WhatsApp number
          </label>
          <Input
            id={`${idPrefix}-phone`}
            className={controlClassName}
            placeholder="e.g. +852 9123 4567"
            inputMode="tel"
            value={form.contactPhone}
            onChange={(e) => update({ contactPhone: e.target.value })}
          />
          {errors.contactPhone ? (
            <p className="mt-1 text-xs font-semibold text-destructive">{errors.contactPhone}</p>
          ) : null}
        </div>
        <div>
          <label className={labelClassName} htmlFor={`${idPrefix}-level`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-system`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-subject1`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-subject2`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-mode`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-district`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-frequency`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-length`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-budget-min`}>
            Budget per hour (HK$)
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={`${idPrefix}-budget-min`}
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
          <label className={labelClassName} htmlFor={`${idPrefix}-gender`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-start`}>
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
          <label className={labelClassName} htmlFor={`${idPrefix}-notes`}>
            Anything else we should know?
          </label>
          <Textarea
            id={`${idPrefix}-notes`}
            rows={4}
            className="w-full rounded-sm"
            placeholder="Target grades, school, availability, trial lesson preference…"
            value={form.notes}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </div>
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

      <div className="mt-6 flex flex-col items-center gap-3 border-t border-border pt-6">
        <Button
          type="submit"
          disabled={submitMutation.isPending}
          className="h-12 w-full rounded-sm bg-[color:var(--surface-invert)] px-8 text-base font-bold text-white hover:bg-[color:var(--surface-invert-hover)] sm:w-auto"
        >
          {submitMutation.isPending ? (
            "Submitting…"
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" /> Submit case request
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground sm:text-sm">
          Free for parents, our team replies within one business day.
        </p>
      </div>
    </form>
  );
}
