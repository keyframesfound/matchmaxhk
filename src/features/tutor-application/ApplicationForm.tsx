import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Paperclip, Plus, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Stepper, { Step, type StepperIndicatorRenderArgs } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import { submitTutorApplication } from "@/lib/tutor-application.functions";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_FILE_TYPES,
  COMMISSION_TEXT,
  CURRICULUM_OPTIONS,
  EXAMINING_BOARD_OPTIONS,
  FORMAT_OPTIONS,
  MATERIALS_OPTIONS,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  PROFESSIONAL_ROLE_OPTIONS,
  PRIVACY_TEXT,
  STATUS_OPTIONS,
  TEACHING_QUALIFICATION_OPTIONS,
  tutorApplicationSchema,
} from "@/lib/tutor-application.schema";
import { MTR_LINES, toggleLineStations } from "./mtr";
import { getGradesForSelection, getSystem } from "@/features/tutors/examSystems";

type ScoreRow = {
  subject: string;
  grade: string;
  detail: string;
  level: string;
  gradeSystem: string;
};
type Qualification = {
  curriculum: string;
  overall: string;
  boards: string[];
  scores: ScoreRow[];
  best6: string;
};

const PROFESSIONAL_STATUSES = new Set([
  "Current school teacher",
  "Former school teacher",
  "Official examiner / moderator",
]);
const SYSTEM_IDS: Record<string, string> = {
  IBDP: "ib",
  "A-Level": "alevel",
  "IGCSE / GCSE": "igcse",
  HKDSE: "dse",
  AP: "ap",
};
const LANGUAGES = ["English", "Cantonese", "Mandarin"];
const ACADEMIC_STEPS = [
  "Basic Details",
  "Academic Background",
  "Subjects Taught",
  "Lesson Preferences & Locations",
  "Achievements and Experiences",
  "Logistics & Rate",
  "Acknowledgments",
];
const PROFESSIONAL_STEPS = [
  "Basic Details & Professional Status",
  "Higher Education & Teaching Credentials",
  "Subjects Taught",
  "Lesson Preferences & Locations",
  "Achievements and Experiences",
  "Logistics & Rate",
  "Acknowledgments",
];
const IB_BLOCKS = [
  ["Group 1: Studies in Language and Literature", ["Eng A", "Chin A"]],
  [
    "Group 2: Language Acquisition",
    ["Eng B", "Chin B", "French B", "Spanish B", "German B", "Japanese B"],
  ],
  [
    "Group 3: Individuals and Societies",
    ["Business", "Econ", "Geog", "Global", "Hist", "Phil", "Psych", "ESS"],
  ],
  ["Group 4: Sciences", ["Bio", "Chem", "CompSci", "Design", "Phys", "SEHS"]],
  ["Group 5: Mathematics", ["Math"]],
  ["Group 6: The Arts / Elective", ["Visual", "Music", "Theatre", "Film", "Dance"]],
  ["Theory of Knowledge (TOK)", ["Theory of Knowledge"]],
  ["Extended Essay (EE)", ["Extended Essay"]],
] as const;

