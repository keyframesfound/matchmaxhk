import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Gift,
  LocateFixed,
  Paperclip,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
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
import { REFERRAL_CODE_PATTERN, readStoredReferralCode } from "@/lib/referral";
import { contactFilterError } from "@/lib/contact-filter";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, toCurrencyCode } from "@/lib/money";
import { approxHkdText } from "@/features/currency/convert";
import { useExchangeRates } from "@/features/currency/display-currency-context";
import {
  MAX_ACADEMIC_HEADLINE,
  academicHeadlineError,
  buildAcademicHeadline,
} from "@/lib/academic-headline";
import { useFormDraft } from "@/lib/use-form-draft";
import { useWhatsAppNumber } from "@/lib/use-whatsapp-number";
import { cn } from "@/lib/utils";
import { submitTutorApplication } from "@/lib/tutor-application.functions";
import { TermsGateCheckbox } from "@/features/legal/TermsGateCheckbox";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_FILE_TYPES,
  ACCEPTED_PORTFOLIO_IMAGE_TYPES,
  COMMISSION_TEXT,
  CURRICULUM_OPTIONS,
  EMAIL_REGEX,
  EXAMINING_BOARD_OPTIONS,
  FORMAT_OPTIONS,
  MATERIALS_OPTIONS,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_PORTFOLIO_FILES,
  PHONE_REGEX,
  PORTFOLIO_ACCEPT_ATTRIBUTE,
  PROFILE_PHOTO_ACCEPT_ATTRIBUTE,
  PROFESSIONAL_ROLE_OPTIONS,
  PROFESSIONAL_STATUS,
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
import {
  getGradesForSelection,
  getSystem,
  IELTS_COMPONENT_LABELS,
  ISAT_COMPONENT_LABELS,
  UCAT_COMPONENT_LABELS,
} from "@/features/tutors/examSystems";
import {
  DEFAULT_SUBJECT_OPTIONS,
  TEACHING_CURRICULA,
  getSubjectOptionsForCategory,
} from "@/features/tutors/subjects";
import {
  MAX_RATE_ROWS,
  RATE_MAX,
  RATE_MIN,
  RATE_NOTE_MAX,
  RATE_ROW_LABEL_MAX,
  TRAVEL_NOTE_MAX,
  isValidTutorRate,
  normalizeTutorRateRows,
} from "@/features/tutors/rates";
import { SEN_CATEGORY_OPTIONS } from "@/features/tutors/sen";
import { useSenCategoryLabels } from "@/features/tutors/sen-labels";

type ScoreRow = {
  subject: string;
  grade: string;
  level: string;
  gradeSystem: string;
  papers: { label: string; score: string }[];
};
// Issue #309: no evidence at /join — qualifications are TEXT answers only;
// grade slips upload per-grade from the profile editor (tutor_grades).
type Qualification = {
  curriculum: string;
  overall: string;
  boards: string[];
  scores: ScoreRow[];
  best6: string;
};
type Achievement = {
  title: string;
  description: string;
};

const SYSTEM_IDS: Record<string, string> = {
  IBDP: "ib",
  "A-Level": "alevel",
  "IGCSE / GCSE": "igcse",
  HKDSE: "dse",
  AP: "ap",
  SAT: "sat",
  IELTS: "ielts",
  ISAT: "isat",
  "UCAT(3600)": "ucat",
  "UCAT(2700)": "ucat",
};
const IELTS_CURRICULUM = "IELTS";
const IELTS_OVERALL_SUBJECT = "IELTS Overall";
const ISAT_CURRICULUM = "ISAT";
const UCAT_3600_CURRICULUM = "UCAT(3600)";
const UCAT_2700_CURRICULUM = "UCAT(2700)";
const isUcatCurriculum = (curriculum: string) =>
  curriculum === UCAT_3600_CURRICULUM || curriculum === UCAT_2700_CURRICULUM;
const ucatTotalCap = (curriculum: string) => (curriculum === UCAT_2700_CURRICULUM ? 2700 : 3600);
const ISAT_OVERALL_SUBJECT = "ISAT Overall";
const UCAT_TOTAL_SUBJECT = "UCAT Total";
// Curricula whose score entry is one fixed subject row with a fixed set of
// component (paper) breakdowns.
const FIXED_SCORE_SUBJECTS: Record<string, string> = {
  [IELTS_CURRICULUM]: IELTS_OVERALL_SUBJECT,
  [ISAT_CURRICULUM]: ISAT_OVERALL_SUBJECT,
  [UCAT_3600_CURRICULUM]: UCAT_TOTAL_SUBJECT,
  [UCAT_2700_CURRICULUM]: UCAT_TOTAL_SUBJECT,
};
// From 2025 the UCAT withdrew Abstract Reasoning, so UCAT(2700) has four
// components while UCAT(3600) keeps all five.
const UCAT_2025_COMPONENT_LABELS = UCAT_COMPONENT_LABELS.filter(
  (label) => label !== "Abstract Reasoning",
);
const ucatComponentLabels = (curriculum: string): readonly string[] =>
  curriculum === UCAT_2700_CURRICULUM ? UCAT_2025_COMPONENT_LABELS : UCAT_COMPONENT_LABELS;
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
  "Preferences",
  "Experience",
  "Rate",
  "Acknowledgments",
];
const PROFESSIONAL_STEPS = [
  "Basic Details",
  "Academics",
  "Subjects Taught",
  "Preferences",
  "Experience",
  "Rate",
  "Acknowledgments",
];

const labelClassName =
  "mb-1.5 block text-sm font-bold text-[color:var(--ink)] after:ml-0.5 after:text-[color:var(--muted-foreground)]";
const controlClassName = "h-11 w-full rounded-sm";
const invalidInputClassName =
  "border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30";

function RequiredFlag() {
  return <span className="ml-2 align-middle text-xs font-medium text-destructive">Required</span>;
}

