import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, LocateFixed, Paperclip, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/base/input/input";
import { FormField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Stepper, { Step, type StepperIndicatorRenderArgs } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import {
  extractTranscriptQualification,
  submitTutorApplication,
} from "@/lib/tutor-application.functions";
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
  PROFESSIONAL_ROLE_OPTIONS,
  PRIVACY_TEXT,
  STATUS_OPTIONS,
  TEACHING_QUALIFICATION_OPTIONS,
  tutorApplicationSchema,
} from "@/lib/tutor-application.schema";
import {
  getNearestMtrStation,
  getReachableMtrStations,
  MTR_LINES,
  MTR_STATION_OPTIONS,
  toggleLineStations,
} from "./mtr";
import { getGradesForSelection, getSystem } from "@/features/tutors/examSystems";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";

type ScoreRow = {
  subject: string;
  grade: string;
  detail: string;
  level: string;
  gradeSystem: string;
  papers: { label: string; score: string }[];
};
type Qualification = {
  curriculum: string;
  overall: string;
  boards: string[];
  scores: ScoreRow[];
  best6: string;
  transcript: File | null;
  transcriptStatus: "upload" | "not_applicable" | "provide_later";
};
type Achievement = {
  title: string;
  description: string;
  proof: File | null;
  proofStatus: "upload" | "not_applicable" | "provide_later";
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
const COUNTRY_OPTIONS = [
  "Hong Kong",
  "Mainland China",
  "Macau",
  "Singapore",
  "United Kingdom",
  "United States",
  "Canada",
  "Australia",
  "Other",
];
const COUNTRY_DIAL_CODES: Record<string, string> = {
  "Hong Kong": "+852",
  "Mainland China": "+86",
  Macau: "+853",
  Singapore: "+65",
  "United Kingdom": "+44",
  "United States": "+1",
  Canada: "+1",
  Australia: "+61",
};
const ACADEMIC_STEPS = [
  "Basic Info",
  "Academics",
  "Subjects Taught",
  "Lesson Preferences",
  "Experience",
  "Rate",
  "Acknowledgments",
];
const PROFESSIONAL_STEPS = [
  "Basic Details",
  "Academics",
  "Subjects Taught",
  "Lesson Preferences",
  "Experience",
  "Rate",
  "Acknowledgments",
];

const Field = FormField;

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic leading-relaxed text-muted-foreground">{children}</p>;
}

function readableFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTranscriptImage(file: File) {
  return (
    ["image/jpeg", "image/png"].includes(file.type) ||
    /\.(jpe?g|png)$/i.test(file.name)
  );
}

function DocumentUpload({
  file,
  onSelect,
  onRemove,
  disabled,
  accept = ACCEPT_ATTRIBUTE,
  prompt = "Drop a file here or choose a file",
}: {
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  accept?: string;
  prompt?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(file ? 100 : 0);
  useEffect(() => {
    if (!file) {
      setProgress(0);
      return;
    }
    setProgress(0);
    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          window.clearInterval(interval);
          return 100;
        }
        return Math.min(current + 20, 100);
      });
    }, 75);
    return () => window.clearInterval(interval);
  }, [file]);
  const selectFile = (candidate: File | undefined) => {
    if (candidate) onSelect(candidate);
  };
  return (
    <div className="grid min-w-0 gap-2">
      <label
        className={cn(
          "flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-[color:var(--surface-subtle)] px-4 py-3 text-center text-sm text-muted-foreground transition-colors",
          dragging && "border-[color:var(--brand-teal)] bg-[color:var(--brand-teal)]/10",
          disabled && "cursor-not-allowed opacity-60",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) selectFile(event.dataTransfer.files[0]);
        }}
      >
        <Upload className="h-4 w-4 text-[color:var(--brand-teal)]" />
        <span>{prompt}</span>
        <input
          type="file"
          className="sr-only"
          accept={accept}
          disabled={disabled}
          onChange={(event) => {
            selectFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {file ? (
        <div className="grid gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{file.name} ({readableFileSize(file.size)})</span></span>
            <Button type="button" size="icon" variant="ghost" aria-label="Remove file" onClick={onRemove} disabled={disabled}><X /></Button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`Upload ${progress}%`}>
            <div className="h-full bg-[color:var(--brand-teal)] transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress < 100 ? `Preparing upload ${progress}%` : "Ready"}</span>
        </div>
      ) : null}
    </div>
  );
}

function blankQualification(curriculum = "IBDP"): Qualification {
  return {
    curriculum,
    overall: "",
    boards: [],
    scores: [{ subject: "", grade: "", detail: "", level: "", gradeSystem: "", papers: [] }],
    best6: "",
    transcript: null,
    transcriptStatus: "upload",
  };
}