function blankQualification(curriculum = "IBDP"): Qualification {
  const scores =
    curriculum === "IBDP"
      ? IB_BLOCKS.map(() => ({ subject: "", grade: "", detail: "", level: "", gradeSystem: "" }))
      : [{ subject: "", grade: "", detail: "", level: "", gradeSystem: "" }];
  return { curriculum, overall: "", boards: [], scores, best6: "" };
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic leading-relaxed text-muted-foreground">{children}</p>;
}

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label className="font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <Hint>{hint}</Hint> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function Choices({
  options,
  values,
  onToggle,
}: {
  options: readonly string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-3">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={values.includes(option)} onCheckedChange={() => onToggle(option)} />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function SingleChoice({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-semibold",
            value === option
              ? "border-[color:var(--ink)] bg-[color:var(--surface-invert)] text-white"
              : "border-border bg-card text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function updateArray(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function ApplicationForm() {
  const submit = useServerFn(submitTutorApplication);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaWidget = useRef<string | null>(null);
  const [base, setBase] = useState({
    name: "",
    phone: "+852 ",
    email: "",
    status: "",
    statusOther: "",
    medium: [] as string[],
    highSchool: "",
    university: "",
    programme: "",
    year: "",
    subjectsTaught: [] as string[],
    manualSubjects: "",
    format: "",
    stations: [] as string[],
    experiences: [""] as string[],
    hourlyRate: "",
    materials: "",
    certificatesLater: false,
    commission: false,
    privacy: false,
  });
  const [roles, setRoles] = useState<string[]>([]);
  const [boards, setBoards] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<string[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([blankQualification()]);
  const professional = PROFESSIONAL_STATUSES.has(base.status);
  const stepTitles = professional ? PROFESSIONAL_STEPS : ACADEMIC_STEPS;
  const primary = qualifications[0];
  const allResultSubjects = useMemo(
    () =>
      qualifications.flatMap((qualification) =>
        qualification.scores.map((score) => score.subject).filter(Boolean),
      ),
    [qualifications],
  );
  const notice = professional
    ? "Please note: MatchMax's Professional tier is reserved for highly qualified educators. Teaching credentials or official examiner letters are required for verification, and your identity, CV, and current employment are kept strictly confidential."
    : primary.curriculum === "IBDP"
      ? "Please note: MatchMax employs a rigorous screening process. For IBDP, we currently only accept candidates with an overall achieved score of 40 or above."
      : primary.curriculum === "A-Level"
        ? "Please note: For A-Level, we generally accept candidates with a minimum overall achievement of A*AA or equivalent."
        : primary.curriculum === "IGCSE / GCSE"
          ? "Please note: For IGCSE / GCSE, we seek a strong track record of A*/A or 7-9 grades, particularly in subjects you wish to teach."
          : primary.curriculum === "HKDSE"
            ? "Please note: For HKDSE, we only accept candidates with a minimum Best 5 score of 30."
            : "Please note: MatchMax employs a rigorous screening process to maintain our premium standards.";

  useEffect(() => {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITEKEY || "0x4AAAAAAEiLema3uiveM5pp";
    if (step !== stepTitles.length || !captchaRef.current || captchaWidget.current) return;
    const renderCaptcha = () => {
      if (!window.turnstile || !captchaRef.current || captchaWidget.current) return;
      captchaWidget.current = window.turnstile.render(captchaRef.current, {
        sitekey: siteKey,
        action: "tutor_application",
        callback: setCaptcha,
        "expired-callback": () => setCaptcha(null),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]',
    );
    if (existing) {
      existing.addEventListener("load", renderCaptcha);
      renderCaptcha();
      return () => existing.removeEventListener("load", renderCaptcha);
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.addEventListener("load", renderCaptcha);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", renderCaptcha);
  }, [step, stepTitles.length]);

  function setBaseField<Key extends keyof typeof base>(key: Key, value: (typeof base)[Key]) {
    setBase((previous) => ({ ...previous, [key]: value }));
  }
  function updateQualification(index: number, patch: Partial<Qualification>) {
    setQualifications((previous) =>
      previous.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }
  function updateScore(qualificationIndex: number, scoreIndex: number, patch: Partial<ScoreRow>) {
    setQualifications((previous) =>
      previous.map((qualification, index) =>
        index === qualificationIndex
          ? {
              ...qualification,
              scores: qualification.scores.map((score, scoreRowIndex) =>
                scoreRowIndex === scoreIndex ? { ...score, ...patch } : score,
              ),
            }
          : qualification,
      ),
    );
  }

  function validateCurrentStep() {
    const next: Record<string, string> = {};
    const required = (key: string, value: string | string[] | boolean) => {
      if (!value || (Array.isArray(value) && value.length === 0)) next[key] = "Required";
    };
    if (step === 1) {
      required("name", base.name.trim());
      required("phone", base.phone.replace("+852", "").trim());
      required("email", base.email.trim());
      required("status", base.status);
      required("medium", base.medium);
      if (base.status === "Other") required("statusOther", base.statusOther.trim());
      if (professional) {
        required("roles", roles);
        if (roles.includes("Official examiner / moderator")) required("boards", boards);
      }
    }
    if (step === 2) {
      if (professional) required("credentials", credentials);
      else {
        required("highSchool", base.highSchool.trim());
        qualifications.forEach((qualification, index) => {
          required(`curriculum-${index}`, qualification.curriculum);
          required(`overall-${index}`, qualification.overall.trim());
          if (["A-Level", "IGCSE / GCSE"].includes(qualification.curriculum))
            required(`boards-${index}`, qualification.boards);
        });
      }
    }
    const subjectStep = professional ? 3 : 2;
    if (step === subjectStep) {
      if (professional)
        required(
          "subjectsTaught",
          base.subjectsTaught.length ? base.subjectsTaught : base.manualSubjects.trim(),
        );
      else
        qualifications.forEach((qualification, qualificationIndex) =>
          qualification.scores.forEach((score, scoreIndex) => {
            required(`subject-${qualificationIndex}-${scoreIndex}`, score.subject);
            required(`grade-${qualificationIndex}-${scoreIndex}`, score.grade);
          }),
        );
    }
    const taughtStep = professional ? 3 : 3;
    if (step === taughtStep)
      required(
        "subjectsTaught",
        base.subjectsTaught.length ? base.subjectsTaught : base.manualSubjects.trim(),
      );
    const lessonStep = professional ? 4 : 4;
    if (step === lessonStep) {
      required("format", base.format);
      if (base.format !== "Online") required("stations", base.stations);
    }
    const experienceStep = professional ? 5 : 5;
    if (step === experienceStep) required("experiences", base.experiences.filter(Boolean));
    const logisticsStep = professional ? 6 : 6;
    if (step === logisticsStep) {
      required("hourlyRate", base.hourlyRate.trim());
      required("materials", base.materials);
    }
    if (step === stepTitles.length) {
      required("files", files);
      required("commission", base.commission);
      required("privacy", base.privacy);
      if (!captcha) next.captcha = "Complete the security check.";
    }
    setFieldErrors(next);
    setError(
      Object.keys(next).length ? "Complete the highlighted fields before continuing." : null,
    );
    return Object.keys(next).length === 0;
  }

  async function fileData(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  async function submitForm() {
    if (!validateCurrentStep()) return;
    setSubmitting(true);
    setError(null);
    try {
      const subjectResults = qualifications
        .map(
          (qualification) =>
            `${qualification.curriculum}${qualification.overall ? ` (${qualification.overall})` : ""}\n${qualification.scores.map((score) => `${score.subject}: ${score.grade}${score.detail ? ` - ${score.detail}` : ""}`).join("\n")}`,
        )
        .join("\n\n");
      const parsed = tutorApplicationSchema.safeParse({
        turnstileToken: captcha,
        name: base.name,
        phone: base.phone,
        email: base.email,
        startDate: "",
        status: base.status,
        statusOther: base.statusOther,
        professionalRoles: roles,
        examiningBoards: boards,
        teachingQualifications: credentials,
        university: base.university,
        programme: base.programme,
        highSchool: professional ? base.highSchool || "Not provided" : base.highSchool,
        curriculum: primary.curriculum,
        curricula: qualifications.map((qualification) => qualification.curriculum),
        overallScore: primary.overall || "Professional pathway",
        subjectsConfident: [...base.subjectsTaught, base.manualSubjects].filter(Boolean).join(", "),
        subjectResults: professional
          ? `Professional subjects: ${[...base.subjectsTaught, base.manualSubjects].filter(Boolean).join(", ")}\n${base.experiences.filter(Boolean).join("\n")}`
          : subjectResults,
        awards: "",
        experience: base.experiences.filter(Boolean).join("\n"),
        hourlyRate: base.hourlyRate,
        materials: base.materials,
        format: base.format,
        maxStudents: "",
        locations: base.stations.join(", "),
        medium: base.medium.join(", "),
        notes: "",
        certificatesLater: base.certificatesLater,
        commissionAck: base.commission,
        privacyAck: base.privacy,
        attachments: await Promise.all(
          files.map(async (file) => ({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            content: await fileData(file),
          })),
        ),
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Please check your application.");
        return;
      }
      await submit({ data: parsed.data });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderIndicator({
    step: indicatorStep,
    currentStep,
    onStepClick,
  }: StepperIndicatorRenderArgs) {
    const complete = currentStep > indicatorStep;
    return (
      <button
        type="button"
        className="join-stepper-indicator"
        aria-current={currentStep === indicatorStep ? "step" : undefined}
        onClick={() => {
          if (indicatorStep <= currentStep) onStepClick(indicatorStep);
        }}
      >
        <span
          className={cn(
            "join-stepper-circle",
            currentStep === indicatorStep && "join-stepper-circle--active",
            complete && "join-stepper-circle--complete",
          )}
        >
          {complete ? "✓" : indicatorStep}
        </span>
        <span className="join-stepper-label">{stepTitles[indicatorStep - 1]}</span>
      </button>
    );
  }

  if (done)
    return (
      <div className="py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[color:var(--brand-teal)]" />
        <h1 className="mt-4 text-3xl font-black text-[color:var(--ink)]">Application received</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Your application has been received{professional ? " securely" : ""}! Parents can directly
          request you through the MatchMax WhatsApp hotline. Keep an eye on your messages.
        </p>
      </div>
    );

  const scoreEditor = (qualification: Qualification, qualificationIndex: number) => {
    const system = getSystem(SYSTEM_IDS[qualification.curriculum] ?? "other");
    return (
      <div key={qualificationIndex} className="grid gap-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold text-foreground">{qualification.curriculum} subject scores</p>
          {qualifications.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                setQualifications((previous) =>
                  previous.filter((_, index) => index !== qualificationIndex),
                )
              }
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
        {qualification.scores.map((score, scoreIndex) => {
          const gradeOptions =
            qualification.curriculum === "IBDP" && scoreIndex >= 6
              ? ["A", "B", "C", "D", "E"]
              : qualification.curriculum === "IGCSE / GCSE" && score.gradeSystem === "A*-G"
                ? ["A*", "A", "B", "C", "D", "E", "F", "G", "U"]
                : qualification.curriculum === "IGCSE / GCSE" && score.gradeSystem === "9-1"
                  ? ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"]
                  : getGradesForSelection(system?.id ?? "other", score.subject);
          const ibBlock = qualification.curriculum === "IBDP" ? IB_BLOCKS[scoreIndex] : null;
          const availableSubjects = ibBlock
            ? scoreIndex < 6
              ? (system?.subjects.filter((subject) =>
                  ibBlock[1].some((prefix) => subject.startsWith(prefix)),
                ) ?? [])
              : ibBlock[1]
            : system?.subjects;
          return (
            <div
              key={scoreIndex}
              className="grid gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-2"
            >
              {ibBlock ? (
                <p className="sm:col-span-2 text-sm font-semibold text-foreground">{ibBlock[0]}</p>
              ) : null}
              <Input
                value={score.subject}
                list={`subjects-${qualificationIndex}-${scoreIndex}`}
                onChange={(event) =>
                  updateScore(qualificationIndex, scoreIndex, { subject: event.target.value })
                }
                placeholder="Subject name"
              />
              <datalist id={`subjects-${qualificationIndex}-${scoreIndex}`}>
                {availableSubjects?.map((subject) => (
                  <option key={subject} value={subject} />
                ))}
              </datalist>
              {qualification.curriculum === "A-Level" ? (
                <SingleChoice
                  options={["A-Level", "AS-Level"]}
                  value={score.level}
                  onChange={(level) => updateScore(qualificationIndex, scoreIndex, { level })}
                />
              ) : qualification.curriculum === "IGCSE / GCSE" ? (
                <SingleChoice
                  options={["A*-G", "9-1"]}
                  value={score.gradeSystem}
                  onChange={(gradeSystem) =>
                    updateScore(qualificationIndex, scoreIndex, { gradeSystem, grade: "" })
                  }
                />
              ) : null}
              <Input
                value={score.grade}
                list={`grades-${qualificationIndex}-${scoreIndex}`}
                onChange={(event) =>
                  updateScore(qualificationIndex, scoreIndex, { grade: event.target.value })
                }
                placeholder="Overall grade"
              />
              <datalist id={`grades-${qualificationIndex}-${scoreIndex}`}>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade} />
                ))}
              </datalist>
              <Input
                className="sm:col-span-2"
                value={score.detail}
                onChange={(event) =>
                  updateScore(qualificationIndex, scoreIndex, { detail: event.target.value })
                }
                placeholder="Specific paper grades / breakdown (optional)"
              />
              {qualification.scores.length > 1 && !ibBlock ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    updateQualification(qualificationIndex, {
                      scores: qualification.scores.filter((_, index) => index !== scoreIndex),
                    })
                  }
                >
                  Remove subject
                </Button>
              ) : null}
            </div>
          );
        })}
        {qualification.curriculum !== "IBDP" ? (
          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() =>
              updateQualification(qualificationIndex, {
                scores: [
                  ...qualification.scores,
                  { subject: "", grade: "", detail: "", level: "", gradeSystem: "" },
                ],
              })
            }
          >
            <Plus /> Add another subject
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submitForm();
      }}
      className="join-stepper-form"
    >
      <aside className="mb-8 rounded-lg border border-[color:var(--brand-teal)]/30 bg-[color:var(--brand-teal)]/8 px-4 py-3 text-sm leading-relaxed text-foreground">
        {notice}
      </aside>
      <Stepper
        currentStep={step}
        onStepChange={setStep}
        onBeforeStepChange={() => validateCurrentStep()}
        onFinalStepCompleted={() => void submitForm()}
        renderStepIndicator={renderIndicator}
        nextButtonText="Continue"
        backButtonText="Previous"
        completeButtonText="Submit application"
        nextButtonProps={{ disabled: submitting }}
      >
        <Step>
          <Heading
            step={1}
            title={professional ? "Basic Details & Professional Status" : "Basic Details"}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Full Name" required error={fieldErrors.name}>
              <Input
                value={base.name}
                onChange={(event) => setBaseField("name", event.target.value)}
              />
            </Field>
            <Field
              label="Phone / WhatsApp Number"
              required
              hint="Used strictly for internal verification and instant case alerts when parents request a match."
              error={fieldErrors.phone}
            >
              <Input
                value={base.phone}
                onChange={(event) => setBaseField("phone", event.target.value)}
              />
            </Field>
            <Field label="Email" required error={fieldErrors.email}>
              <Input
                type="email"
                value={base.email}
                onChange={(event) => setBaseField("email", event.target.value)}
              />
            </Field>
            <Field label="Medium of Instruction" required error={fieldErrors.medium}>
              <Choices
                options={LANGUAGES}
                values={base.medium}
                onToggle={(language) => setBaseField("medium", updateArray(base.medium, language))}
              />
            </Field>
            <Field label="Current Status" required error={fieldErrors.status}>
              <SingleChoice
                options={STATUS_OPTIONS}
                value={base.status}
                onChange={(status) => {
                  setBaseField("status", status);
                  setRoles(PROFESSIONAL_STATUSES.has(status) ? [status] : []);
                }}
              />
              {base.status === "Other" ? (
                <Input
                  className="mt-2"
                  value={base.statusOther}
                  onChange={(event) => setBaseField("statusOther", event.target.value)}
                  placeholder="Please specify"
                />
              ) : null}
            </Field>
            {professional ? (
              <Field label="Professional Status" required error={fieldErrors.roles}>
                <Choices
                  options={PROFESSIONAL_ROLE_OPTIONS}
                  values={roles}
                  onToggle={(role) => setRoles(updateArray(roles, role))}
                />
                {roles.includes("Official examiner / moderator") ? (
                  <div className="mt-4">
                    <Label>Examining Board(s)</Label>
                    <div className="mt-2">
                      <Choices
                        options={EXAMINING_BOARD_OPTIONS}
                        values={boards}
                        onToggle={(board) => setBoards(updateArray(boards, board))}
                      />
                    </div>
                    {fieldErrors.boards ? (
                      <p className="mt-2 text-xs text-destructive">{fieldErrors.boards}</p>
                    ) : null}
                  </div>
                ) : null}
              </Field>
            ) : null}
          </div>
        </Step>
        <Step>
          <Heading
            step={2}
            title={professional ? "Higher Education & Teaching Credentials" : "Academic Background"}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            {professional ? (
              <Field label="Teaching Qualifications" required error={fieldErrors.credentials}>
                <Choices
                  options={TEACHING_QUALIFICATION_OPTIONS}
                  values={credentials}
                  onToggle={(credential) => setCredentials(updateArray(credentials, credential))}
                />
              </Field>
            ) : (
              <>
                <Field label="Secondary School Attended" required error={fieldErrors.highSchool}>
                  <Input
                    value={base.highSchool}
                    onChange={(event) => setBaseField("highSchool", event.target.value)}
                  />
                </Field>
                <Field label="Current Year of Study">
                  <Input
                    value={base.year}
                    onChange={(event) => setBaseField("year", event.target.value)}
                    placeholder="Year 1, Year 2, Graduate"
                  />
                </Field>
              </>
            )}
            <Field label="University / Institution">
              <Input
                value={base.university}
                onChange={(event) => setBaseField("university", event.target.value)}
              />
            </Field>
            <Field label="Degree / Programme Major">
              <Input
                value={base.programme}
                onChange={(event) => setBaseField("programme", event.target.value)}
              />
            </Field>
            {!professional ? (
              <div className="sm:col-span-2">
                <Hint>
                  Parents and students actively seek alumni from their own secondary schools, or
                  mentors from their dream universities and majors. Accurate details increase your
                  chances of securing a premium case.
                </Hint>
                {qualifications.map((qualification, index) => (
                  <div key={index} className="mt-4 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <Label>
                        {index === 0 ? "Primary Curriculum" : "Additional Qualification"}
                      </Label>
                      {index > 0 ? (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setQualifications((previous) =>
                              previous.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <SingleChoice
                        options={CURRICULUM_OPTIONS}
                        value={qualification.curriculum}
                        onChange={(curriculum) =>
                          updateQualification(index, {
                            curriculum,
                            overall: "",
                            boards: [],
                            scores: [
                              { subject: "", grade: "", detail: "", level: "", gradeSystem: "" },
                            ],
                          })
                        }
                      />
                      <Field
                        label={
                          qualification.curriculum === "HKDSE"
                            ? "Best 5 Score"
                            : qualification.curriculum === "IBDP"
                              ? "Overall Achieved Score"
                              : "Overall Achieved Grades"
                        }
                        required
                        error={fieldErrors[`overall-${index}`]}
                      >
                        <Input
                          type={
                            qualification.curriculum === "IBDP" ||
                            qualification.curriculum === "HKDSE"
                              ? "number"
                              : "text"
                          }
                          value={qualification.overall}
                          onChange={(event) =>
                            updateQualification(index, { overall: event.target.value })
                          }
                        />
                      </Field>
                      {["A-Level", "IGCSE / GCSE"].includes(qualification.curriculum) ? (
                        <Field
                          label="Exam Board(s)"
                          required
                          error={fieldErrors[`boards-${index}`]}
                        >
                          <Choices
                            options={[
                              "Cambridge CAIE",
                              "Pearson Edexcel",
                              "AQA",
                              "OxfordAQA",
                              "OCR",
                            ]}
                            values={qualification.boards}
                            onToggle={(board) =>
                              updateQualification(index, {
                                boards: updateArray(qualification.boards, board),
                              })
                            }
                          />
                        </Field>
                      ) : null}
                      {qualification.curriculum === "HKDSE" ? (
                        <Field label="Best 6 Score">
                          <Input
                            type="number"
                            value={qualification.best6}
                            onChange={(event) =>
                              updateQualification(index, { best6: event.target.value })
                            }
                          />
                        </Field>
                      ) : null}
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() =>
                    setQualifications((previous) => [
                      ...previous,
                      blankQualification("IGCSE / GCSE"),
                    ])
                  }
                >
                  <Plus /> Add another qualification
                </Button>
                <Hint>
                  Did you also complete IGCSE, MYP, or another prior curriculum? Adding them opens
                  you to a wider pool of potential cases.
                </Hint>
              </div>
            ) : null}
          </div>
        </Step>
        {!professional ? (
          <Step>
            <Heading step={3} title="Subject Scores" />
            <Hint>
              Even if you do not plan to teach every subject, listing your full academic profile
              makes your teaches profile more impressive. Specific paper grades highlight niche
              strengths.
            </Hint>
            <div className="mt-5 grid gap-5">{qualifications.map(scoreEditor)}</div>
          </Step>
        ) : null}
        <Step>
          <Heading step={professional ? 3 : 4} title="Subjects Taught" />
          <Field
            label="Subjects Willing to Teach"
            required
            hint="Select subjects from your academic profile that you are confident and capable of teaching."
            error={fieldErrors.subjectsTaught}
          >
            <Choices
              options={[...new Set(allResultSubjects)]}
              values={base.subjectsTaught}
              onToggle={(subject) =>
                setBaseField("subjectsTaught", updateArray(base.subjectsTaught, subject))
              }
            />
            <Input
              value={base.manualSubjects}
              onChange={(event) => setBaseField("manualSubjects", event.target.value)}
              placeholder="Add another subject or curriculum"
            />
          </Field>
        </Step>
        <Step>
          <Heading step={professional ? 4 : 5} title="Lesson Preferences & Locations" />
          <div className="grid gap-6">
            <Field
              label="Mode of Lesson"
              required
              hint="Being open to in-person lessons significantly increases your match rate."
              error={fieldErrors.format}
            >
              <SingleChoice
                options={FORMAT_OPTIONS}
                value={base.format}
                onChange={(format) => setBaseField("format", format)}
              />
            </Field>
            {base.format !== "Online" ? (
              <Field
                label="Possible Teaching Locations (MTR Network)"
                required
                hint="Select all MTR lines and stations you can realistically travel to."
                error={fieldErrors.stations}
              >
                <div className="grid gap-3">
                  {MTR_LINES.map((line) => (
                    <details key={line.id} className="rounded-lg border border-border p-3">
                      <summary className="cursor-pointer font-semibold text-foreground">
                        {line.label}
                      </summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <Checkbox
                            checked={line.stations.every((station) =>
                              base.stations.includes(station),
                            )}
                            onCheckedChange={() =>
                              setBaseField("stations", toggleLineStations(base.stations, line))
                            }
                          />{" "}
                          Select all
                        </label>
                        {line.stations.map((station) => (
                          <label
                            key={`${line.id}-${station}`}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={base.stations.includes(station)}
                              onCheckedChange={() =>
                                setBaseField("stations", updateArray(base.stations, station))
                              }
                            />
                            {station}
                          </label>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </Field>
            ) : null}
          </div>
        </Step>
        <Step>
          <Heading step={professional ? 5 : 6} title="Achievements and Experiences" />
          <Field
            label="Title / Description"
            required
            hint={
              professional
                ? "List anonymous student success statistics, examiner roles, or years at top-tier schools."
                : "List competitions, awards, scholarships, university offers, or instructional track records."
            }
            error={fieldErrors.experiences}
          >
            <div className="grid gap-3">
              {base.experiences.map((experience, index) => (
                <div key={index} className="flex gap-2">
                  <Textarea
                    value={experience}
                    onChange={(event) =>
                      setBaseField(
                        "experiences",
                        base.experiences.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder="Describe an achievement or experience"
                  />
                  {base.experiences.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() =>
                        setBaseField(
                          "experiences",
                          base.experiences.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => setBaseField("experiences", [...base.experiences, ""])}
              >
                <Plus /> Add another experience
              </Button>
            </div>
          </Field>
          <label className="mt-5 flex items-start gap-3 text-sm text-muted-foreground">
            <Checkbox
              checked={base.certificatesLater}
              onCheckedChange={(checked) => setBaseField("certificatesLater", checked === true)}
            />
            I will provide supporting official certificates later to expedite profile creation.
          </label>
        </Step>
        <Step>
          <Heading step={professional ? 6 : 7} title="Logistics & Rate" />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Proposed Hourly Rate (HKD)" required error={fieldErrors.hourlyRate}>
              <Input
                type="number"
                value={base.hourlyRate}
                onChange={(event) => setBaseField("hourlyRate", event.target.value)}
              />
            </Field>
            <Field label="Teaching materials" required error={fieldErrors.materials}>
              <SingleChoice
                options={MATERIALS_OPTIONS}
                value={base.materials}
                onChange={(materials) => setBaseField("materials", materials)}
              />
            </Field>
            {primary.curriculum === "IBDP" ? (
              <Hint>
                Suggested recent graduate rates: 45/45 HK$500/hr, 43-44 HK$400/hr, 40-42
                HK$300-350/hr.
              </Hint>
            ) : primary.curriculum === "HKDSE" ? (
              <Hint>
                Suggested DSE rates: high achievers HK$150-200/hr; premium HK$250-300/hr for top
                scorers, sought-after majors, or extensive experience.
              </Hint>
            ) : null}
          </div>
        </Step>
        <Step>
          <Heading step={stepTitles.length} title="Acknowledgments" />
          <div className="grid gap-5">
            <Field
              label={
                professional
                  ? "Full CV and credentials"
                  : "Academic transcript / supporting documents"
              }
              required
              hint={`Up to ${MAX_FILES} files, 10 MB each.`}
              error={fieldErrors.files}
            >
              <Input
                type="file"
                multiple
                accept={ACCEPT_ATTRIBUTE}
                onChange={(event) => {
                  const picked = Array.from(event.target.files ?? [])
                    .filter(
                      (file) =>
                        ACCEPTED_FILE_TYPES.includes(file.type) && file.size <= MAX_FILE_BYTES,
                    )
                    .slice(0, MAX_FILES);
                  setFiles(picked);
                }}
              />
              {files.map((file) => (
                <p
                  key={file.name}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Paperclip className="h-3 w-3" />
                  {file.name}
                </p>
              ))}
            </Field>
            <label className="flex gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={base.privacy}
                onCheckedChange={(checked) => setBaseField("privacy", checked === true)}
              />
              {professional
                ? "I consent to MatchMax using my credentials and CV to verify my professional status, promote my teaches profile, and protect my anonymity."
                : PRIVACY_TEXT}
            </label>
            <label className="flex gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={base.commission}
                onCheckedChange={(checked) => setBaseField("commission", checked === true)}
              />
              {COMMISSION_TEXT}
            </label>
            <div ref={captchaRef} className="min-h-[65px]" />
          </div>
        </Step>
      </Stepper>
      {error ? (
        <p
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}

function Heading({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-teal)]">
        Step {step}
      </p>
      <h2 className="mt-2 text-2xl font-black text-[color:var(--ink)] sm:text-3xl">{title}</h2>
    </div>
  );
}