function OptionalFlag() {
  return (
    <span className="ml-2 align-middle text-xs font-medium text-muted-foreground">Optional</span>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

function Field({ label, error, optional, hint, className, children }: FieldProps) {
  const control =
    isValidElement(children) && children.type === Input
      ? cloneElement(
          children as React.ReactElement<{ className?: string; "aria-invalid"?: boolean }>,
          {
            className: cn(
              controlClassName,
              error && invalidInputClassName,
              (children.props as { className?: string }).className,
            ),
            "aria-invalid": error ? true : undefined,
          },
        )
      : children;

  return (
    <div className={cn("min-w-0", className)}>
      <label className={labelClassName}>
        {label}
        {error === "Required" ? <RequiredFlag /> : null}
        {error !== "Required" && optional ? <OptionalFlag /> : null}
      </label>
      {control}
      {error && error !== "Required" ? (
        <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>
      ) : null}
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic leading-relaxed text-muted-foreground">{children}</p>;
}

function readableFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Full Name",
  phone: "Phone / WhatsApp Number",
  email: "Email",
  profilePhoto: "Profile photo",
  country: "Country / Region",
  countryOther: "Country / Region — specify",
  status: "Current Status",
  statusOther: "Current Status — specify",
  portfolioConsent: "Trophy cabinet photo consent",
  portfolioImages: "Trophy cabinet photos",
  university: "University / Institution",
  programme: "Degree / Programme Major",
  postgradUniversity: "Postgraduate University / Institution",
  postgradDegree: "Postgraduate Degree / Qualification",
  medium: "Medium of Instruction",
  roles: "Professional Role",
  boards: "Examining Board(s)",
  credentials: "Teaching Qualifications",
  highSchool: "Secondary School Attended",
  subjectsTaught: "Subjects Willing to Teach",
  format: "Mode of Lesson",
  stations: "Possible Teaching Locations (MTR Network)",
  onlineRate: "Online hourly rate (HKD)",
  inpersonRate: "In-person hourly rate (HKD)",
  rateRows: "Extra rate rows",
  travelNote: "Travel note",
  rateNote: "Rate note",
  materials: "Teaching materials",
  commission: "Commission acknowledgment (final step)",
  privacy: "Privacy consent (final step)",
  terms: "Terms and Conditions consent (final step)",
  termsGate: "Terms of Service acceptance (final step)",
  captcha: "Security check (final step)",
};

function describeFieldError(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  let match = key.match(/^curriculum-(\d+)$/);
  if (match) return `Qualification ${Number(match[1]) + 1} — Curriculum`;
  match = key.match(/^overall-(\d+)$/);
  if (match) return `Qualification ${Number(match[1]) + 1} — Overall achieved score/grades`;
  match = key.match(/^boards-(\d+)$/);
  if (match) return `Qualification ${Number(match[1]) + 1} — Exam Board(s)`;
  match = key.match(/^subject-(\d+)-(\d+)$/);
  if (match)
    return `Qualification ${Number(match[1]) + 1} — subject scores row ${Number(match[2]) + 1}: subject`;
  match = key.match(/^grade-(\d+)-(\d+)$/);
  if (match)
    return `Qualification ${Number(match[1]) + 1} — subject scores row ${Number(match[2]) + 1}: grade`;
  match = key.match(/^achievement-title-(\d+)$/);
  if (match) return `Achievement ${Number(match[1]) + 1} — Title`;
  match = key.match(/^achievement-description-(\d+)$/);
  if (match) return `Achievement ${Number(match[1]) + 1} — Description`;
  return key;
}

function isProfilePhoto(file: File) {
  return ["image/jpeg", "image/png"].includes(file.type) || /\.(jpe?g|png)$/i.test(file.name);
}

// Issue #97: Trophy Cabinet images — JPG/PNG/WebP. `File.type` can be empty on
// some mobile pickers, so fall back to the extension.
function isPortfolioImage(file: File) {
  return (
    ACCEPTED_PORTFOLIO_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
  );
}

/**
 * Issue #97: Trophy Cabinet multi-file picker (max 6 photos, 5MB each,
 * JPG/PNG/WebP). Strictly optional — the whole section renders no files and
 * no consent checkbox until the tutor adds one.
 */
function TrophyCabinetUpload({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const full = files.length >= MAX_PORTFOLIO_FILES;

  const addFiles = (candidates: FileList | null | undefined) => {
    if (!candidates || candidates.length === 0) return;
    const accepted: File[] = [];
    let rejectedType = false;
    let rejectedSize = false;
    for (const candidate of Array.from(candidates)) {
      if (files.length + accepted.length >= MAX_PORTFOLIO_FILES) break;
      if (!isPortfolioImage(candidate)) {
        rejectedType = true;
        continue;
      }
      if (candidate.size > MAX_FILE_BYTES) {
        rejectedSize = true;
        continue;
      }
      accepted.push(candidate);
    }
    if (rejectedType) {
      setError("Photos must be JPG, PNG, or WebP images.");
    } else if (rejectedSize) {
      setError(`Each photo must be no larger than ${readableFileSize(MAX_FILE_BYTES)}.`);
    } else if (files.length + accepted.length >= MAX_PORTFOLIO_FILES) {
      setError(null);
    } else {
      setError(null);
    }
    if (accepted.length > 0) onChange([...files, ...accepted]);
  };

  const removeFile = (index: number) => {
    setError(null);
    onChange(files.filter((_, fileIndex) => fileIndex !== index));
  };

  return (
    <div className="grid gap-3">
      {!full ? (
        <label
          className={cn(
            "flex min-h-20 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-sm border border-dashed border-border bg-[color:var(--surface-subtle)] px-3 py-4 text-center text-sm text-muted-foreground transition-colors",
            dragging && "border-[color:var(--ring)] bg-[color:var(--ring)]/[0.05]",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <Upload className="h-4 w-4 text-[color:var(--muted-foreground)]" />
          <span>
            {files.length === 0
              ? "Drop photos here or choose files"
              : `Add more (${files.length}/${MAX_PORTFOLIO_FILES})`}
          </span>
          <input
            type="file"
            className="sr-only"
            multiple
            accept={PORTFOLIO_ACCEPT_ATTRIBUTE}
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      ) : (
        <p className="text-xs font-semibold text-muted-foreground">
          Maximum of {MAX_PORTFOLIO_FILES} photos reached. Remove one to add another.
        </p>
      )}
      {files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="group relative overflow-hidden rounded-sm border border-border bg-[color:var(--surface-subtle)]"
            >
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-24 w-full object-cover"
                onLoad={(event) => {
                  // Revoke after the first paint so previews don't leak memory.
                  const target = event.currentTarget;
                  window.setTimeout(() => URL.revokeObjectURL(target.src), 0);
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove ${file.name}`}
                className="absolute right-1 top-1 h-7 w-7 bg-[color:var(--surface)]/85 text-[color:var(--ink)] hover:bg-[color:var(--surface)]"
                onClick={() => removeFile(index)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <p className="truncate px-2 py-1.5 text-[11px] text-muted-foreground">{file.name}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}

function ProfilePhotoUpload({
  file,
  onSelect,
  onRemove,
}: {
  file: File | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!isProfilePhoto(candidate)) {
      setError("Please choose a JPG or PNG image.");
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      setError(`Photo is too large. Maximum ${readableFileSize(MAX_FILE_BYTES)}.`);
      return;
    }
    setError(null);
    onSelect(candidate);
  };

  return (
    <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4">
      <div className="flex items-center gap-4">
        <label
          className={cn(
            "relative grid h-20 w-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-[color:var(--surface-subtle)] text-muted-foreground transition-colors focus-within:ring-2 focus-within:ring-[color:var(--ring)]/40 focus-within:ring-offset-2",
            dragging && "border-[color:var(--ring)] bg-[color:var(--ring)]/[0.05]",
            error && "border-destructive",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            selectFile(event.dataTransfer.files[0]);
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Profile photo preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid justify-items-center gap-1">
              <User className="h-6 w-6" aria-hidden="true" />
              <span className="text-[10px] font-semibold leading-none">Add photo</span>
            </span>
          )}
          <input
            type="file"
            className="sr-only"
            accept={PROFILE_PHOTO_ACCEPT_ATTRIBUTE}
            onChange={(event) => {
              selectFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {file ? (
          <div className="grid min-w-0 gap-1.5">
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => {
                setError(null);
                onRemove();
              }}
            >
              <X className="h-3.5 w-3.5" />
              Remove photo
            </Button>
            <p className="break-all text-xs text-muted-foreground">
              {file.name} ({readableFileSize(file.size)})
            </p>
          </div>
        ) : null}
      </div>
      <div className="grid min-w-0 gap-1.5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Optional — adding a photo makes your profile more personal, easier for parents to
          recognise, and helps build trust. A clear headshot works best.
        </p>
        <p className="text-xs text-muted-foreground">
          JPG or PNG, up to {readableFileSize(MAX_FILE_BYTES)}.
        </p>
        {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

function blankQualification(curriculum = "IBDP"): Qualification {
  return {
    curriculum,
    overall: "",
    boards: [],
    scores: [blankScoreRow(curriculum)],
    best6: "",
  };
}

function blankScoreRow(curriculum: string): ScoreRow {
  const fixedSubject = FIXED_SCORE_SUBJECTS[curriculum];
  if (fixedSubject) {
    const system = getSystem(SYSTEM_IDS[curriculum] ?? "other");
    const paperLabels = isUcatCurriculum(curriculum)
      ? ucatComponentLabels(curriculum)
      : (system?.paperLabels ?? []);
    return {
      subject: fixedSubject,
      grade: "",
      level: "",
      gradeSystem: "",
      papers: paperLabels.map((label) => ({ label, score: "" })),
    };
  }
  return { subject: "", grade: "", level: "", gradeSystem: "", papers: [] };
}

function paperOptions(curriculum: string) {
  if (curriculum === "IBDP")
    return ["Paper 1", "Paper 2", "Paper 3", "Internal Assessment (IA)", "Individual Oral (IO)"];
  if (curriculum === "HKDSE")
    return ["Paper 1", "Paper 2", "Paper 3", "Paper 4", "School-based Assessment (SBA)"];
  if (curriculum === "AP")
    return ["Multiple Choice", "Free Response", "Portfolio / Performance Task"];
  if (curriculum === "SAT") return ["Reading & Writing", "Math"];
  if (curriculum === IELTS_CURRICULUM) return [...IELTS_COMPONENT_LABELS];
  if (curriculum === ISAT_CURRICULUM) return [...ISAT_COMPONENT_LABELS];
  if (isUcatCurriculum(curriculum)) return [...ucatComponentLabels(curriculum)];
  return ["Paper 1", "Paper 2", "Paper 3", "Paper 4", "Coursework"];
}

function Choices({
  options,
  values,
  onToggle,
  hint = "You can choose more than one.",
  invalid,
}: {
  options: readonly string[];
  values: string[];
  onToggle: (value: string) => void;
  hint?: string;
  invalid?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {options.map((option) => (
          <label
            key={option}
            className="flex min-h-11 cursor-pointer items-center gap-2 py-1 text-sm text-foreground"
          >
            <Checkbox
              checked={values.includes(option)}
              onCheckedChange={() => onToggle(option)}
              aria-invalid={invalid || undefined}
              className={invalid ? "border-destructive" : undefined}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      <Hint>{hint}</Hint>
    </div>
  );
}

function SingleChoice({
  options,
  value,
  onChange,
  invalid,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-x-5 gap-y-3">
      {options.map((option) => (
        <Label
          key={option}
          className="flex min-h-11 cursor-pointer items-center gap-2 py-1 text-sm font-normal text-foreground"
        >
          <RadioGroupItem
            value={option}
            aria-invalid={invalid || undefined}
            className={invalid ? "border-destructive" : undefined}
          />
          <span>{option}</span>
        </Label>
      ))}
    </RadioGroup>
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
  invalid,
}: {
  studiedSubjects: string[];
  addedSubjects: string[];
  options: readonly string[];
  onToggle: (subject: string) => void;
  invalid?: boolean;
}) {
  const selectedSubjects = new Set([...studiedSubjects, ...addedSubjects]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[...selectedSubjects].map((subject) => (
          <span
            key={subject}
            className="inline-flex items-center gap-1 rounded-md bg-[color:var(--foreground)]/[0.08] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--ink)]"
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
            className={controlClassName}
            invalid={invalid}
          />
        </div>
      </div>
    </div>
  );
}

type ApplicationBaseState = {
  name: string;
  preferredName: string;
  phone: string;
  email: string;
  photo: File | null;
  country: string;
  countryOther: string;
  graduationYear: string;
  startImmediately: boolean;
  startDate: string;
  status: string;
  statusOther: string;
  medium: string[];
  highSchool: string;
  university: string;
  programme: string;
  hasPostgrad: boolean;
  postgradUniversity: string;
  postgradDegree: string;
  year: string;
  subjectsTaught: string[];
  format: string;
  stations: string[];
  achievements: Achievement[];
  // Issue #97: Trophy Cabinet — local File objects until submit; the consent
  // flag is enforced server-side only when the array is non-empty.
  portfolioImages: File[];
  portfolioConsent: boolean;
  selfIntroduction: string;
  // Issue #199: SEN experience & qualifications (step 5).
  senEnabled: boolean;
  senCategories: string[];
  senExperience: string;
  // Issue #319: two base rates (whole dollars) replace the single
  // "Proposed Hourly Rate" input; rows/notes are profile-only extras.
  onlineRate: string;
  inpersonRate: string;
  // Issue #113: the currency the tutor quotes every pricing field in.
  currency: string;
  rateRows: { label: string; rate: string }[];
  travelNote: string;
  rateNote: string;
  // Issue #191: how many students the tutor can take on, surfaced on the
  // Logistics step and passed through to the admin application email.
  maxStudents: string;
  pricingStandardized: boolean;
  pricingTiers: { curriculum: string; rate: string }[];
  materials: string;
  certificatesLater: boolean;
  commission: boolean;
  privacy: boolean;
  terms: boolean;
  // Issue #214: the terms-gate checkbox (records WHICH ToS version was
  // accepted, server-side, on submit). Same checkbox serves signup and
  // referral_signup — the surface tag is decided server-side by whether the
  // submit arrived through a referrer link.
  termsGate: boolean;
};

type ApplicationDraft = {
  step: number;
  base: ApplicationBaseState;
  roles: string[];
  boards: string[];
  credentials: string[];
  qualifications: Qualification[];
  // Issue #323: smart headline + whether the tutor has manually edited it.
  academicHeadline: string;
  headlineDirty: boolean;
};

export function ApplicationForm() {
  const { t } = useTranslation();
  const senCategoryLabels = useSenCategoryLabels();
  const submit = useServerFn(submitTutorApplication);
  // Referral attribution: an explicit ?ref= wins (last click); otherwise fall
  // back to a code captured earlier on the site (30-day window). The code
  // survives the multi-step wizard and is validated again in the submit payload.
  const [referralCode] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get("ref") ?? "";
    const match = REFERRAL_CODE_PATTERN.exec(raw.trim());
    return match ? match[0] : readStoredReferralCode();
  });
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  // Remembered at submit time so the WhatsApp activation deep link can greet
  // the MatchMax team with the applicant's name.
  const [applicantName, setApplicantName] = useState("");
  // Issue #189: server-assigned application id, surfaced in the WhatsApp
  // activation message so the team can match the chat to the stored row.
  const [applicationRef, setApplicationRef] = useState("");
  // Issue #310: tutor code of the card published at submit (empty when the
  // server could not publish — the success screen hides the card link then).
  const [liveTutorCode, setLiveTutorCode] = useState("");
  // Issue #358: true when submit reused a card that staff have since
  // unpublished — the success screen must not claim the card is live.
  const [unpublishedReuse, setUnpublishedReuse] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaWidget = useRef<string | null>(null);
  const stepperRef = useRef<HTMLDivElement>(null);
  const shouldScrollToStepper = useRef(false);
  const [originStation, setOriginStation] = useState("");
  const [travelBudget, setTravelBudget] = useState("10");
  const [autoStations, setAutoStations] = useState<string[]>([]);
  const [excludedAutoStations, setExcludedAutoStations] = useState<string[]>([]);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "adding" | "done">("idle");
  const [base, setBase] = useState<ApplicationBaseState>({
    name: "",
    preferredName: "",
    phone: "+852 ",
    email: "",
    photo: null,
    country: "Hong Kong",
    countryOther: "",
    graduationYear: "",
    startImmediately: true,
    startDate: "",
    status: "",
    statusOther: "",
    medium: [] as string[],
    highSchool: "",
    university: "",
    programme: "",
    hasPostgrad: false,
    postgradUniversity: "",
    postgradDegree: "",
    year: "",
    subjectsTaught: [] as string[],
    format: "",
    stations: [] as string[],
    achievements: [] as Achievement[],
    portfolioImages: [] as File[],
    portfolioConsent: false,
    selfIntroduction: "",
    senEnabled: false,
    senCategories: [] as string[],
    senExperience: "",
    onlineRate: "",
    inpersonRate: "",
    currency: DEFAULT_CURRENCY,
    rateRows: [] as { label: string; rate: string }[],
    travelNote: "",
    rateNote: "",
    maxStudents: "",
    pricingStandardized: true,
    pricingTiers: [],
    materials: "",
    certificatesLater: false,
    commission: false,
    privacy: false,
    terms: false,
    termsGate: false,
  });
  const [roles, setRoles] = useState<string[]>([]);
  const [boards, setBoards] = useState<string[]>([]);
  const [credentials, setCredentials] = useState<string[]>([]);
  const [removedStudiedSubjects, setRemovedStudiedSubjects] = useState<string[]>([]);
  // Curriculum scope for the "Subjects Willing to Teach" picker — display
  // only; it narrows the suggestion list, never the submitted selection.
  const [taughtCurriculum, setTaughtCurriculum] = useState("");
  const [qualifications, setQualifications] = useState<Qualification[]>([blankQualification()]);
  // Issue #323: smart headline + manual-edit (dirty) flag. Auto-filled from
  // the qualifications while pristine; a manual keystroke freezes it, and
  // clearing the field on blur unfreezes it (see the effect + input handlers).
  const [academicHeadline, setAcademicHeadline] = useState("");
  const [headlineDirty, setHeadlineDirty] = useState(false);
  const professional = base.status === PROFESSIONAL_STATUS;
  const stepTitles = professional ? PROFESSIONAL_STEPS : ACADEMIC_STEPS;
  const primary = qualifications[0];
  // Hotline digits for the Step 2 activation link; fetched once the
  // application is submitted.
  const whatsappDigits = useWhatsAppNumber(done);
  // Issue #189: "Legal Full Name - Preferred Name" when a preferred name is
  // given, plus the application reference so the team can pull up the row.
  const whatsappGreeting = (() => {
    const preferred = base.preferredName.trim();
    const who =
      preferred && preferred.toLowerCase() !== applicantName.toLowerCase()
        ? `${applicantName} - ${preferred}`
        : applicantName;
    const ref = applicationRef ? ` My application reference is ${applicationRef}.` : "";
    return `Hi MatchMax! I have just completed my tutor application. My name is ${who}.${ref}`;
  })();
  const whatsappActivateHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(whatsappGreeting)}`
    : "";

  // Lowest filled base rate, used as the per-curriculum pricing placeholder.
  const filledBaseRates = [base.onlineRate, base.inpersonRate]
    .map((rate) => Number(rate))
    .filter((rate) => Number.isFinite(rate) && rate > 0);
  const rateFloor = filledBaseRates.length ? String(Math.min(...filledBaseRates)) : "";

  function updateRateRow(index: number, patch: Partial<{ label: string; rate: string }>) {
    setBaseField(
      "rateRows",
      base.rateRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }
  function addRateRow() {
    if (base.rateRows.length >= MAX_RATE_ROWS) return;
    setBaseField("rateRows", [...base.rateRows, { label: "", rate: "" }]);
  }
  function removeRateRow(index: number) {
    setBaseField(
      "rateRows",
      base.rateRows.filter((_, rowIndex) => rowIndex !== index),
    );
  }

  const {
    restored: restoredDraft,
    savedAt: draftSavedAt,
    saveDraft,
    clearDraft,
  } = useFormDraft<ApplicationDraft>("tutor-application");
  const draftAppliedRef = useRef(false);
  // Issue #323 review: when a draft restores, the headline-autofill effect can
  // still fire in the SAME effect flush against pre-restore state (dirty flag
  // still false) and queue a setAcademicHeadline(build(oldQuals)) that lands
  // AFTER the restored value — freezing the wrong headline. Suppress that one
  // pass; the next pass runs against the restored state and honours the flag.
  const skipHeadlineAutofillRef = useRef(false);

  useEffect(() => {
    if (!restoredDraft) return;
    draftAppliedRef.current = true;
    skipHeadlineAutofillRef.current = true;
    setBase((prev) => ({
      ...prev,
      ...restoredDraft.base,
      photo: null,
    }));
    if (Array.isArray(restoredDraft.roles)) setRoles(restoredDraft.roles);
    if (Array.isArray(restoredDraft.boards)) setBoards(restoredDraft.boards);
    if (Array.isArray(restoredDraft.credentials)) setCredentials(restoredDraft.credentials);
    if (Array.isArray(restoredDraft.qualifications) && restoredDraft.qualifications.length > 0) {
      setQualifications(
        restoredDraft.qualifications.map((qualification) => ({
          ...qualification,
          scores: Array.isArray(qualification.scores) ? qualification.scores : [],
        })),
      );
    }
    if (typeof restoredDraft.academicHeadline === "string") {
      setAcademicHeadline(restoredDraft.academicHeadline);
      setHeadlineDirty(Boolean(restoredDraft.headlineDirty));
    }
    if (
      typeof restoredDraft.step === "number" &&
      restoredDraft.step >= 1 &&
      restoredDraft.step <= stepTitles.length
    ) {
      setStep(restoredDraft.step);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredDraft]);

  useEffect(() => {
    if (restoredDraft && !draftAppliedRef.current) return;
    saveDraft({
      step,
      base: {
        ...base,
        photo: null,
      },
      roles,
      boards,
      credentials,
      qualifications,
      academicHeadline,
      headlineDirty,
    });
  }, [
    restoredDraft,
    saveDraft,
    step,
    base,
    roles,
    boards,
    credentials,
    qualifications,
    academicHeadline,
    headlineDirty,
  ]);

  // Issue #323: regenerate the smart headline whenever the qualifications
  // change, but only while the tutor has not manually edited it (dirty flag).
  useEffect(() => {
    // Skip the pass queued against pre-restore state (see the ref above).
    if (skipHeadlineAutofillRef.current) {
      skipHeadlineAutofillRef.current = false;
      return;
    }
    if (headlineDirty) return;
    setAcademicHeadline(
      buildAcademicHeadline(
        qualifications.map((qualification) => ({
          curriculum: qualification.curriculum,
          score: qualification.overall,
        })),
      ),
    );
  }, [qualifications, headlineDirty]);

  function changeStep(nextStep: number) {
    shouldScrollToStepper.current = true;
    setStep(nextStep);
  }

  function goToStep(target: number) {
    if (target > step && !validateCurrentStep()) return;
    changeStep(target);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step < stepTitles.length) {
      goToStep(step + 1);
      return;
    }
    void submitForm();
  }

  function scrollToStepperTop() {
    window.requestAnimationFrame(() => {
      const stepperTop = stepperRef.current?.getBoundingClientRect().top;
      if (stepperTop === undefined) return;
      const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      window.scrollTo({ top: window.scrollY + stepperTop - headerHeight, behavior: "smooth" });
    });
  }

  useEffect(() => {
    if (!shouldScrollToStepper.current) return;
    shouldScrollToStepper.current = false;
    scrollToStepperTop();
  }, [step]);

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
    clearFieldError("stations");
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
        qualifications
          .flatMap((qualification) =>
            qualification.scores.map((score) => score.subject.trim()).filter(Boolean),
          )
          .filter((subject) => subject !== IELTS_OVERALL_SUBJECT),
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
    ? "Please note: MatchMax's Professional tier is reserved for highly qualified tutors. Teaching credentials or official examiner letters are required for verification, and your identity, CV, and current employment are kept strictly confidential. For HKDSE, we generally accept candidates with a minimum overall achievement of 30 in Best 5."
    : null;

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
    clearFieldError(key);
  }
  // Issue #113: live ≈HK$ equivalents under each base-rate input (hidden for
  // HKD quoting or before rates load — the note never blocks submission).
  const fxRates = useExchangeRates();
  const onlineRateApprox = approxHkdText(
    Number(base.onlineRate),
    toCurrencyCode(base.currency),
    fxRates,
  );
  const inpersonRateApprox = approxHkdText(
    Number(base.inpersonRate),
    toCurrencyCode(base.currency),
    fxRates,
  );
  function clearFieldError(key: string) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
  function updateQualification(index: number, patch: Partial<Qualification>) {
    setQualifications((previous) =>
      previous.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
    Object.keys(patch).forEach((patchKey) => clearFieldError(`${patchKey}-${index}`));
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
    if (patch.subject !== undefined) clearFieldError(`subject-${qualificationIndex}-${scoreIndex}`);
    if (patch.grade !== undefined) clearFieldError(`grade-${qualificationIndex}-${scoreIndex}`);
  }
  function updateAchievement(index: number, patch: Partial<Achievement>) {
    setBaseField(
      "achievements",
      base.achievements.map((achievement, achievementIndex) =>
        achievementIndex === index ? { ...achievement, ...patch } : achievement,
      ),
    );
    Object.keys(patch).forEach((patchKey) => clearFieldError(`achievement-${patchKey}-${index}`));
  }
  function setCountry(country: string) {
    const dialCode = COUNTRY_DIAL_CODES[country];
    const phoneWithoutDialCode = base.phone.replace(/^\+(?:852|853|86|65|44|61|1)\s*/, "");
    setBase((previous) => ({
      ...previous,
      country,
      phone: dialCode ? `${dialCode} ${phoneWithoutDialCode}`.trimEnd() : phoneWithoutDialCode,
    }));
    clearFieldError("country");
  }

  function validateCurrentStep() {
    const next: Record<string, string> = {};
    const required = (key: string, value: unknown) => {
      if (!value || (Array.isArray(value) && value.length === 0)) next[key] = "Required";
    };
    const rejectContact = (key: string, value: string) => {
      if (next[key]) return;
      const error = contactFilterError(value);
      if (error) next[key] = error;
    };
    if (step === 1) {
      required("name", base.name.trim());
      rejectContact("name", base.name);
      rejectContact("graduationYear", base.graduationYear);
      required("phone", base.phone.trim());
      required("email", base.email.trim());
      required("country", base.country.trim());
      if (base.country === "Other") required("countryOther", base.countryOther.trim());
      required("status", base.status);
      required("medium", base.medium);
      // Issue #361: medium feeds the public languages column — run the same
      // step-level contact filter here that the server schema applies at
      // submit, so the tutor sees the error on the step that caused it.
      const mediumError = contactFilterError(base.medium.join(", "));
      if (mediumError && !next.medium) next.medium = mediumError;
      if (base.status === "Other") required("statusOther", base.statusOther.trim());
      if (!base.startImmediately) {
        required("startDate", base.startDate.trim());
        if (
          !next.startDate &&
          base.startDate.trim() &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(base.startDate.trim()) ||
            base.startDate.trim() < new Date().toISOString().slice(0, 10))
        ) {
          next.startDate = "Pick today or a later date";
        }
      }
      if (!next.phone && base.phone.trim() && !PHONE_REGEX.test(base.phone.trim()))
        next.phone = "Enter a valid phone / WhatsApp number (e.g. +852 9123 4567)";
      if (!next.email && base.email.trim() && !EMAIL_REGEX.test(base.email.trim()))
        next.email = "Enter a valid email address";
      if (professional) {
        required("roles", roles);
        if (roles.includes("Official examiner / moderator")) required("boards", boards);
      }
    }
    if (step === 2) {
      if (professional) required("credentials", credentials);
      else {
        required("highSchool", base.highSchool.trim());
        rejectContact("highSchool", base.highSchool);
        required("year", base.year.trim());
        required("university", base.university.trim());
        required("programme", base.programme.trim());
        if (base.hasPostgrad) {
          required("postgradUniversity", base.postgradUniversity.trim());
          required("postgradDegree", base.postgradDegree.trim());
        }
        qualifications.forEach((qualification, index) => {
          required(`curriculum-${index}`, qualification.curriculum);
          // Issue #323: overall score is optional — never block on a blank.
          if (["A-Level", "IGCSE / GCSE"].includes(qualification.curriculum))
            required(`boards-${index}`, qualification.boards);
        });
      }
      // University / programme are on this step for both paths and are copied
      // onto the public card. Contact text fails here, before submit.
      rejectContact("university", base.university);
      rejectContact("programme", base.programme);
      if (base.hasPostgrad) {
        rejectContact("postgradUniversity", base.postgradUniversity);
        rejectContact("postgradDegree", base.postgradDegree);
      }
      // Issue #323: the headline is required for every path; the shared helper
      // enforces required + max 40 + contact filter in one place (mirrored
      // server-side in the submit schema), per review FE note.
      const headlineError = academicHeadlineError(academicHeadline);
      if (headlineError) next.academicHeadline = headlineError;
    }
    const subjectStep = professional ? 3 : 2;
    if (step === subjectStep) {
      if (professional) required("subjectsTaught", selectedTeachingSubjects);
      else
        qualifications.forEach((qualification, qualificationIndex) =>
          qualification.scores.forEach((score, scoreIndex) => {
            required(`subject-${qualificationIndex}-${scoreIndex}`, score.subject);
            // Issue #323: the grade is optional — only the subject is required.
          }),
        );
    }
    const taughtStep = professional ? 3 : 3;
    if (step === taughtStep) {
      required("subjectsTaught", selectedTeachingSubjects);
      // Issue #361: subjects feed the public card — filter them on-step too.
      const taughtError = contactFilterError(selectedTeachingSubjects.join(", "));
      if (taughtError && !next.subjectsTaught) next.subjectsTaught = taughtError;
    }
    const lessonStep = professional ? 4 : 4;
    if (step === lessonStep) {
      required("format", base.format);
      if (base.format !== "Online") required("stations", base.stations);
      // Issue #361: stations feed the public card — filter them on-step too.
      const stationsError = contactFilterError(base.stations.join(", "));
      if (stationsError && !next.stations) next.stations = stationsError;
    }
    const experienceStep = professional ? 5 : 5;
    if (step === experienceStep) {
      base.achievements.forEach((achievement, index) => {
        required(`achievement-title-${index}`, achievement.title.trim());
        rejectContact(`achievement-title-${index}`, achievement.title);
        required(`achievement-description-${index}`, achievement.description.trim());
        rejectContact(`achievement-description-${index}`, achievement.description);
      });
      // Issue #215: no contact details in the public self-introduction.
      const introError = contactFilterError(base.selfIntroduction);
      if (introError) next.selfIntroduction = introError;
      // Issue #199: at least one SEN category once the SEN toggle is on.
      if (base.senEnabled && base.senCategories.length === 0) {
        next.senCategories = "Select at least one SEN category";
      }
      const senExperienceError = contactFilterError(base.senExperience);
      if (senExperienceError) next.senExperience = senExperienceError;
    }
    const logisticsStep = professional ? 6 : 6;
    if (step === logisticsStep) {
      // Issue #319: two base rates replace the single proposed rate. Which
      // fields are required follows the lesson format; every entered rate
      // must be a whole dollar amount between RATE_MIN and RATE_MAX.
      const checkRate = (key: string, raw: string) => {
        if (!raw) {
          next[key] = "Required";
        } else if (!isValidTutorRate(Number(raw))) {
          next[key] = t("join.rates.invalid");
        }
      };
      if (base.format !== "Face to face") checkRate("onlineRate", base.onlineRate.trim());
      if (base.format !== "Online") checkRate("inpersonRate", base.inpersonRate.trim());
      // Extra rate rows: same shared rules as the server (a row saves only
      // when BOTH label and rate are filled; empty rows are dropped).
      const rateRowCheck = normalizeTutorRateRows(base.rateRows);
      if (!rateRowCheck.ok) next.rateRows = rateRowCheck.errors.join(" ");
      // Travel note only exists when the in-person rate is set.
      if (base.inpersonRate.trim() !== "") {
        const travelError = contactFilterError(base.travelNote);
        if (travelError) next.travelNote = travelError;
      }
      const rateNoteError = contactFilterError(base.rateNote);
      if (rateNoteError) next.rateNote = rateNoteError;
      // Issue #108: with Standardize off, at least one curriculum rate must be
      // filled in and every rate entered must be a positive number.
      if (!base.pricingStandardized) {
        if (base.pricingTiers.length === 0) {
          next.pricingTiers = "Add a rate for at least one curriculum, or turn Standardize on.";
        } else {
          const badTier = base.pricingTiers.some(
            (tier) => !Number.isFinite(Number(tier.rate)) || Number(tier.rate) <= 0,
          );
          if (badTier) next.pricingTiers = "Every curriculum rate must be a positive number.";
        }
      }
      required("materials", base.materials);
    }
    if (step === stepTitles.length) {
      required("commission", base.commission);
      required("privacy", base.privacy);
      required("terms", base.terms);
      // Issue #214: the terms gate must be checked before submit; the server
      // fn independently validates and records the acceptance row.
      required("termsGate", base.termsGate);
      if (!captcha) next.captcha = "Complete the security check.";
    }
    setFieldErrors(next);
    const failed = Object.keys(next).length > 0;
    if (!failed) setError(null);
    if (failed) scrollToStepperTop();
    return !failed;
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
            `${qualification.curriculum}${qualification.overall ? ` (${qualification.overall})` : ""}\n${qualification.scores
              .map((score) => {
                const papers = score.papers.filter((paper) => paper.label && paper.score.trim());
                const paperText = papers.length
                  ? ` (${papers.map((paper) => `${paper.label}: ${paper.score.trim()}`).join(", ")})`
                  : "";
                // Issue #323: grade is optional — render "[Subject] - [Grade]"
                // when filled, just "[Subject]" otherwise.
                return `${score.subject}${score.grade ? ` - ${score.grade}` : ""}${paperText}`;
              })
              .join("\n")}`,
        )
        .join("\n\n");
      const parsed = tutorApplicationSchema.safeParse({
        turnstileToken: captcha,
        name: base.name,
        preferredName: base.preferredName.trim(),
        phone: base.phone,
        email: base.email,
        profilePhoto: base.photo
          ? {
              filename: base.photo.name,
              contentType: base.photo.type,
              size: base.photo.size,
              content: await fileData(base.photo),
            }
          : undefined,
        country: base.country === "Other" ? base.countryOther : base.country,
        graduationYear: base.graduationYear,
        startImmediately: base.startImmediately,
        startDate: base.startImmediately ? "" : base.startDate,
        status: base.status,
        statusOther: base.statusOther,
        professionalRoles: roles,
        examiningBoards: boards,
        teachingQualifications: credentials,
        university: base.university,
        programme: base.programme,
        hasPostgrad: base.hasPostgrad,
        postgradUniversity: base.hasPostgrad ? base.postgradUniversity : "",
        postgradDegree: base.hasPostgrad ? base.postgradDegree : "",
        highSchool: professional ? base.highSchool || "Not provided" : base.highSchool,
        year: base.year.trim(),
        curriculum: primary.curriculum,
        curricula: qualifications.map((qualification) => qualification.curriculum),
        overallScore: professional ? "Not applicable - professional pathway" : primary.overall,
        academicHeadline: academicHeadline.trim(),
        subjectsConfident: selectedTeachingSubjects.join(", "),
        subjectResults: professional
          ? `Professional subjects: ${selectedTeachingSubjects.join(", ")}\n${base.achievements.map((achievement) => achievement.description).join("\n")}`
          : subjectResults,
        awards: "",
        // Issue #309: achievements are TEXT answers only — no evidence files
        // at join time; slips upload per-grade from the profile editor.
        achievements: base.achievements.map((achievement) => ({
          title: achievement.title,
          description: achievement.description,
        })),
        // Issue #97: Trophy Cabinet — files + publication consent (zod enforces
        // consent only when at least one photo is attached).
        portfolioImages: await Promise.all(
          base.portfolioImages.map(async (image) => ({
            filename: image.name,
            contentType: image.type,
            size: image.size,
            content: await fileData(image),
          })),
        ),
        portfolioConsent: base.portfolioConsent,
        // Issue #199: SEN experience & qualifications.
        senEnabled: base.senEnabled,
        senCategories: base.senEnabled ? base.senCategories : [],
        senExperience: base.senEnabled ? base.senExperience.trim() : "",
        experience: base.achievements
          .map((achievement) => `${achievement.title}: ${achievement.description}`)
          .join("\n"),
        selfIntroduction: base.selfIntroduction,
        // Issue #319: two base rates + profile-only extras. hourlyRate is no
        // longer collected — tutor-application.functions.ts derives it from
        // the min of the two base rates before the row is stored.
        onlineRate:
          base.format !== "Face to face" && base.onlineRate.trim() !== ""
            ? Number(base.onlineRate)
            : null,
        inpersonRate:
          base.format !== "Online" && base.inpersonRate.trim() !== ""
            ? Number(base.inpersonRate)
            : null,
        // Issue #113: the quoting currency travels with the stored rates.
        currency: toCurrencyCode(base.currency),
        rateRows: base.rateRows
          .filter((row) => row.label.trim() !== "" && row.rate.trim() !== "")
          .map((row) => ({ label: row.label.trim(), rate: Number(row.rate) })),
        travelNote: base.inpersonRate.trim() !== "" ? base.travelNote.trim() : "",
        rateNote: base.rateNote.trim(),
        // Issue #108: per-curriculum pricing. Standardized (default) sends no
        // tiers; otherwise each row must name a distinct curriculum with a
        // positive integer rate (deduped here so the zod enum + DB stay clean).
        pricingStandardized: base.pricingStandardized,
        pricingTiers: base.pricingStandardized
          ? []
          : [
              ...new Map(
                base.pricingTiers
                  .filter((tier) => tier.curriculum && Number(tier.rate) > 0)
                  .map((tier) => [
                    tier.curriculum,
                    {
                      curriculum: tier.curriculum,
                      rate: Math.round(Number(tier.rate)),
                    },
                  ]),
              ).values(),
            ],
        materials: base.materials,
        format: base.format,
        maxStudents: base.maxStudents,
        locations: base.stations.join(", "),
        medium: base.medium.join(", "),
        notes: "",
        referralCode,
        certificatesLater: base.certificatesLater,
        commissionAck: base.commission,
        privacyAck: base.privacy,
        termsAck: base.terms,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Please check your application.");
        scrollToStepperTop();
        return;
      }
      // Issue #214: the client gate above (validateCurrentStep) only reaches
      // this line with the terms gate checked, so legalAgreed: true is the
      // contract the server fn re-validates before storing anything.
      await submit({ data: { ...parsed.data, legalAgreed: true } }).then((result) => {
        setApplicationRef(result?.applicationId ?? "");
        // Issue #310: the card is published at submit — keep its public path
        // so the success screen can link straight to the live card.
        // Issue #358: a reused card that staff have since unpublished is not
        // live — hide the "View live card" button and swap the success copy
        // to a received-not-live variant (no published-success claim).
        const reusedUnpublished = result?.published === false;
        setUnpublishedReuse(reusedUnpublished);
        setLiveTutorCode(reusedUnpublished ? "" : (result?.tutorCode ?? ""));
        return result;
      });
      clearDraft();
      setApplicantName(base.name.trim());
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Something went wrong. Please try again.",
      );
      scrollToStepperTop();
    } finally {
      setSubmitting(false);
    }
  }

  if (done)
    return (
      <div className="grid gap-6">
        <div className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-8 text-center sm:p-12">
          <CheckCircle2
            className="mx-auto h-12 w-12 text-[color:var(--muted-foreground)]"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-2xl font-bold text-[color:var(--ink)] sm:text-3xl">
            {unpublishedReuse ? t("join.success_unpublished_title") : t("join.success_title")}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {unpublishedReuse ? t("join.success_unpublished_message") : t("join.success_message")}
          </p>
          {liveTutorCode ? (
            <Button
              asChild
              variant="solid"
              size="lg"
              className="mt-6 h-12 rounded-sm bg-[color:var(--ink)] px-8 font-bold text-[color:var(--surface)] hover:opacity-90"
            >
              <Link to="/tutors/$tutorCode" params={{ tutorCode: liveTutorCode }}>
                {t("join.view_live_card")}
              </Link>
            </Button>
          ) : null}
          <p className="mx-auto mt-4 max-w-lg text-xs text-muted-foreground">
            {t("join.manage_hint")}
          </p>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-8 text-center sm:p-12">
          <WhatsAppIcon
            className="mx-auto h-12 w-12 text-[color:var(--brand-whatsapp)]"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-2xl font-bold text-[color:var(--ink)] sm:text-3xl">
            Step 2: Activate Your Application via WhatsApp
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Required. WhatsApp does not let businesses message you first, so your application stays
            inactive until you open the chat. Tap below and send the pre-filled message — it starts
            the thread the MatchMax team will use for all your application updates.
          </p>
          {whatsappActivateHref ? (
            <Button
              asChild
              variant="solid"
              size="lg"
              className="mt-6 h-12 rounded-sm bg-[color:var(--brand-whatsapp)] px-8 font-bold text-white hover:bg-[color:var(--brand-whatsapp-hover)]"
            >
              <a href={whatsappActivateHref} target="_blank" rel="noreferrer">
                <WhatsAppIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                Open WhatsApp
              </a>
            </Button>
          ) : (
            <Button
              variant="solid"
              size="lg"
              disabled
              className="mt-6 h-12 rounded-sm bg-[color:var(--brand-whatsapp)] px-8 font-bold text-white hover:bg-[color:var(--brand-whatsapp-hover)]"
            >
              <WhatsAppIcon className="mr-2 h-5 w-5" aria-hidden="true" />
              Open WhatsApp
            </Button>
          )}
          {applicantName ? (
            <p className="mx-auto mt-5 max-w-md rounded-sm border border-border bg-[color:var(--surface-subtle)] px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              Your message will say: “{whatsappGreeting}”
            </p>
          ) : null}
        </div>
      </div>
    );

  const scoreEditor = (qualification: Qualification, qualificationIndex: number) => {
    const system = getSystem(SYSTEM_IDS[qualification.curriculum] ?? "other");
    const paperScoreOptions = system?.paperScoreOptions;
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
                  : isUcatCurriculum(qualification.curriculum) &&
                      score.subject === UCAT_TOTAL_SUBJECT
                    ? getGradesForSelection(system?.id ?? "other", score.subject).filter(
                        (grade) => Number(grade) <= ucatTotalCap(qualification.curriculum),
                      )
                    : getGradesForSelection(system?.id ?? "other", score.subject);
          const availableSubjects = system?.subjects;
          const isFreeformQualification = qualification.curriculum === "Foundation / other";
          return (
            <div
              key={scoreIndex}
              className="grid gap-3 rounded-sm border border-border/70 p-3 sm:grid-cols-2"
            >
              <div className="grid gap-1.5">
                {isFreeformQualification ? (
                  <Input
                    className={cn(
                      controlClassName,
                      fieldErrors[`subject-${qualificationIndex}-${scoreIndex}`] &&
                        invalidInputClassName,
                    )}
                    aria-invalid={
                      fieldErrors[`subject-${qualificationIndex}-${scoreIndex}`] ? true : undefined
                    }
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
                    className={controlClassName}
                    invalid={Boolean(fieldErrors[`subject-${qualificationIndex}-${scoreIndex}`])}
                  />
                )}
                {fieldErrors[`subject-${qualificationIndex}-${scoreIndex}`] ? (
                  <p className="text-xs font-medium text-destructive">
                    {fieldErrors[`subject-${qualificationIndex}-${scoreIndex}`]}
                  </p>
                ) : null}
              </div>
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
              <div className="grid gap-1.5">
                {isFreeformQualification ? (
                  <Input
                    className={cn(
                      controlClassName,
                      fieldErrors[`grade-${qualificationIndex}-${scoreIndex}`] &&
                        invalidInputClassName,
                    )}
                    aria-invalid={
                      fieldErrors[`grade-${qualificationIndex}-${scoreIndex}`] ? true : undefined
                    }
                    value={score.grade}
                    onChange={(event) =>
                      updateScore(qualificationIndex, scoreIndex, { grade: event.target.value })
                    }
                    placeholder="Grade / result"
                  />
                ) : (
                  <Select
                    value={score.grade}
                    onValueChange={(grade) => {
                      updateScore(qualificationIndex, scoreIndex, { grade });
                      if (FIXED_SCORE_SUBJECTS[qualification.curriculum] === score.subject) {
                        updateQualification(qualificationIndex, { overall: grade });
                      }
                    }}
                    disabled={!score.subject}
                  >
                    <SelectTrigger
                      aria-label="Overall grade"
                      aria-invalid={
                        fieldErrors[`grade-${qualificationIndex}-${scoreIndex}`] ? true : undefined
                      }
                      className={cn(
                        controlClassName,
                        fieldErrors[`grade-${qualificationIndex}-${scoreIndex}`] &&
                          "border-destructive hover:border-destructive focus:border-destructive focus:ring-destructive/30",
                      )}
                    >
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
                {fieldErrors[`grade-${qualificationIndex}-${scoreIndex}`] ? (
                  <p className="text-xs font-medium text-destructive">
                    {fieldErrors[`grade-${qualificationIndex}-${scoreIndex}`]}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2 sm:col-span-2">
                {score.papers.map((paper, paperIndex) => {
                  const componentScoreOptions =
                    system?.paperScoreOptionsFor?.(paper.label) ?? paperScoreOptions;
                  return (
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
                          <SelectTrigger
                            aria-label="Assessment component"
                            className={controlClassName}
                          >
                            <SelectValue placeholder="Choose paper or assessment" />
                          </SelectTrigger>
                          <SelectContent>
                            {paperOptions(qualification.curriculum).map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {componentScoreOptions ? (
                        <Select
                          value={paper.score}
                          onValueChange={(value) =>
                            updateScore(qualificationIndex, scoreIndex, {
                              papers: score.papers.map((item, itemIndex) =>
                                itemIndex === paperIndex ? { ...item, score: value } : item,
                              ),
                            })
                          }
                        >
                          <SelectTrigger aria-label="Component score" className={controlClassName}>
                            <SelectValue
                              placeholder={
                                qualification.curriculum === IELTS_CURRICULUM ? "Band" : "Score"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {componentScoreOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className={controlClassName}
                          value={paper.score}
                          onChange={(event) =>
                            updateScore(qualificationIndex, scoreIndex, {
                              papers: score.papers.map((item, itemIndex) =>
                                itemIndex === paperIndex
                                  ? { ...item, score: event.target.value }
                                  : item,
                              ),
                            })
                          }
                          placeholder={
                            qualification.curriculum === IELTS_CURRICULUM
                              ? "Band (8.0)"
                              : "Specific score (18/25)"
                          }
                        />
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Remove assessment component"
                        onClick={() =>
                          updateScore(qualificationIndex, scoreIndex, {
                            papers: score.papers.filter((_, itemIndex) => itemIndex !== paperIndex),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit rounded-sm"
                  onClick={() =>
                    updateScore(qualificationIndex, scoreIndex, {
                      papers: [...score.papers, { label: "", score: "" }],
                    })
                  }
                >
                  <Plus /> Add component score
                </Button>
              </div>
              {qualification.scores.length > 1 &&
              !FIXED_SCORE_SUBJECTS[qualification.curriculum] ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit rounded-sm"
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
        {!FIXED_SCORE_SUBJECTS[qualification.curriculum] ? (
          <Button
            type="button"
            variant="outline"
            className="w-fit rounded-sm"
            onClick={() =>
              updateQualification(qualificationIndex, {
                scores: [
                  ...qualification.scores,
                  { subject: "", grade: "", level: "", gradeSystem: "", papers: [] },
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
    <form onSubmit={handleSubmit}>
      {notice ? (
        <aside className="mb-8 rounded-lg border border-[color:var(--foreground)]/10 bg-[color:var(--muted)] px-4 py-3 text-sm leading-relaxed text-foreground">
          {notice}
        </aside>
      ) : null}
      <div className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-5 sm:p-8">
        <ol className="mb-8 flex items-center gap-2 sm:gap-3" aria-label="Form progress">
          {stepTitles.map((label, index) => {
            const stepNumber = index + 1;
            const isComplete = stepNumber < step;
            const isCurrent = stepNumber === step;
            return (
              <li key={label} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  disabled={stepNumber >= step}
                  onClick={() => changeStep(stepNumber)}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors",
                    isComplete &&
                      "cursor-pointer border-[color:var(--ink)] bg-[color:var(--ink)] text-white",
                    isCurrent &&
                      "border-[color:var(--ink)] bg-[color:var(--ink)]/[0.06] text-[color:var(--ink)]",
                    !isComplete && !isCurrent && "border-border text-muted-foreground",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={label}
                >
                  {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : stepNumber}
                </button>
                {stepNumber < stepTitles.length ? (
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

        <div ref={stepperRef}>
          {referralCode ? (
            <div className="mb-6 flex items-start gap-2.5 rounded-sm border border-border bg-[color:var(--surface)] px-4 py-3 text-sm leading-relaxed text-muted-foreground">
              <Gift className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Applied with referral code{" "}
                <span className="font-semibold text-[color:var(--ink)]">{referralCode}</span> — they
                earn a 15% reward once you complete your first case.
              </span>
            </div>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium leading-relaxed text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <span>{error}</span>
                {Object.keys(fieldErrors).length > 0 ? (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs font-semibold">
                    {Object.keys(fieldErrors).map((key) => (
                      <li key={key}>{describeFieldError(key)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
          {step === 1 ? (
            <>
              <Heading
                step={1}
                title={professional ? "Basic Details & Professional Status" : "Basic Details"}
              />
              <Field label="Profile Photo" optional className="sm:col-span-2">
                <ProfilePhotoUpload
                  file={base.photo}
                  onSelect={(photo) => setBaseField("photo", photo)}
                  onRemove={() => setBaseField("photo", null)}
                />
                {/* Issue #215: warning only — a photo never blocks the form
                    in v1; contact-in-photo reports go through staff review. */}
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Face or teaching photo only. No contact details in the photo — no phone number,
                  handle, or QR code. Reports are reviewed.
                </p>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid content-start gap-4">
                  <Field label="Full Name" required error={fieldErrors.name}>
                    <Input
                      value={base.name}
                      onChange={(event) => setBaseField("name", event.target.value)}
                      placeholder="Chan Hau Yui Hauzton"
                    />
                  </Field>
                  <Field
                    label="Preferred Name"
                    optional
                    hint="What should we call you on WhatsApp?"
                  >
                    <Input
                      value={base.preferredName}
                      onChange={(event) => setBaseField("preferredName", event.target.value)}
                      placeholder="Hauzton"
                      maxLength={80}
                    />
                  </Field>
                  <Field
                    label="Email"
                    required
                    error={fieldErrors.email}
                    hint="Use an email address you check regularly."
                  >
                    <Input
                      type="email"
                      value={base.email}
                      onChange={(event) => setBaseField("email", event.target.value)}
                      placeholder="hauzton.chan@gmail.com"
                    />
                  </Field>
                  <Field label="Country / Region" required error={fieldErrors.country}>
                    <SearchableSelect
                      value={base.country}
                      onChange={setCountry}
                      options={COUNTRY_OPTIONS}
                      placeholder="Choose country or region"
                      searchPlaceholder="Search countries"
                      emptyText="No matching country. Choose Other."
                      className={controlClassName}
                      invalid={Boolean(fieldErrors.country)}
                    />
                    {base.country === "Other" ? (
                      <div className="mt-2">
                        <Input
                          className={cn(
                            controlClassName,
                            fieldErrors.countryOther && invalidInputClassName,
                          )}
                          aria-invalid={fieldErrors.countryOther ? true : undefined}
                          value={base.countryOther}
                          onChange={(event) => setBaseField("countryOther", event.target.value)}
                          placeholder="Enter country or region"
                        />
                        {fieldErrors.countryOther ? (
                          <p className="mt-1 text-xs font-semibold text-destructive">
                            {fieldErrors.countryOther}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </Field>
                </div>
                <div className="grid content-start gap-4">
                  <Field label="Phone / WhatsApp Number" required error={fieldErrors.phone}>
                    <Input
                      inputMode="tel"
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
                      invalid={Boolean(fieldErrors.medium)}
                    />
                  </Field>
                  <Field label="Graduation Year" error={fieldErrors.graduationYear}>
                    <Input
                      value={base.graduationYear}
                      onChange={(event) => setBaseField("graduationYear", event.target.value)}
                      placeholder="2023"
                    />
                  </Field>
                  <Field
                    label="Earliest Availability"
                    required
                    error={fieldErrors.startDate}
                    hint="Parents see this on your profile — pick when you can truly start."
                  >
                    <SingleChoice
                      options={["Immediately", "From a specific date"]}
                      value={base.startImmediately ? "Immediately" : "From a specific date"}
                      onChange={(value) => {
                        const immediate = value === "Immediately";
                        setBaseField("startImmediately", immediate);
                        if (immediate) setBaseField("startDate", "");
                      }}
                      invalid={Boolean(fieldErrors.startDate)}
                    />
                    {!base.startImmediately ? (
                      <div className="mt-2">
                        <Input
                          type="date"
                          className={cn(
                            controlClassName,
                            fieldErrors.startDate && invalidInputClassName,
                          )}
                          aria-invalid={fieldErrors.startDate ? true : undefined}
                          value={base.startDate}
                          min={new Date().toISOString().slice(0, 10)}
                          onChange={(event) => setBaseField("startDate", event.target.value)}
                        />
                        {fieldErrors.startDate ? (
                          <p className="mt-1 text-xs font-semibold text-destructive">
                            {fieldErrors.startDate}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
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
                      setRoles(
                        status === PROFESSIONAL_STATUS ? ["Official examiner / moderator"] : [],
                      );
                    }}
                    invalid={Boolean(fieldErrors.status)}
                  />
                  {base.status === "Other" ? (
                    <div className="mt-2">
                      <Input
                        className={cn(
                          controlClassName,
                          fieldErrors.statusOther && invalidInputClassName,
                        )}
                        aria-invalid={fieldErrors.statusOther ? true : undefined}
                        value={base.statusOther}
                        onChange={(event) => setBaseField("statusOther", event.target.value)}
                        placeholder="Please specify"
                      />
                      {fieldErrors.statusOther ? (
                        <p className="mt-1 text-xs font-semibold text-destructive">
                          {fieldErrors.statusOther}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {base.status === PROFESSIONAL_STATUS ||
                  roles.includes("Official examiner / moderator") ? (
                    <div className="mt-4">
                      <label className={labelClassName}>
                        Examining Board(s)
                        {fieldErrors.boards ? <RequiredFlag /> : null}
                      </label>
                      <div className="mt-1.5">
                        <Choices
                          options={EXAMINING_BOARD_OPTIONS}
                          values={boards}
                          onToggle={(board) => {
                            setBoards(updateArray(boards, board));
                            clearFieldError("boards");
                          }}
                          invalid={Boolean(fieldErrors.boards)}
                        />
                      </div>
                    </div>
                  ) : null}
                </Field>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Heading
                step={2}
                title={
                  professional ? "Higher Education & Teaching Credentials" : "Academic Background"
                }
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {professional ? (
                  <Field label="Teaching Qualifications" required error={fieldErrors.credentials}>
                    <Choices
                      options={TEACHING_QUALIFICATION_OPTIONS}
                      values={credentials}
                      onToggle={(credential) => {
                        setCredentials(updateArray(credentials, credential));
                        clearFieldError("credentials");
                      }}
                      invalid={Boolean(fieldErrors.credentials)}
                    />
                  </Field>
                ) : (
                  <>
                    <Field
                      label="Secondary School Attended"
                      required
                      error={fieldErrors.highSchool}
                    >
                      <Input
                        value={base.highSchool}
                        onChange={(event) => setBaseField("highSchool", event.target.value)}
                        placeholder="Diocesan Boys' School, 2023"
                      />
                    </Field>
                    <Field label="Current Year of Study" required error={fieldErrors.year}>
                      <Input
                        value={base.year}
                        onChange={(event) => setBaseField("year", event.target.value)}
                        placeholder="Year 1, Year 2, Graduate"
                      />
                    </Field>
                  </>
                )}
                <Field label="University / Institution" required error={fieldErrors.university}>
                  <Input
                    value={base.university}
                    onChange={(event) => setBaseField("university", event.target.value)}
                    placeholder="HKUST"
                  />
                </Field>
                <Field label="Degree / Programme Major" required error={fieldErrors.programme}>
                  <Input
                    value={base.programme}
                    onChange={(event) => setBaseField("programme", event.target.value)}
                    placeholder="BBA Global Business & BSc Computer Science"
                  />
                </Field>
                {!professional ? (
                  <div className="sm:col-span-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--ink)]">
                      <Checkbox
                        checked={base.hasPostgrad}
                        onCheckedChange={(checked) => {
                          setBaseField("hasPostgrad", checked === true);
                          if (!checked) {
                            clearFieldError("postgradUniversity");
                            clearFieldError("postgradDegree");
                          }
                        }}
                      />
                      <span>
                        I hold or am pursuing a Master&apos;s / Postgraduate / Dual Degree
                      </span>
                    </label>
                  </div>
                ) : null}
                {base.hasPostgrad ? (
                  <>
                    <Field
                      label="Postgraduate University / Institution"
                      required
                      error={fieldErrors.postgradUniversity}
                    >
                      <Input
                        value={base.postgradUniversity}
                        onChange={(event) => setBaseField("postgradUniversity", event.target.value)}
                        placeholder="University of Edinburgh"
                      />
                    </Field>
                    <Field
                      label="Postgraduate Degree / Qualification"
                      required
                      error={fieldErrors.postgradDegree}
                    >
                      <Input
                        value={base.postgradDegree}
                        onChange={(event) => setBaseField("postgradDegree", event.target.value)}
                        placeholder="MSc Theoretical Physics"
                      />
                    </Field>
                  </>
                ) : null}
                {!professional ? (
                  <div className="sm:col-span-2">
                    <Hint>
                      Parents and students actively seek alumni from their own secondary schools, or
                      mentors from their dream universities and majors. Accurate details increase
                      your chances of securing a premium case.
                    </Hint>
                    {qualifications.map((qualification, index) => (
                      <div key={index} className="mt-4 rounded-sm border border-border p-4">
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
                                invalid={Boolean(fieldErrors[`curriculum-${index}`])}
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
                                : qualification.curriculum === IELTS_CURRICULUM
                                  ? "Overall Band Score"
                                  : ["IBDP", "SAT", ISAT_CURRICULUM].includes(
                                        qualification.curriculum,
                                      ) || isUcatCurriculum(qualification.curriculum)
                                    ? "Overall Achieved Score"
                                    : "Overall Achieved Grades"
                            }
                            error={fieldErrors[`overall-${index}`]}
                          >
                            <Input
                              type={
                                ["IBDP", "HKDSE", "SAT", ISAT_CURRICULUM].includes(
                                  qualification.curriculum,
                                ) || isUcatCurriculum(qualification.curriculum)
                                  ? "number"
                                  : "text"
                              }
                              value={qualification.overall}
                              onChange={(event) => {
                                const value = event.target.value;
                                const fixedSubject = FIXED_SCORE_SUBJECTS[qualification.curriculum];
                                if (
                                  fixedSubject &&
                                  qualification.scores[0]?.subject === fixedSubject
                                ) {
                                  updateQualification(index, {
                                    overall: value,
                                    scores: qualification.scores.map((score, scoreIndex) =>
                                      scoreIndex === 0 ? { ...score, grade: value } : score,
                                    ),
                                  });
                                  return;
                                }
                                updateQualification(index, { overall: value });
                              }}
                              placeholder={
                                qualification.curriculum === "IBDP"
                                  ? "43"
                                  : qualification.curriculum === "HKDSE"
                                    ? "32"
                                    : qualification.curriculum === "SAT"
                                      ? "1450"
                                      : qualification.curriculum === ISAT_CURRICULUM
                                        ? "165"
                                        : isUcatCurriculum(qualification.curriculum)
                                          ? "2450"
                                          : qualification.curriculum === IELTS_CURRICULUM
                                            ? "8.0"
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
                                invalid={Boolean(fieldErrors[`boards-${index}`])}
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
                        </div>
                        <div className="mt-5 border-t border-border pt-5">
                          <h3 className="text-base font-bold text-[color:var(--ink)]">
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
                      className="mt-4 rounded-sm"
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
                      Did you also complete IGCSE, MYP, IELTS, or another prior qualification?
                      Adding them opens you to a wider pool of potential cases.
                    </Hint>
                  </div>
                ) : null}
              </div>
              {/* Issue #323: required smart headline, auto-filled from the
                  qualifications while pristine; manual edits freeze it. */}
              <div className="mt-4">
                <Field
                  label="Academic Headline"
                  required
                  error={fieldErrors.academicHeadline}
                  hint={`Auto-filled from your qualifications — edit freely. Shown on your public card (${MAX_ACADEMIC_HEADLINE} characters max).`}
                >
                  <Input
                    maxLength={MAX_ACADEMIC_HEADLINE}
                    value={academicHeadline}
                    onChange={(event) => {
                      setAcademicHeadline(event.target.value);
                      setHeadlineDirty(true);
                      if (fieldErrors.academicHeadline) clearFieldError("academicHeadline");
                    }}
                    onBlur={() => {
                      if (academicHeadline.trim() === "") setHeadlineDirty(false);
                    }}
                    placeholder="e.g. IBDP 44/45 or HKDSE Tutor"
                  />
                </Field>
              </div>
              {/* Issue #188: legal-warning card removed by product decision. */}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Heading step={professional ? 3 : 3} title="Subjects Taught" />
              <Field
                label="Curriculum"
                optional
                hint="Narrow the subject list to one curriculum — Primary School, Junior Secondary, or University Admissions & Test Prep (SAT, ACT, IELTS, TOEFL, UCAT, ISAT, personal statement, interview and portfolio support)."
                className="mb-5"
              >
                <SearchableSelect
                  value={taughtCurriculum}
                  onChange={setTaughtCurriculum}
                  options={[
                    { value: "", label: "All curricula" },
                    ...TEACHING_CURRICULA.map((curriculum) => ({
                      value: curriculum.value,
                      label: curriculum.label,
                    })),
                  ]}
                  placeholder="All curricula"
                  searchPlaceholder="Search curriculum..."
                  className={controlClassName}
                />
              </Field>
              <Field
                label="Subjects Willing to Teach"
                required
                hint="Select subjects from your academic profile that you are confident and capable of teaching. You can choose more than one."
                error={fieldErrors.subjectsTaught}
              >
                <SubjectPicker
                  studiedSubjects={allResultSubjects.filter(
                    (subject) => !removedStudiedSubjects.includes(subject),
                  )}
                  addedSubjects={base.subjectsTaught}
                  options={[
                    ...new Set([
                      ...(taughtCurriculum
                        ? getSubjectOptionsForCategory(taughtCurriculum)
                        : DEFAULT_SUBJECT_OPTIONS),
                      ...allResultSubjects,
                    ]),
                  ]}
                  invalid={Boolean(fieldErrors.subjectsTaught)}
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
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Heading step={professional ? 4 : 4} title="Lesson Preferences & Locations" />
              <div className="grid gap-4">
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
                    invalid={Boolean(fieldErrors.format)}
                  />
                </Field>
                {base.format !== "Online" ? (
                  <Field
                    label="Possible Teaching Locations (MTR Network)"
                    required
                    hint="Suggestions use estimated MTR rail and transfer time, not straight-line station distance. Walking time and delays are not included. You can choose more than one station."
                    error={fieldErrors.stations}
                  >
                    <div
                      className={cn(
                        "grid gap-3 rounded-sm border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-4",
                        fieldErrors.stations && "border-destructive",
                      )}
                    >
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <div className="grid gap-2">
                          <label className={labelClassName}>Starting MTR station</label>
                          <SearchableSelect
                            value={originStation}
                            onChange={setOrigin}
                            options={MTR_STATION_OPTIONS}
                            placeholder="Choose your closest station"
                            searchPlaceholder="Search MTR stations"
                            className={controlClassName}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-sm"
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
                        <label className={labelClassName}>Estimated MTR travel time</label>
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
                                "rounded-full border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
                                travelBudget === budget && originStation
                                  ? "border-[color:var(--ink)] bg-[color:var(--surface-invert)] text-[color:var(--surface-invert-fg)]"
                                  : "border-border bg-card text-foreground hover:border-[color:var(--foreground)]/25",
                              )}
                            >
                              Within {budget} min
                            </button>
                          ))}
                        </div>
                      </div>
                      {originStation ? (
                        <p className="text-xs text-muted-foreground">
                          Stations within {travelBudget} minutes of {originStation} are preselected.
                          You can edit the list below.
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
                                ? "animate-pulse text-[color:var(--muted-foreground)]"
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
                      className="overflow-hidden rounded-sm border border-border px-4"
                    >
                      {MTR_LINES.map((line) => (
                        <AccordionItem key={line.id} value={line.id}>
                          <AccordionTrigger className="font-semibold text-foreground hover:no-underline">
                            {line.label} -{" "}
                            {
                              line.stations.filter((station) => base.stations.includes(station))
                                .length
                            }{" "}
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
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Heading step={professional ? 5 : 5} title="Achievements and Experiences" />
              <Hint>
                Achievements and experience are optional. Add only items you would like MatchMax to
                consider. You do not upload any evidence here — grade slips are added later from
                your profile editor, where MatchMax staff review them.
              </Hint>
              <div className="mt-5 grid gap-4">
                {base.achievements.map((achievement, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-sm border border-border p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_auto]"
                  >
                    <Field label="Title" required error={fieldErrors[`achievement-title-${index}`]}>
                      <Input
                        value={achievement.title}
                        onChange={(event) =>
                          updateAchievement(index, { title: event.target.value })
                        }
                        placeholder="Award or role"
                      />
                    </Field>
                    <Field
                      label="Description"
                      required
                      error={fieldErrors[`achievement-description-${index}`]}
                    >
                      <Textarea
                        value={achievement.description}
                        onChange={(event) =>
                          updateAchievement(index, { description: event.target.value })
                        }
                        placeholder="Brief details"
                        aria-invalid={
                          fieldErrors[`achievement-description-${index}`] ? true : undefined
                        }
                        className={cn(
                          "w-full rounded-sm",
                          fieldErrors[`achievement-description-${index}`] &&
                            "border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
                        )}
                      />
                    </Field>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remove achievement"
                      onClick={() =>
                        setBaseField(
                          "achievements",
                          base.achievements.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                {base.achievements.length < MAX_FILES ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit rounded-sm"
                    onClick={() =>
                      setBaseField("achievements", [
                        ...base.achievements,
                        { title: "", description: "" },
                      ])
                    }
                  >
                    <Plus /> Add achievement or experience
                  </Button>
                ) : null}
              </div>
              <div className="mt-6 border-t border-border pt-5">
                {/* Issue #97: optional Trophy Cabinet. Consent appears only
                    after a photo is added; blank section = fully anonymous. */}
                <Field
                  label="Public Portfolio / Award Photos"
                  optional
                  error={fieldErrors.portfolioConsent}
                  className="sm:col-span-2"
                >
                  <TrophyCabinetUpload
                    files={base.portfolioImages}
                    onChange={(images) => setBaseField("portfolioImages", images)}
                  />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Want to stand out to parents? Upload photos of your competition medals,
                    trophies, or teaching certificates.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, or WebP, up to {readableFileSize(MAX_FILE_BYTES)} each, up to{" "}
                    {MAX_PORTFOLIO_FILES} photos. If you prefer to keep your profile 100% anonymous,
                    simply leave this section blank.
                  </p>
                  {base.portfolioImages.length > 0 ? (
                    <label className="mt-2 flex gap-3 text-sm text-muted-foreground">
                      <Checkbox
                        checked={base.portfolioConsent}
                        onCheckedChange={(checked) => {
                          setBaseField("portfolioConsent", checked === true);
                          if (checked) clearFieldError("portfolioConsent");
                        }}
                        aria-invalid={fieldErrors.portfolioConsent ? true : undefined}
                        className={fieldErrors.portfolioConsent ? "border-destructive" : undefined}
                      />
                      <span>
                        I understand that uploading photos here makes them publicly visible on my
                        MatchMax profile, and I consent to their display.
                        {fieldErrors.portfolioConsent ? (
                          <span className="ml-2 align-middle text-xs font-medium text-destructive">
                            Required
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ) : null}
                </Field>
              </div>
              <div className="mt-6 border-t border-border pt-5">
                <Field
                  label="Self-Introduction / 簡介"
                  optional
                  error={fieldErrors.selfIntroduction}
                  hint="Write what the form does not ask: how you teach, who you work well with, results not on the transcript, and any specific service (e.g. IA review). No phone number, email, or social handle — parents reach you through MatchMax. You may write in English, Chinese, or both. Paragraph breaks are kept."
                >
                  <Textarea
                    rows={6}
                    maxLength={2000}
                    value={base.selfIntroduction}
                    onChange={(event) => setBaseField("selfIntroduction", event.target.value)}
                    aria-invalid={fieldErrors.selfIntroduction ? true : undefined}
                    className={cn(
                      "w-full rounded-sm",
                      fieldErrors.selfIntroduction && "border-destructive",
                    )}
                    placeholder={
                      "Hello! I am a current HKU BBA student with 3 years of experience teaching IB and DSE Mathematics.\n\nMy teaching philosophy focuses on breaking down complex concepts into simple, digestible steps. I provide custom notes and past-paper drills, and I am available for questions between lessons.\n\nI successfully helped my last student jump from a Level 4 to a Level 5* in just one semester..."
                    }
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground" aria-live="polite">
                    {base.selfIntroduction.length}/2000
                  </p>
                </Field>
              </div>
              <div className="mt-6 border-t border-border pt-5">
                {/* Issue #199: SEN experience & qualifications. Categories use
                    the shared HK-common vocabulary (src/features/tutors/sen.ts). */}
                <label className="flex cursor-pointer items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-semibold text-[color:var(--ink)]">
                      {t("sen.join_toggle")}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t("sen.join_toggle_hint")}
                    </span>
                  </span>
                  <Checkbox
                    checked={base.senEnabled}
                    onCheckedChange={(checked) => {
                      setBaseField("senEnabled", checked === true);
                      if (checked) clearFieldError("senCategories");
                    }}
                    aria-invalid={fieldErrors.senCategories ? true : undefined}
                    className={fieldErrors.senCategories ? "border-destructive" : undefined}
                  />
                </label>

                {base.senEnabled ? (
                  <div className="mt-4 space-y-4">
                    <div
                      role="group"
                      aria-label={t("sen.categories_aria")}
                      className="space-y-1.5 rounded-sm border border-border p-3"
                    >
                      {SEN_CATEGORY_OPTIONS.map((category) => {
                        const active = base.senCategories.includes(category);
                        return (
                          <label
                            key={category}
                            className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-sm text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.04]"
                          >
                            <Checkbox
                              checked={active}
                              onCheckedChange={(checked) => {
                                setBaseField(
                                  "senCategories",
                                  checked
                                    ? [...base.senCategories, category]
                                    : base.senCategories.filter((item) => item !== category),
                                );
                                if (checked) clearFieldError("senCategories");
                              }}
                              aria-invalid={fieldErrors.senCategories ? true : undefined}
                            />
                            <span className="font-medium">{senCategoryLabels[category]}</span>
                          </label>
                        );
                      })}
                      {fieldErrors.senCategories ? (
                        <p className="text-xs font-medium text-destructive">
                          {fieldErrors.senCategories}
                        </p>
                      ) : null}
                    </div>
                    <Field
                      label={t("sen.experience_label")}
                      optional
                      hint={t("sen.experience_hint")}
                    >
                      <Textarea
                        rows={4}
                        maxLength={2000}
                        value={base.senExperience}
                        onChange={(event) => setBaseField("senExperience", event.target.value)}
                        placeholder={t("sen.experience_placeholder")}
                        className="w-full rounded-sm"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {step === 6 ? (
            <>
              <Heading step={professional ? 6 : 6} title="Logistics & Rate" />
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
              {/* Issue #319: two base rates replace the single proposed rate.
                  Whole dollars only (step=1 blocks decimals at the input);
                  which field is required follows the lesson format.
                  Issue #113: the tutor picks the currency every rate is
                  quoted in; labels + the ≈HK$ note follow it. */}
              <Field label={t("join.rates.currency_label")}>
                <select
                  aria-label={t("join.rates.currency_label")}
                  value={base.currency}
                  onChange={(event) => setBaseField("currency", event.target.value)}
                  className="h-10 w-full max-w-48 rounded-md border border-[color:var(--ink)]/15 bg-transparent px-3 text-sm font-semibold text-[color:var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40"
                >
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t("join.rates.online", { currency: base.currency })}
                  required={base.format !== "Face to face"}
                  error={fieldErrors.onlineRate}
                  hint={onlineRateApprox ? `≈ ${onlineRateApprox} / hr` : undefined}
                >
                  <Input
                    type="number"
                    step={1}
                    min={RATE_MIN}
                    max={RATE_MAX}
                    inputMode="numeric"
                    value={base.onlineRate}
                    onChange={(event) => setBaseField("onlineRate", event.target.value)}
                    placeholder="250"
                  />
                </Field>
                <Field
                  label={t("join.rates.in_person", { currency: base.currency })}
                  required={base.format !== "Online"}
                  error={fieldErrors.inpersonRate}
                  hint={inpersonRateApprox ? `≈ ${inpersonRateApprox} / hr` : undefined}
                >
                  <Input
                    type="number"
                    step={1}
                    min={RATE_MIN}
                    max={RATE_MAX}
                    inputMode="numeric"
                    value={base.inpersonRate}
                    onChange={(event) => setBaseField("inpersonRate", event.target.value)}
                    placeholder="350"
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
                    invalid={Boolean(fieldErrors.materials)}
                  />
                </Field>
              </div>

              {/* Issue #319: optional travel note — only meaningful when the
                  tutor teaches in person. */}
              {base.inpersonRate.trim() !== "" ? (
                <Field
                  label={t("join.rates.travel_note")}
                  optional
                  error={fieldErrors.travelNote}
                  hint={t("join.rates.travel_note_hint")}
                >
                  <Input
                    value={base.travelNote}
                    maxLength={TRAVEL_NOTE_MAX}
                    onChange={(event) => setBaseField("travelNote", event.target.value)}
                    placeholder="Kowloon and Hong Kong Island only"
                  />
                </Field>
              ) : null}

              {/* Issue #319: one optional line about anything that changes the rate. */}
              <Field
                label={t("join.rates.rate_note")}
                optional
                error={fieldErrors.rateNote}
                hint={t("join.rates.rate_note_hint")}
              >
                <Input
                  value={base.rateNote}
                  maxLength={RATE_NOTE_MAX}
                  onChange={(event) => setBaseField("rateNote", event.target.value)}
                  placeholder="+HK$100 for lessons over 30 minutes away"
                />
              </Field>

              {/* Issue #319: optional extra rate rows (profile-only). A row
                  saves only when BOTH the label and the rate are filled. */}
              <div className="rounded-md border border-border p-4">
                <p className="text-sm font-semibold text-foreground">
                  {t("join.rates.rows_label")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("join.rates.rows_hint", { max: MAX_RATE_ROWS })}
                </p>
                <div className="mt-3 grid gap-3">
                  {base.rateRows.map((row, index) => (
                    <div
                      key={index}
                      className="grid gap-2 rounded-sm border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                    >
                      <div className="grid gap-1.5">
                        <Label
                          htmlFor={`rate-row-label-${index}`}
                          className="text-xs font-semibold text-foreground"
                        >
                          {t("join.rates.row_label")}
                        </Label>
                        <Input
                          id={`rate-row-label-${index}`}
                          value={row.label}
                          maxLength={RATE_ROW_LABEL_MAX}
                          onChange={(event) => updateRateRow(index, { label: event.target.value })}
                          placeholder="Small group (2-3 students)"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label
                          htmlFor={`rate-row-rate-${index}`}
                          className="text-xs font-semibold text-foreground"
                        >
                          {t("join.rates.row_rate", { currency: base.currency })}
                        </Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                            {base.currency}
                          </span>
                          <Input
                            id={`rate-row-rate-${index}`}
                            type="number"
                            step={1}
                            min={RATE_MIN}
                            max={RATE_MAX}
                            inputMode="numeric"
                            value={row.rate}
                            onChange={(event) => updateRateRow(index, { rate: event.target.value })}
                            placeholder="200"
                            className="pl-11"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Remove rate row"
                        onClick={() => removeRateRow(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
                {fieldErrors.rateRows ? (
                  <p className="mt-2 text-xs font-medium text-destructive">
                    {fieldErrors.rateRows}
                  </p>
                ) : null}
                {base.rateRows.length < MAX_RATE_ROWS ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-fit rounded-sm"
                    onClick={addRateRow}
                  >
                    <Plus /> {t("join.rates.add_row")}
                  </Button>
                ) : (
                  <p className="mt-3 text-xs font-medium text-muted-foreground">
                    Maximum of {MAX_RATE_ROWS} rate rows reached. Remove one to add another.
                  </p>
                )}
              </div>

              {/* Issue #191: intake asks capacity up front so admin can compare
                  supply against demand without a follow-up email. Optional. */}
              <Field
                label="How many students can you take on at once?"
                hint="Leave blank if you're not sure yet."
              >
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={base.maxStudents}
                  onChange={(event) => setBaseField("maxStudents", event.target.value)}
                  placeholder="2"
                />
              </Field>

              {/* Issue #108: per-curriculum pricing with a Standardize toggle.
                  The proposed hourly rate above stays the base/flat rate shown
                  on search cards; tiers override it per curriculum. */}
              <div className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Per-curriculum pricing</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Charge different rates for different curriculum levels, or keep one flat rate
                      across everything you teach.
                    </p>
                  </div>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 py-1 text-sm text-foreground">
                    <Checkbox
                      checked={base.pricingStandardized}
                      onCheckedChange={(checked) =>
                        setBaseField("pricingStandardized", checked === true)
                      }
                      aria-label="Standardize my hourly rate across all levels"
                    />
                    <span>Standardize my hourly rate across all levels</span>
                  </label>
                </div>
                {!base.pricingStandardized ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground">
                      Enter your rate for each curriculum you completed above. Leave a level blank
                      and we&apos;ll apply your lowest entered rate to it.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {qualifications.map((qualification, index) => (
                        <div key={`${qualification.curriculum}-${index}`} className="space-y-1.5">
                          <Label
                            htmlFor={`tier-rate-${index}`}
                            className="text-xs font-semibold text-foreground"
                          >
                            {qualification.curriculum}
                          </Label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                              HK$
                            </span>
                            <Input
                              id={`tier-rate-${index}`}
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={base.pricingTiers[index]?.rate ?? ""}
                              onChange={(event) => {
                                const rate = event.target.value;
                                setBase((previous) => {
                                  const tiers = [...previous.pricingTiers];
                                  while (tiers.length <= index)
                                    tiers.push({ curriculum: "", rate: "" });
                                  tiers[index] = {
                                    curriculum: qualification.curriculum,
                                    rate,
                                  };
                                  return { ...previous, pricingTiers: tiers };
                                });
                                clearFieldError("pricingTiers");
                              }}
                              placeholder={rateFloor || "450"}
                              className="pl-11 text-sm font-semibold"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {fieldErrors.pricingTiers ? (
                      <p className="mt-2 text-xs font-medium text-destructive">
                        {fieldErrors.pricingTiers}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {step === stepTitles.length ? (
            <>
              <Heading step={stepTitles.length} title="Acknowledgments" />
              <div className="grid gap-5">
                <div className="grid gap-1.5">
                  <label className="flex gap-3 text-sm text-muted-foreground">
                    <Checkbox
                      checked={base.terms}
                      onCheckedChange={(checked) => setBaseField("terms", checked === true)}
                      aria-invalid={fieldErrors.terms ? true : undefined}
                      className={fieldErrors.terms ? "border-destructive" : undefined}
                    />
                    <span>
                      I agree to the MatchMax{" "}
                      <Link
                        className="font-semibold text-[color:var(--brand-link)] underline underline-offset-4"
                        to="/tos"
                        target="_blank"
                      >
                        Terms and Conditions
                      </Link>{" "}
                      and confirm the information I have provided is true and complete.
                      {fieldErrors.terms ? (
                        <span className="ml-2 align-middle text-xs font-medium text-destructive">
                          Required
                        </span>
                      ) : null}
                      {/* Issue #309: verification scope lines — part of the
                          tutor terms consent, in both locales. */}
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
                        {([1, 2, 3, 4] as const).map((line) => (
                          <li key={line}>{t(`join.terms_verification_${line}`)}</li>
                        ))}
                      </ul>
                    </span>
                  </label>
                </div>
                {/* Issue #214: the terms gate — records which ToS version the
                    applicant accepted (server-side) and links the matching,
                    verification and referral sections. */}
                <TermsGateCheckbox
                  checked={base.termsGate}
                  invalid={Boolean(fieldErrors.termsGate)}
                  onCheckedChange={(checked) => setBaseField("termsGate", checked)}
                />
                <div className="grid gap-1.5">
                  <label className="flex gap-3 text-sm text-muted-foreground">
                    <Checkbox
                      checked={base.privacy}
                      onCheckedChange={(checked) => setBaseField("privacy", checked === true)}
                      aria-invalid={fieldErrors.privacy ? true : undefined}
                      className={fieldErrors.privacy ? "border-destructive" : undefined}
                    />
                    <span>
                      {professional
                        ? "I consent to MatchMax using my credentials and CV to verify my professional status, promote my teaches profile, and protect my anonymity."
                        : PRIVACY_TEXT}
                      {fieldErrors.privacy ? (
                        <span className="ml-2 align-middle text-xs font-medium text-destructive">
                          Required
                        </span>
                      ) : null}
                    </span>
                  </label>
                </div>
                <div className="grid gap-1.5">
                  <label className="flex gap-3 text-sm text-muted-foreground">
                    <Checkbox
                      checked={base.commission}
                      onCheckedChange={(checked) => setBaseField("commission", checked === true)}
                      aria-invalid={fieldErrors.commission ? true : undefined}
                      className={fieldErrors.commission ? "border-destructive" : undefined}
                    />
                    <span>
                      {COMMISSION_TEXT}
                      {fieldErrors.commission ? (
                        <span className="ml-2 align-middle text-xs font-medium text-destructive">
                          Required
                        </span>
                      ) : null}
                    </span>
                  </label>
                </div>
                <div ref={captchaRef} className="min-h-[65px]" />
                {captchaError ? (
                  <p className="text-xs font-medium text-destructive" role="alert">
                    {captchaError}
                  </p>
                ) : null}
                {fieldErrors.captcha ? (
                  <p className="text-xs font-medium text-destructive" role="alert">
                    {fieldErrors.captcha}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-sm px-6 font-bold"
              disabled={step === 1 || submitting}
              onClick={() => changeStep(step - 1)}
            >
              <ArrowLeft className="mr-2 h-5 w-5" /> Back
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              variant="solid"
              color="blue"
              className="h-12 rounded-sm px-8 font-bold"
            >
              {submitting ? (
                "Submitting…"
              ) : step < stepTitles.length ? (
                <>
                  Next <ArrowRight className="ml-2 h-5 w-5" />
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" /> Submit application
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Heading({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">Step {step}</p>
      <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)] sm:text-3xl">{title}</h2>
    </div>
  );
}