function paperOptions(curriculum: string) {
  if (curriculum === "IBDP")
    return ["Paper 1", "Paper 2", "Paper 3", "Internal Assessment (IA)", "Individual Oral (IO)"];
  if (curriculum === "HKDSE") return ["Paper 1", "Paper 2", "Paper 3", "Paper 4", "School-based Assessment (SBA)"];
  if (curriculum === "AP") return ["Multiple Choice", "Free Response", "Portfolio / Performance Task"];
  return ["Paper 1", "Paper 2", "Paper 3", "Paper 4", "Coursework"];
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
        <label
          key={option}
          className="flex min-h-11 cursor-pointer items-center gap-2 py-1 text-sm text-foreground"
        >
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
    <div className="flex flex-wrap items-start gap-2">
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

function SubjectPicker({
  studiedSubjects,
  addedSubjects,
  options,
  onToggle,
}: {
  studiedSubjects: string[];
  addedSubjects: string[];
  options: readonly string[];
  onToggle: (subject: string) => void;
}) {
  const selectedSubjects = new Set([...studiedSubjects, ...addedSubjects]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[...selectedSubjects].map((subject) => (
          <span
            key={subject}
            className="inline-flex items-center gap-1 rounded-md bg-[#77E8EE]/30 px-2.5 py-1.5 text-xs font-semibold text-[color:var(--ink)]"
          >
            {subject}
            <button
              type="button"
              aria-label={`Remove ${subject}`}
              onClick={() => onToggle(subject)}
              className="rounded-full p-0.5 text-[color:var(--ink)]/60 hover:bg-[color:var(--ink)]/10 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selectedSubjects.size === 0 ? (
          <span className="text-sm text-muted-foreground">No subjects selected yet.</span>
        ) : null}
        <div className="w-56">
          <SearchableSelect
            value=""
            onChange={onToggle}
            options={options.filter((subject) => !selectedSubjects.has(subject))}
            placeholder="Add subject"
            searchPlaceholder="Search subjects..."
            emptyText="No additional subjects available."
          />
        </div>
      </div>
    </div>
  );
}

export function ApplicationForm() {
  const submit = useServerFn(submitTutorApplication);
  const extractTranscript = useServerFn(extractTranscriptQualification);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [transcriptStatus, setTranscriptStatus] = useState<"idle" | "reading">("idle");
  const [transcriptMessage, setTranscriptMessage] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaWidget = useRef<string | null>(null);
  const [originStation, setOriginStation] = useState("");
  const [travelBudget, setTravelBudget] = useState("10");
  const [autoStations, setAutoStations] = useState<string[]>([]);
  const [excludedAutoStations, setExcludedAutoStations] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "adding" | "done">("idle");
  const [base, setBase] = useState({
    name: "",
    phone: "+852 ",
    email: "",
    country: "Hong Kong",
    countryOther: "",
    graduationYear: "",
    status: "",
    statusOther: "",
    medium: [] as string[],
    highSchool: "",
    university: "",
    programme: "",
    year: "",
    subjectsTaught: [] as string[],
    format: "",
    stations: [] as string[],
    achievements: [] as Achievement[],
    hourlyRate: "",
    materials: "",
    certificatesLater: false,
    commission: false,
    privacy: false,
  });
  const [roles, setRoles] = useState<string[]>([]);
  const [boards, setBoards] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<string[]>([]);
  const [removedStudiedSubjects, setRemovedStudiedSubjects] = useState<string[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([blankQualification()]);
  const professional = PROFESSIONAL_STATUSES.has(base.status);
  const stepTitles = professional ? PROFESSIONAL_STEPS : ACADEMIC_STEPS;
  const primary = qualifications[0];

  function changeStep(nextStep: number) {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addTravelSuggestions() {
    if (!originStation || suggestionStatus === "adding") return;
    const selectedOrigin = originStation;
    const selectedBudget = travelBudget;
    setSuggestionStatus("adding");
    const startedAt = Date.now();
    const suggestions = getReachableMtrStations(selectedOrigin, Number(selectedBudget)).filter(
      (station) => !excludedAutoStations.includes(station),
    );
    const remainingDelay = Math.max(0, 3000 - (Date.now() - startedAt));
    await new Promise((resolve) => window.setTimeout(resolve, remainingDelay));
    setBaseField("stations", [
      ...new Set([
        ...base.stations.filter((station) => !autoStations.includes(station)),
        ...suggestions,
      ]),
    ]);
    setAutoStations(suggestions);
    setFieldErrors((current) => ({ ...current, stations: "" }));
    setSuggestionStatus("done");
  }

  function setOrigin(value: string) {
    setOriginStation(value);
    setSuggestionStatus("idle");
  }

  function toggleManualStation(station: string) {
    const isSelected = base.stations.includes(station);
    if (isSelected && autoStations.includes(station)) {
      setExcludedAutoStations((current) => [...new Set([...current, station])]);
    } else if (!isSelected) {
      setExcludedAutoStations((current) => current.filter((item) => item !== station));
    }
    setAutoStations((current) => current.filter((item) => item !== station));
    setBaseField("stations", updateArray(base.stations, station));
  }

  function toggleManualLine(line: (typeof MTR_LINES)[number]) {
    const selectedStations = line.stations.filter((station) => base.stations.includes(station));
    const excludedStations = selectedStations.filter((station) => autoStations.includes(station));
    if (excludedStations.length) {
      setExcludedAutoStations((current) => [...new Set([...current, ...excludedStations])]);
    } else {
      setExcludedAutoStations((current) =>
        current.filter((station) => !line.stations.includes(station)),
      );
    }
    setAutoStations((current) => current.filter((station) => !line.stations.includes(station)));
    setBaseField("stations", toggleLineStations(base.stations, line));
  }

  function locateOrigin() {
    if (!navigator.geolocation) {
      setLocationMessage("Location is not available in this browser. Choose a station manually.");
      return;
    }
    setLocating(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const station = getNearestMtrStation(position.coords.latitude, position.coords.longitude);
        setLocating(false);
        if (!station) {
          setLocationMessage("We could not find a nearby MTR station. Choose one manually.");
          return;
        }
        setOrigin(station);
        setLocationMessage(`Nearest station found: ${station}`);
      },
      () => {
        setLocating(false);
        setLocationMessage("Location permission was unavailable. Choose a station manually.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  const allResultSubjects = useMemo(
    () => [
      ...new Set(
        qualifications.flatMap((qualification) =>
          qualification.scores.map((score) => score.subject.trim()).filter(Boolean),
        ),
      ),
    ],
    [qualifications],
  );
  const selectedTeachingSubjects = useMemo(
    () => [
      ...new Set([
        ...allResultSubjects.filter((subject) => !removedStudiedSubjects.includes(subject)),
        ...base.subjectsTaught,
      ]),
    ],
    [allResultSubjects, base.subjectsTaught, removedStudiedSubjects],
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
        callback: (token) => {
          setCaptchaError(null);
          setCaptcha(token);
        },
        "expired-callback": () => setCaptcha(null),
        "error-callback": (errorCode = "unknown") => {
          setCaptcha(null);
          setCaptchaError(`Security check unavailable (${errorCode}).`);
        },
      });
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"]',
    );
    if (existing) {
      existing.addEventListener("load", renderCaptcha);
      renderCaptcha();
      return () => {
        existing.removeEventListener("load", renderCaptcha);
        if (captchaWidget.current && window.turnstile) {
          window.turnstile.remove(captchaWidget.current);
        }
        captchaWidget.current = null;
      };
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderCaptcha);
    script.addEventListener("error", () => setCaptchaError("Security check could not be loaded."));
    document.head.appendChild(script);
    return () => {
      script.removeEventListener("load", renderCaptcha);
      if (captchaWidget.current && window.turnstile) {
        window.turnstile.remove(captchaWidget.current);
      }
      captchaWidget.current = null;
    };
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
  function updateAchievement(index: number, patch: Partial<Achievement>) {
    setBaseField(
      "achievements",
      base.achievements.map((achievement, achievementIndex) =>
        achievementIndex === index ? { ...achievement, ...patch } : achievement,
      ),
    );
  }
  function setCountry(country: string) {
    const dialCode = COUNTRY_DIAL_CODES[country];
    const phoneWithoutDialCode = base.phone.replace(/^\+(?:852|853|86|65|44|61|1)\s*/, "");
    setBase((previous) => ({
      ...previous,
      country,
      phone: dialCode ? `${dialCode} ${phoneWithoutDialCode}`.trimEnd() : phoneWithoutDialCode,
    }));
  }

  function validateCurrentStep() {
    const next: Record<string, string> = {};
    const required = (key: string, value: unknown) => {
      if (!value || (Array.isArray(value) && value.length === 0)) next[key] = "Required";
    };
    if (step === 1) {
      required("name", base.name.trim());
      required("phone", base.phone.trim());
      required("email", base.email.trim());
      required("country", base.country.trim());
      if (base.country === "Other") required("countryOther", base.countryOther.trim());
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
        required("subjectsTaught", selectedTeachingSubjects);
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
      required("subjectsTaught", selectedTeachingSubjects);
    const lessonStep = professional ? 4 : 4;
    if (step === lessonStep) {
      required("format", base.format);
      if (base.format !== "Online") required("stations", base.stations);
    }
    const experienceStep = professional ? 5 : 5;
    if (step === experienceStep) {
      base.achievements.forEach((achievement, index) => {
        required(`achievement-title-${index}`, achievement.title.trim());
        required(`achievement-description-${index}`, achievement.description.trim());
        if (achievement.proofStatus === "upload")
          required(`achievement-proof-${index}`, achievement.proof);
      });
    }
    const logisticsStep = professional ? 6 : 6;
    if (step === logisticsStep) {
      required("hourlyRate", base.hourlyRate.trim());
      required("materials", base.materials);
    }
    if (step === stepTitles.length) {
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
  async function autoFillQualification(qualificationIndex: number, file: File) {
    if (!isTranscriptImage(file) || file.size > MAX_FILE_BYTES) {
      setError("Use a JPG or PNG transcript image no larger than 5 MB.");
      return;
    }
    setTranscriptStatus("reading");
    setTranscriptMessage("Reading transcript with AI...");
    setError(null);
    try {
      const extracted = await extractTranscript({
        data: {
          curriculum: qualifications[qualificationIndex].curriculum as (typeof CURRICULUM_OPTIONS)[number],
          contentType: (file.type === "image/png" || /\.png$/i.test(file.name)
            ? "image/png"
            : "image/jpeg") as "image/jpeg" | "image/png",
          content: await fileData(file),
        },
      });
      updateQualification(qualificationIndex, {
        overall: extracted.overall,
        best6: extracted.best6,
        scores: extracted.scores.map((score) => ({
          ...score,
          papers: [],
        })),
      });
      setTranscriptMessage(
        `Added ${extracted.scores.length} result${extracted.scores.length === 1 ? "" : "s"}. Review the fields below.`,
      );
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Transcript auto-fill failed.";
      setError(message);
      setTranscriptMessage(message);
    } finally {
      setTranscriptStatus("idle");
    }
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
        country: base.country === "Other" ? base.countryOther : base.country,
        graduationYear: base.graduationYear,
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
        subjectsConfident: selectedTeachingSubjects.join(", "),
        subjectResults: professional
          ? `Professional subjects: ${selectedTeachingSubjects.join(", ")}\n${base.achievements.map((achievement) => achievement.description).join("\n")}`
          : subjectResults,
        awards: "",
        achievements: await Promise.all(
          base.achievements.map(async (achievement) => ({
            title: achievement.title,
            description: achievement.description,
            proofStatus: achievement.proofStatus,
            proof: achievement.proof
              ? {
                  filename: achievement.proof.name,
                  contentType: achievement.proof.type,
                  size: achievement.proof.size,
                  content: await fileData(achievement.proof),
                }
              : undefined,
          })),
        ),
        academicDocuments: await Promise.all(
          qualifications.map(async (qualification) => ({
            curriculum: qualification.curriculum,
            status: qualification.transcriptStatus,
            file: qualification.transcript
              ? {
                  filename: qualification.transcript.name,
                  contentType: qualification.transcript.type,
                  size: qualification.transcript.size,
                  content: await fileData(qualification.transcript),
                }
              : undefined,
          })),
        ),
        experience: base.achievements
          .map((achievement) => `${achievement.title}: ${achievement.description}`)
          .join("\n"),
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
      <div key={qualificationIndex} className="grid gap-4">
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
            qualification.curriculum === "IBDP" && ["TOK", "Extended Essay"].includes(score.subject)
              ? ["A", "B", "C", "D", "E"]
              : qualification.curriculum === "IGCSE / GCSE" && score.gradeSystem === "A*-G"
                ? ["A*", "A", "B", "C", "D", "E", "F", "G", "U"]
                : qualification.curriculum === "IGCSE / GCSE" && score.gradeSystem === "9-1"
                  ? ["9", "8", "7", "6", "5", "4", "3", "2", "1", "U"]
                  : getGradesForSelection(system?.id ?? "other", score.subject);
          const availableSubjects = system?.subjects;
          const isFreeformQualification = qualification.curriculum === "Foundation / other";
          return (
            <div
              key={scoreIndex}
              className="grid gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-2"
            >
              {isFreeformQualification ? (
                <Input
                  value={score.subject}
                  onChange={(event) =>
                    updateScore(qualificationIndex, scoreIndex, {
                      subject: event.target.value,
                    })
                  }
                  placeholder="Subject name"
                />
              ) : (
                <SearchableSelect
                  value={score.subject}
                  onChange={(subject) =>
                    updateScore(qualificationIndex, scoreIndex, { subject, grade: "" })
                  }
                  options={availableSubjects ?? []}
                  placeholder="Choose subject"
                  searchPlaceholder="Search subjects..."
                  emptyText="No matching subjects."
                />
              )}
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
              {isFreeformQualification ? (
                <Input
                  value={score.grade}
                  onChange={(event) =>
                    updateScore(qualificationIndex, scoreIndex, { grade: event.target.value })
                  }
                  placeholder="Grade / result"
                />
              ) : (
                <Select
                  value={score.grade}
                  onValueChange={(grade) => updateScore(qualificationIndex, scoreIndex, { grade })}
                  disabled={!score.subject}
                >
                  <SelectTrigger aria-label="Overall grade">
                    <SelectValue placeholder="Choose grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeOptions.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                className="sm:col-span-2"
                value={score.detail}
                onChange={(event) =>
                  updateScore(qualificationIndex, scoreIndex, { detail: event.target.value })
                }
                placeholder="Specific paper grades / breakdown (optional)"
              />
              <div className="grid gap-2 sm:col-span-2">
                {score.papers.map((paper, paperIndex) => (
                  <div
                    key={`${paper.label}-${paperIndex}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <div className="col-span-2 sm:col-span-1">
                      <Select
                        value={paper.label}
                        onValueChange={(label) =>
                          updateScore(qualificationIndex, scoreIndex, {
                            papers: score.papers.map((item, itemIndex) =>
                              itemIndex === paperIndex ? { ...item, label } : item,
                            ),
                          })
                        }
                      >
                        <SelectTrigger aria-label="Assessment component">
                          <SelectValue placeholder="Choose paper or assessment" />
                        </SelectTrigger>
                        <SelectContent>
                          {paperOptions(qualification.curriculum).map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={paper.score}
                      onChange={(event) =>
                        updateScore(qualificationIndex, scoreIndex, {
                          papers: score.papers.map((item, itemIndex) =>
                            itemIndex === paperIndex ? { ...item, score: event.target.value } : item,
                          ),
                        })
                      }
                      placeholder="Specific score"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remove assessment component"
                      onClick={() => updateScore(qualificationIndex, scoreIndex, { papers: score.papers.filter((_, itemIndex) => itemIndex !== paperIndex) })}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={() =>
                    updateScore(qualificationIndex, scoreIndex, {
                      papers: [...score.papers, { label: "", score: "" }],
                    })
                  }
                >
                  <Plus /> Add paper or assessment score
                </Button>
              </div>
              {qualification.scores.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
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
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() =>
            updateQualification(qualificationIndex, {
              scores: [
                ...qualification.scores,
                { subject: "", grade: "", detail: "", level: "", gradeSystem: "", papers: [] },
              ],
            })
          }
        >
          <Plus /> Add another subject
        </Button>
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
        className="join-stepper"
        scrollActiveIndicatorIntoView
        currentStep={step}
        onStepChange={changeStep}
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
            <div className="grid content-start gap-6">
              <Field label="Full Name" required error={fieldErrors.name}>
                <Input
                  value={base.name}
                  onChange={(event) => setBaseField("name", event.target.value)}
                  placeholder="Chan Hau Yui Hauzton"
                />
              </Field>
              <Input
                isRequired
                isInvalid={Boolean(fieldErrors.email)}
                label="Email"
                hint={fieldErrors.email || "Add your personal email"}
                tooltip="Use an email address you check regularly."
                type="email"
                value={base.email}
                onChange={(event) => setBaseField("email", event.target.value)}
                placeholder="hauzton.chan@gmail.com"
              />
              <Field label="Country / Region" required error={fieldErrors.country}>
                <SearchableSelect
                  value={base.country}
                  onChange={setCountry}
                  options={COUNTRY_OPTIONS}
                  placeholder="Choose country or region"
                  searchPlaceholder="Search countries"
                  emptyText="No matching country. Choose Other."
                />
                {base.country === "Other" ? (
                  <Input
                    className="mt-2"
                    value={base.countryOther}
                    onChange={(event) => setBaseField("countryOther", event.target.value)}
                    placeholder="Enter country or region"
                  />
                ) : null}
                {fieldErrors.countryOther ? <p className="mt-2 text-xs font-medium text-destructive">{fieldErrors.countryOther}</p> : null}
              </Field>
            </div>
            <div className="grid content-start gap-6">
              <Field
                label="Phone / WhatsApp Number"
                required
                hint="Whatsapp Number"
                error={fieldErrors.phone}
              >
                <Input
                  value={base.phone}
                  onChange={(event) => setBaseField("phone", event.target.value)}
                  placeholder="+852 9123 4567"
                />
              </Field>
              <Field label="Medium of Instruction" required error={fieldErrors.medium}>
                <Choices
                  options={LANGUAGES}
                  values={base.medium}
                  onToggle={(language) =>
                    setBaseField("medium", updateArray(base.medium, language))
                  }
                />
              </Field>
              <Field label="Graduation Year">
                <Input
                  value={base.graduationYear}
                  onChange={(event) => setBaseField("graduationYear", event.target.value)}
                  placeholder="2023"
                />
              </Field>
            </div>
            <Field
              label="Current Status"
              required
              error={fieldErrors.status}
              className="sm:col-span-2"
            >
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
              {base.status === "Official examiner / moderator" ||
              roles.includes("Official examiner / moderator") ? (
                <div className="mt-4">
                  <Label className="font-semibold text-foreground">
                    Examining Board(s)
                    <span className="ml-1 text-destructive">*</span>
                  </Label>
                  <div className="mt-2">
                    <Choices
                      options={EXAMINING_BOARD_OPTIONS}
                      values={boards}
                      onToggle={(board) => setBoards(updateArray(boards, board))}
                    />
                  </div>
                  {fieldErrors.boards ? (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      {fieldErrors.boards}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Field>
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
                    placeholder="Diocesan Boys' School, 2023"
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
                placeholder="HKUST"
              />
            </Field>
            <Field label="Degree / Programme Major">
              <Input
                value={base.programme}
                onChange={(event) => setBaseField("programme", event.target.value)}
                placeholder="BBA Global Business & BSc Computer Science"
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
                    <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                      <Field
                        label={index === 0 ? "Primary Curriculum" : "Additional Qualification"}
                        required
                        error={fieldErrors[`curriculum-${index}`]}
                      >
                        <div className="flex items-center gap-2">
                          <SingleChoice
                            options={CURRICULUM_OPTIONS}
                            value={qualification.curriculum}
                            onChange={(curriculum) =>
                              updateQualification(index, blankQualification(curriculum))
                            }
                          />
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
                      </Field>
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
                          placeholder={
                            qualification.curriculum === "IBDP"
                              ? "43 / 45"
                              : qualification.curriculum === "HKDSE"
                                ? "32"
                                : "A*AA"
                          }
                        />
                      </Field>
                      {["A-Level", "IGCSE / GCSE"].includes(qualification.curriculum) ? (
                        <Field
                          label="Exam Board(s)"
                          required
                          error={fieldErrors[`boards-${index}`]}
                          className="sm:col-span-2"
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
                            placeholder="36"
                          />
                        </Field>
                      ) : null}
                      <Field label="Academic transcript / supporting document">
                        <Select
                          value={
                            qualification.transcriptStatus === "upload"
                              ? "File upload"
                              : qualification.transcriptStatus === "provide_later"
                                ? "Provide later"
                                : "N/A"
                          }
                                onValueChange={(choice) =>
                            updateQualification(index, {
                              transcriptStatus:
                                choice === "File upload"
                                  ? "upload"
                                  : choice === "Provide later"
                                    ? "provide_later"
                                    : "not_applicable",
                              transcript: choice === "File upload" ? qualification.transcript : null,
                            })
                          }
                        >
                          <SelectTrigger aria-label="Academic document option">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['File upload', 'N/A', 'Provide later'].map((option) => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {qualification.transcriptStatus === "upload" ? (
                          <div className="mt-3 grid gap-2">
                            <DocumentUpload
                              file={qualification.transcript}
                              disabled={transcriptStatus === "reading"}
                              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                              prompt="Drop a JPG or PNG image here or choose one"
                              onRemove={() => updateQualification(index, { transcript: null })}
                              onSelect={(file) => {
                                if (!isTranscriptImage(file)) {
                                  setError("PDFs and documents cannot be uploaded here. Use a JPG or PNG image of your transcript instead.");
                                  return;
                                }
                                if (file.size > MAX_FILE_BYTES) {
                                  setError("Transcript images must be no larger than 5 MB.");
                                  return;
                                }
                                updateQualification(index, { transcript: file });
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="w-fit"
                              loading={transcriptStatus === "reading"}
                              disabled={transcriptStatus === "reading"}
                              onClick={() => {
                                if (!qualification.transcript) {
                                  setError("Upload a JPG or PNG transcript before using AI auto-fill.");
                                  return;
                                }
                                if (!isTranscriptImage(qualification.transcript)) {
                                  setError("AI auto-fill supports JPG and PNG transcript images only.");
                                  return;
                                }
                                void autoFillQualification(index, qualification.transcript);
                              }}
                            >
                              <Sparkles /> Auto-fill with AI
                            </Button>
                            <Hint>JPG and PNG transcripts can be read by AI. Review every populated field before submitting.</Hint>
                            {transcriptMessage ? (
                              <p
                                className={cn(
                                  "text-xs font-medium",
                                  transcriptStatus === "reading"
                                    ? "animate-pulse text-[color:var(--brand-teal)]"
                                    : transcriptMessage.startsWith("Added")
                                      ? "text-emerald-700"
                                      : "text-destructive",
                                )}
                                role="status"
                                aria-live="polite"
                              >
                                {transcriptMessage}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </Field>
                    </div>
                    <div className="mt-5 border-t border-border pt-5">
                      <h3 className="text-base font-black text-[color:var(--ink)]">
                        Subject Scores
                      </h3>
                      <Hint>
                        List your full academic profile. Specific paper grades or breakdowns
                        highlight niche strengths for parents looking for targeted support.
                      </Hint>
                      <div className="mt-4">{scoreEditor(qualification, index)}</div>
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
        <Step>
          <Heading step={professional ? 3 : 3} title="Subjects Taught" />
          <Field
            label="Subjects Willing to Teach"
            required
            hint="Select subjects from your academic profile that you are confident and capable of teaching."
            error={fieldErrors.subjectsTaught}
          >
            <SubjectPicker
              studiedSubjects={allResultSubjects.filter(
                (subject) => !removedStudiedSubjects.includes(subject),
              )}
              addedSubjects={base.subjectsTaught}
              options={[...new Set([...DEFAULT_SUBJECT_OPTIONS, ...allResultSubjects])]}
              onToggle={(subject) => {
                if (allResultSubjects.includes(subject)) {
                  setRemovedStudiedSubjects((current) =>
                    current.includes(subject)
                      ? current.filter((item) => item !== subject)
                      : [...current, subject],
                  );
                  return;
                }
                setBaseField("subjectsTaught", updateArray(base.subjectsTaught, subject));
              }}
            />
          </Field>
        </Step>
        <Step>
          <Heading step={professional ? 4 : 4} title="Lesson Preferences & Locations" />
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
                hint="Suggestions use estimated MTR rail and transfer time, not straight-line station distance. Walking time and delays are not included."
                error={fieldErrors.stations}
              >
                <div className="grid gap-3 rounded-lg border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-4">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div className="grid gap-2">
                      <Label className="text-sm font-semibold">Starting MTR station</Label>
                      <SearchableSelect
                        value={originStation}
                        onChange={setOrigin}
                        options={MTR_STATION_OPTIONS}
                        placeholder="Choose your closest station"
                        searchPlaceholder="Search MTR stations"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={locateOrigin}
                      disabled={locating}
                    >
                      <LocateFixed />
                      {locating ? "Locating…" : "Use my location"}
                    </Button>
                  </div>
                  {locationMessage ? (
                    <p className="text-xs font-medium text-[color:var(--ink)]/70">
                      {locationMessage}
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    <Label className="text-sm font-semibold">Estimated MTR travel time</Label>
                    <div className="flex flex-wrap gap-2">
                      {["10", "20", "30"].map((budget) => (
                        <button
                          key={budget}
                          type="button"
                          disabled={!originStation}
                          onClick={() => {
                            setTravelBudget(budget);
                            setSuggestionStatus("idle");
                          }}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                            travelBudget === budget && originStation
                              ? "border-[color:var(--ink)] bg-[color:var(--surface-invert)] text-white"
                              : "border-border bg-card text-foreground hover:border-[color:var(--brand-teal)]/50",
                          )}
                        >
                          Within {budget} min
                        </button>
                      ))}
                    </div>
                  </div>
                  {originStation ? (
                    <p className="text-xs text-muted-foreground">
                      Stations within {travelBudget} minutes of {originStation} are preselected. You
                      can edit the list below.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="solid"
                      color="accent"
                      onClick={addTravelSuggestions}
                      disabled={!originStation || suggestionStatus === "adding"}
                      loading={suggestionStatus === "adding"}
                    >
                      <Plus />
                      Quick Add Stations
                    </Button>
                    {suggestionStatus !== "idle" ? (
                      <p
                        className={cn(
                          "text-sm font-semibold transition-colors",
                          suggestionStatus === "adding"
                            ? "animate-pulse text-[color:var(--brand-teal)]"
                            : "text-emerald-700",
                        )}
                        role="status"
                        aria-live="polite"
                      >
                        {suggestionStatus === "adding"
                          ? "Adding stations…"
                          : `Done · ${autoStations.length} stations within ${travelBudget} min`}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Accordion
                  type="single"
                  collapsible
                  className="overflow-hidden rounded-lg border border-border px-4"
                >
                  {MTR_LINES.map((line) => (
                    <AccordionItem key={line.id} value={line.id}>
                      <AccordionTrigger className="font-semibold text-foreground hover:no-underline">
                        {line.label} -{" "}
                        {line.stations.filter((station) => base.stations.includes(station)).length}{" "}
                        selected
                      </AccordionTrigger>
                      <AccordionContent className="pt-2">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label className="flex items-center gap-2 text-sm font-semibold">
                            <Checkbox
                              checked={line.stations.every((station) =>
                                base.stations.includes(station),
                              )}
                              onCheckedChange={() => toggleManualLine(line)}
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
                                onCheckedChange={() => toggleManualStation(station)}
                              />
                              {station}
                            </label>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Field>
            ) : null}
          </div>
        </Step>
        <Step>
          <Heading step={professional ? 5 : 5} title="Achievements and Experiences" />
          <Hint>
            Achievements and experience are optional. Add only items you would like MatchMax to consider.
          </Hint>
          <div className="mt-5 grid gap-4">
            {base.achievements.map((achievement, index) => (
              <div key={index} className="grid gap-3 rounded-lg border border-border p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(15rem,1fr)_auto]">
                <Field label="Title" required error={fieldErrors[`achievement-title-${index}`]}>
                  <Input value={achievement.title} onChange={(event) => updateAchievement(index, { title: event.target.value })} placeholder="Award or role" />
                </Field>
                <Field label="Description" required error={fieldErrors[`achievement-description-${index}`]}>
                  <Textarea value={achievement.description} onChange={(event) => updateAchievement(index, { description: event.target.value })} placeholder="Brief details" />
                </Field>
                <Field label="Evidence" error={fieldErrors[`achievement-proof-${index}`]}>
                  <Select
                    value={achievement.proofStatus === "upload" ? "File upload" : achievement.proofStatus === "provide_later" ? "Provide later" : "N/A"}
                    onValueChange={(choice) => updateAchievement(index, { proofStatus: choice === "File upload" ? "upload" : choice === "Provide later" ? "provide_later" : "not_applicable", proof: choice === "File upload" ? achievement.proof : null })}
                  >
                    <SelectTrigger aria-label="Achievement evidence option">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['File upload', 'N/A', 'Provide later'].map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {achievement.proofStatus === "upload" ? (
                    <div className="mt-2">
                      <DocumentUpload
                        file={achievement.proof}
                        onRemove={() => updateAchievement(index, { proof: null })}
                        onSelect={(file) => {
                          if (!ACCEPTED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_BYTES) {
                            setError("Choose a supported evidence file no larger than 5 MB.");
                            return;
                          }
                          updateAchievement(index, { proof: file });
                        }}
                      />
                    </div>
                  ) : null}
                </Field>
                <Button type="button" size="icon" variant="ghost" aria-label="Remove achievement" onClick={() => setBaseField("achievements", base.achievements.filter((_, itemIndex) => itemIndex !== index))}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            {base.achievements.length < MAX_FILES ? (
              <Button type="button" variant="outline" className="w-fit" onClick={() => setBaseField("achievements", [...base.achievements, { title: "", description: "", proof: null, proofStatus: "not_applicable" }])}>
                <Plus /> Add achievement or experience
              </Button>
            ) : null}
          </div>
        </Step>
        <Step>
          <Heading step={professional ? 6 : 6} title="Logistics & Rate" />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label="Proposed Hourly Rate (HKD)"
              required
              error={fieldErrors.hourlyRate}
              hint={
                primary.curriculum === "IBDP"
                  ? "Suggested recent graduate rates: 45/45 HK$500/hr, 43-44 HK$400/hr, 40-42 HK$300-350/hr."
                  : primary.curriculum === "HKDSE"
                    ? "Suggested DSE rates: high achievers HK$150-200/hr; premium HK$250-300/hr for top scorers, sought-after majors, or extensive experience."
                    : undefined
              }
            >
              <Input
                type="number"
                value={base.hourlyRate}
                onChange={(event) => setBaseField("hourlyRate", event.target.value)}
                placeholder="450"
              />
            </Field>
            <Field
              label="Teaching materials"
              required
              error={fieldErrors.materials}
              className="self-start"
            >
              <SingleChoice
                options={MATERIALS_OPTIONS}
                value={base.materials}
                onChange={(materials) => setBaseField("materials", materials)}
              />
            </Field>
          </div>
        </Step>
        <Step>
          <Heading step={stepTitles.length} title="Acknowledgments" />
          <div className="grid gap-5">
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
            {captchaError ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {captchaError}
              </p>
            ) : null}
          </div>
        </Step>
      </Stepper>
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
