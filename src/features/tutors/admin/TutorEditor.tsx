import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Flag,
  Gift,
  GraduationCap,
  Info,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { z } from "zod";
import { Link } from "@tanstack/react-router";

import { ConsolePanel } from "@/components/ui/console-panel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  highSchoolEditorOptions,
  universityEditorOptions,
} from "@/features/tutors/education-filters";
import { Switch } from "@/components/ui/switch";
import { MtrStationMultiSelect, MtrStationSelect } from "@/components/ui/mtr-station-select";
import { getNearestMtrStation, getReachableMtrStations } from "@/features/tutor-application/mtr";
import { TagInput } from "@/components/ui/tag-input";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import {
  deleteTutorProfileImage,
  listTutorProfileImages,
  uploadTutorProfileImage,
  type R2TutorImage,
} from "@/features/tutors/r2.functions";
import {
  ADMISSIONS_SUBCATEGORY_OPTIONS,
  DEFAULT_SUBJECT_OPTIONS as SUBJECT_OPTIONS,
  TEACHING_CURRICULA,
  getSubjectOptionsForCategory,
} from "@/features/tutors/subjects";
import { getCurriculumGroupLabel, getTutorSubjectGroups } from "@/features/tutors/tutor-display";
import { supabase } from "@/integrations/supabase/client";
import {
  IA_EE_TOK_SUPPORT_OPTIONS,
  MAX_PRICING_TIERS,
  MAX_TUTOR_ACHIEVEMENTS,
  MAX_TUTOR_CARD_HIGHLIGHTS,
  TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT,
  TUTOR_CARD_HIGHLIGHT_ROW_LIMIT,
  normalizeTutorCardHighlights,
  type Tutor,
  type IaEeTokSupport,
  type PricingTier,
  type TutorAchievement,
} from "@/features/tutors/queries";
import {
  EXAM_PAPER_LABELS,
  EXAM_SYSTEMS,
  getSystem,
  getGradesForSelection,
  type ExamResult,
  type ExamResultEntry,
} from "@/features/tutors/examSystems";
import { AutofillDialog } from "./AutofillDialog";
import type { TutorAutofillResult } from "./autofill.functions";
import {
  TUTOR_FIELD_FLAG_FIELDS,
  buildFlagSummaryText,
  hasCrucialFieldFlag,
  normalizeFieldFlags,
  stripFlaggedTutorRow,
  type TutorFieldFlags,
} from "../field-flags";

export const TARGET_STUDENT_OPTIONS = [
  "Primary",
  "Junior Secondary",
  "IBDP",
  "IGCSE",
  "HKDSE",
  "A-Level",
  "AP",
  "SAT",
  "Admissions",
  "University",
  "Adult learners",
];

const LANGUAGE_SUGGESTIONS = [
  "English",
  "Cantonese",
  "Mandarin",
  "French",
  "Spanish",
  "German",
  "Japanese",
  "Korean",
];

const paperSchema = z.object({
  label: z.string().trim().max(40),
  score: z.string().trim().max(40),
});

const examEntrySchema = z.object({
  subject: z.string().trim().max(120),
  grade: z.string().trim().max(40),
  papers: z.array(paperSchema).optional(),
});

const examSchema = z.object({
  system: z.string().trim(),
  subjects: z.array(examEntrySchema),
});

const achievementSchema = z.object({
  short_text: z
    .string()
    .trim()
    .min(1, "Achievement highlight is required")
    .max(TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT),
  detail_text: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const TUTOR_STATUS_OPTIONS: {
  value: "uni_student" | "full_part_time_tutor" | "examiner";
  label: string;
}[] = [
  { value: "uni_student", label: "University student" },
  { value: "full_part_time_tutor", label: "Full or part-time tutor" },
  { value: "examiner", label: "Examiner / professional teacher" },
];

export const tutorFormSchema = z.object({
  headline: z.string().trim().max(200).optional().or(z.literal("")),
  card_highlights: z
    .array(z.string().trim().max(TUTOR_CARD_HIGHLIGHT_ROW_LIMIT))
    .max(MAX_TUTOR_CARD_HIGHLIGHTS)
    .refine((values) => values.some((value) => value.trim()), "Add at least one card highlight"),
  subjects: z.array(z.string().trim().min(1).max(80)).min(1, "Pick at least one subject"),
  target_students: z.array(z.string().trim().min(1).max(80)),
  academic_headline: z.string().trim().max(120).optional().or(z.literal("")),
  // Issue #107: undergraduate + optional postgraduate degree history.
  undergrad_university: z.string().trim().max(120).optional().or(z.literal("")),
  undergrad_degree: z.string().trim().max(120).optional().or(z.literal("")),
  undergrad_graduation_year: z.string().trim().max(40).optional().or(z.literal("")),
  has_postgrad: z.boolean(),
  postgrad_university: z.string().trim().max(120).optional().or(z.literal("")),
  postgrad_degree: z.string().trim().max(120).optional().or(z.literal("")),
  secondary_school: z.string().trim().max(120).optional().or(z.literal("")),
  qualifications_summary: z.string().trim().max(1500).optional().or(z.literal("")),
  // Issue #119: tutor-written self-introduction; admins proofread and strip
  // personal contact info before publishing.
  self_introduction: z.string().trim().max(2000).optional().or(z.literal("")),
  stations: z.array(z.string().trim().min(1).max(80)).max(200),
  lesson_mode: z.enum(["online", "in_person", "either"]),
  hourly_rate: z.coerce.number().int().min(0).max(100000),
  pricing_tiers: z
    .array(
      z.object({
        curriculum: z.string().trim().max(80),
        rate: z.coerce.number().int().min(0).max(100000),
      }),
    )
    .max(MAX_PRICING_TIERS),
  photo_url: z.string().trim().max(1000).optional().or(z.literal("")),
  tutor_code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, and dashes only"),
  is_published: z.boolean(),
  // Issue #106: derived availability readiness drives pre-booking badges and
  // public listing; tutors self-serve these fields from their dashboard.
  start_immediately: z.boolean(),
  earliest_start_date: z.string().trim(),
  languages: z.array(z.string().trim().min(1).max(60)),
  gender: z.enum(["male", "female", "other"]),
  tutor_status: z.enum(["uni_student", "full_part_time_tutor", "examiner"]).or(z.literal("")),
  experience_years: z.coerce.number().int().min(0).max(80).optional().or(z.literal("")),
  exam_results: z.array(examSchema).max(3, "Add no more than three exam systems"),
  achievements: z
    .array(achievementSchema)
    .max(MAX_TUTOR_ACHIEVEMENTS, "Add no more than three achievements"),
  ia_ee_tok_support: z.array(z.enum(IA_EE_TOK_SUPPORT_OPTIONS)),
  ia_ee_tok_notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type TutorFormData = z.infer<typeof tutorFormSchema>;

// Drop half-filled rows, dedupe curricula case-insensitively, cheapest first.
export function cleanFormPricingTiers(tiers: TutorFormData["pricing_tiers"]): PricingTier[] {
  const cleaned: PricingTier[] = [];
  const seen = new Set<string>();
  for (const tier of tiers) {
    const curriculum = tier.curriculum.trim();
    if (!curriculum) continue;
    const key = curriculum.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ curriculum, rate: Math.round(tier.rate) });
  }
  return cleaned.sort((a, b) => a.rate - b.rate).slice(0, MAX_PRICING_TIERS);
}

export const emptyTutorForm: TutorFormData = {
  headline: "",
  card_highlights: ["", "", ""],
  subjects: [],
  target_students: [],
  academic_headline: "",
  undergrad_university: "",
  undergrad_degree: "",
  undergrad_graduation_year: "",
  has_postgrad: false,
  postgrad_university: "",
  postgrad_degree: "",
  secondary_school: "",
  qualifications_summary: "",
  self_introduction: "",
  stations: [],
  lesson_mode: "either",
  hourly_rate: 0,
  pricing_tiers: [],
  photo_url: "",
  tutor_code: "",
  is_published: true,
  start_immediately: true,
  earliest_start_date: "",
  languages: ["English", "Cantonese"],
  gender: "female",
  tutor_status: "",
  experience_years: "",
  exam_results: [],
  achievements: [],
  ia_ee_tok_support: [],
  ia_ee_tok_notes: "",
};

export function tutorToFormData(t: Tutor): TutorFormData {
  return {
    headline: t.headline ?? "",
    card_highlights: normalizeTutorCardHighlights(t.card_highlights, t.headline)
      .concat(["", "", ""])
      .slice(0, MAX_TUTOR_CARD_HIGHLIGHTS),
    subjects: t.subjects ?? [],
    target_students: t.target_students ?? [],
    academic_headline: t.academic_headline ?? "",
    undergrad_university: t.undergrad_university ?? "",
    undergrad_degree: t.undergrad_degree ?? "",
    undergrad_graduation_year: t.undergrad_graduation_year ?? "",
    has_postgrad: t.has_postgrad ?? false,
    postgrad_university: t.postgrad_university ?? "",
    postgrad_degree: t.postgrad_degree ?? "",
    secondary_school: t.secondary_school ?? "",
    qualifications_summary: t.qualifications_summary ?? "",
    self_introduction: t.self_introduction ?? "",
    stations: t.stations ?? [],
    lesson_mode: t.lesson_mode ?? "either",
    hourly_rate: t.hourly_rate ?? 0,
    pricing_tiers: (t.pricing_tiers ?? []).slice(0, MAX_PRICING_TIERS),
    photo_url: t.photo_url ?? "",
    tutor_code: t.tutor_code ?? "",
    is_published: t.is_published ?? true,
    start_immediately: t.start_immediately ?? true,
    earliest_start_date: t.earliest_start_date ?? "",
    languages: t.languages ?? ["English"],
    gender: ["male", "female", "other"].includes(
      (t as unknown as { gender?: string | null }).gender ?? "",
    )
      ? (t as unknown as { gender: "male" | "female" | "other" }).gender
      : "female",
    tutor_status: ["uni_student", "full_part_time_tutor", "examiner"].includes(t.tutor_status ?? "")
      ? (t.tutor_status as "uni_student" | "full_part_time_tutor" | "examiner")
      : "",
    experience_years: t.experience_years ?? "",
    exam_results: (t.exam_results ?? []).slice(0, 3).map((r) => ({
      system: r.system ?? "",
      subjects: (r.subjects ?? []).map((s) => ({
        subject: s.subject ?? "",
        grade: s.grade ?? "",
        papers: (s.papers ?? []).map((p) => ({ label: p.label, score: p.score })),
      })),
    })),
    achievements: (t.achievements ?? []).slice(0, MAX_TUTOR_ACHIEVEMENTS).map((a) => ({
      short_text: a.short_text ?? "",
      detail_text: a.detail_text ?? "",
    })),
    ia_ee_tok_support: t.ia_ee_tok_support ?? [],
    ia_ee_tok_notes: t.ia_ee_tok_notes ?? "",
  };
}

export function formDataToPayload(v: TutorFormData) {
  const cleanExams: ExamResult[] = v.exam_results
    .map((r) => ({
      system: r.system,
      subjects: (r.subjects ?? [])
        .map((s) => {
          const papers = (s.papers ?? [])
            .map((p) => ({ label: p.label.trim(), score: p.score.trim() }))
            .filter((p) => p.label && p.score);
          return {
            subject: s.subject.trim(),
            grade: s.grade.trim(),
            ...(papers.length ? { papers } : {}),
          };
        })
        .filter((s) => s.subject),
    }))
    .filter((r) => r.system && r.subjects.length > 0)
    .slice(0, 3);

  const cleanAchievements: TutorAchievement[] = v.achievements
    .map((achievement) => ({
      short_text: achievement.short_text.trim(),
      detail_text: achievement.detail_text?.trim() || undefined,
    }))
    .filter((achievement) => achievement.short_text)
    .slice(0, MAX_TUTOR_ACHIEVEMENTS);

  // Drop half-filled rows, dedupe curricula case-insensitively, cheapest first.
  const cleanPricingTiersResult = cleanFormPricingTiers(v.pricing_tiers);

  return {
    display_name: v.tutor_code.trim(),
    headline:
      v.card_highlights
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" | ") ||
      v.headline?.trim() ||
      null,
    card_highlights: v.card_highlights
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, MAX_TUTOR_CARD_HIGHLIGHTS),
    academic_headline: v.academic_headline?.trim() || null,
    undergrad_university: v.undergrad_university?.trim() || null,
    undergrad_degree: v.undergrad_degree?.trim() || null,
    undergrad_graduation_year: v.undergrad_graduation_year?.trim() || null,
    has_postgrad: v.has_postgrad,
    postgrad_university: v.has_postgrad ? v.postgrad_university?.trim() || null : null,
    postgrad_degree: v.has_postgrad ? v.postgrad_degree?.trim() || null : null,
    secondary_school: v.secondary_school?.trim() || null,
    qualifications_summary: v.qualifications_summary?.trim() || null,
    self_introduction: v.self_introduction?.trim() || null,
    subjects: v.subjects,
    target_students: v.target_students,
    stations:
      v.lesson_mode === "online"
        ? []
        : [...new Set(v.stations.map((station) => station.trim()).filter(Boolean))],
    lesson_mode: v.lesson_mode,
    hourly_rate: v.hourly_rate,
    pricing_tiers: cleanPricingTiersResult,
    photo_url: v.photo_url?.trim() || null,
    tutor_code: v.tutor_code.trim(),
    is_published: v.is_published,
    start_immediately: v.start_immediately,
    earliest_start_date: v.start_immediately ? null : v.earliest_start_date.trim() || null,
    languages: v.languages,
    gender: v.gender,
    tutor_status: v.tutor_status || null,
    experience_years: v.experience_years === "" ? null : Number(v.experience_years),
    exam_results: cleanExams,
    achievements: cleanAchievements,
    ia_ee_tok_support: v.ia_ee_tok_support,
    ia_ee_tok_notes: v.ia_ee_tok_notes?.trim() || null,
  };
}

// Merge an AI autofill suggestion into the current form. Only overwrites a
// field when the suggestion provides a value; photo and publish state are
// never touched.
function mergeAutofillResult(prev: TutorFormData, result: TutorAutofillResult): TutorFormData {
  const examResults = result.exam_results.slice(0, 3).map((r) => ({
    system: r.system,
    subjects: r.subjects.slice(0, 20).map((s) => ({
      subject: s.subject,
      grade: s.grade,
      papers: (s.papers ?? []).map((p) => ({ label: p.label, score: p.score })),
    })),
  }));

  return {
    ...prev,
    tutor_code: result.tutor_code.trim() || prev.tutor_code,
    gender: ["male", "female", "other"].includes(result.gender)
      ? (result.gender as TutorFormData["gender"])
      : prev.gender,
    academic_headline: result.academic_headline || prev.academic_headline,
    undergrad_university: result.undergrad_university || prev.undergrad_university,
    secondary_school: result.secondary_school || prev.secondary_school,
    subjects: result.subjects.length > 0 ? result.subjects.slice(0, 20) : prev.subjects,
    target_students:
      result.target_students.length > 0
        ? result.target_students.slice(0, 10)
        : prev.target_students,
    exam_results: examResults.length > 0 ? examResults : prev.exam_results,
    lesson_mode: ["online", "in_person", "either"].includes(result.lesson_mode)
      ? result.lesson_mode
      : prev.lesson_mode,
    hourly_rate: result.hourly_rate > 0 ? result.hourly_rate : prev.hourly_rate,
    start_immediately: result.start_immediately,
    earliest_start_date: result.start_immediately
      ? ""
      : (result.earliest_start_date ?? prev.earliest_start_date),
    stations:
      result.lesson_mode !== "online" && result.stations.length > 0
        ? [...new Set(result.stations)]
        : prev.stations,
    experience_years:
      result.experience_years !== null && result.experience_years !== undefined
        ? result.experience_years
        : prev.experience_years,
    languages: result.languages.length > 0 ? result.languages.slice(0, 8) : prev.languages,
    card_highlights:
      result.card_highlights.length > 0
        ? result.card_highlights.concat(["", "", ""]).slice(0, MAX_TUTOR_CARD_HIGHLIGHTS)
        : prev.card_highlights,
    qualifications_summary: result.qualifications_summary || prev.qualifications_summary,
    self_introduction: result.self_introduction || prev.self_introduction,
    ia_ee_tok_support:
      result.ia_ee_tok_support.length > 0 ? result.ia_ee_tok_support : prev.ia_ee_tok_support,
    ia_ee_tok_notes: result.ia_ee_tok_notes || prev.ia_ee_tok_notes,
  };
}

// Sub-component: Photo Upload with R2 Library modal / picker
function ModernPhotoUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const listImagesFn = useServerFn(listTutorProfileImages);
  const uploadImageFn = useServerFn(uploadTutorProfileImage);
  const deleteImageFn = useServerFn(deleteTutorProfileImage);
  const [inputValue, setInputValue] = React.useState(value);
  const [showGallery, setShowGallery] = React.useState(false);

  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const {
    data: library = [],
    isLoading: isLibraryLoading,
    isError: isLibraryError,
    error: libraryError,
    refetch: refetchLibrary,
  } = useQuery({
    queryKey: ["admin", "r2", "tutor-images"],
    queryFn: () => listImagesFn({ data: { limit: 40 } }) as Promise<R2TutorImage[]>,
    enabled: showGallery,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
      }
      const base64Data = btoa(binary);
      return uploadImageFn({
        data: {
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64Data,
        },
      }) as Promise<{ key: string; url: string }>;
    },
    onSuccess: async (result) => {
      onChange(result.url);
      setInputValue(result.url);
      toast.success("Profile photo uploaded to R2");
      await refetchLibrary();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const removeFromR2 = useMutation({
    mutationFn: async (item: Pick<R2TutorImage, "key" | "url">) => {
      return deleteImageFn({ data: { key: item.key } });
    },
    onSuccess: async (_, item) => {
      if (value === item.url) {
        onChange("");
        setInputValue("");
      }
      toast.success("Image deleted from storage");
      await refetchLibrary();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleBlur = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !trimmed.match(/^https?:\/\/.+/)) {
      toast.error("Please enter a valid image URL (e.g. https://...)");
      return;
    }
    onChange(trimmed);
  };

  const onFilePick: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file (PNG, JPG, WebP).");
      return;
    }
    upload.mutate(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)]/60">
        <div className="relative group shrink-0">
          {value ? (
            <img
              src={value}
              alt="Avatar preview"
              className="h-20 w-20 rounded-2xl object-cover ring-2 ring-[color:var(--ink)]/10"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[color:var(--ink)]/[0.05] ring-2 ring-dashed ring-[color:var(--ink)]/15 text-[color:var(--ink)]/40">
              <User className="h-9 w-9" />
            </div>
          )}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setInputValue("");
              }}
              aria-label="Remove image"
              className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-1 text-destructive hover:bg-destructive hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 space-y-2.5 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[color:var(--ink)] px-3.5 text-xs font-semibold text-[color:var(--surface)] hover:bg-[color:var(--ink)]/90 transition-colors">
              {upload.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>Upload Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={onFilePick} />
            </label>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowGallery((prev) => !prev)}
              className="h-9 text-xs"
            >
              {showGallery ? "Hide Library" : "Choose from R2 Library"}
            </Button>
          </div>

          <Input
            placeholder="Or paste external image URL (https://...)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleBlur();
              }
            }}
            className="h-8.5 text-xs"
          />
        </div>
      </div>

      {showGallery && (
        <div className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-3 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--ink)]/70">
            <span>R2 Image Library ({library.length})</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void refetchLibrary()}
              className="h-6 text-[11px] px-2"
            >
              Refresh
            </Button>
          </div>

          {isLibraryLoading ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : isLibraryError ? (
            <div className="p-3 text-xs text-destructive bg-destructive/5 rounded-lg border border-destructive/20">
              {(libraryError as Error)?.message || "Failed to load library."}
            </div>
          ) : library.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
              No images in storage. Upload a photo above to populate your library.
            </div>
          ) : (
            <div className="grid max-h-48 grid-cols-4 sm:grid-cols-6 gap-2 overflow-y-auto p-1">
              {library.map((item) => (
                <div key={item.key} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(item.url);
                      setInputValue(item.url);
                    }}
                    className={cn(
                      "overflow-hidden rounded-lg border-2 transition-all block w-full aspect-square",
                      value === item.url
                        ? "border-[color:var(--ring)] ring-2 ring-[color:var(--ring)]/30"
                        : "border-transparent hover:border-[color:var(--ink)]/20",
                    )}
                  >
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    title="Delete permanently from R2"
                    aria-label="Delete image from R2"
                    disabled={removeFromR2.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm("Delete this image from storage permanently?")) {
                        removeFromR2.mutate({ key: item.key, url: item.url });
                      }
                    }}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 rounded-full bg-background/90 p-1 text-destructive hover:bg-destructive hover:text-white transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Section Container Component
function EditorSection({
  icon: Icon,
  title,
  description,
  badge,
  children,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <ConsolePanel id={id} padding="none" className="scroll-mt-24 overflow-hidden">
      <div className="border-b border-[color:var(--ink)]/[0.07] px-6 py-4.5 bg-[color:var(--surface-subtle)]/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--ink)]/[0.06] text-[color:var(--ink)]">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[color:var(--ink)]">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div className="p-6 space-y-6">{children}</div>
    </ConsolePanel>
  );
}

// Field wrapper with label and inline error
function FormField({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-[color:var(--ink)]">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Short preview of a field's current value for the Field Review rows, so the
 * admin can judge each field without scrolling the whole form. Returns null
 * when the field is empty (nothing to review, nothing to flag).
 */
function fieldFlagValuePreview(key: string, form: TutorFormData): string | null {
  switch (key) {
    case "name":
      return form.tutor_code || null;
    case "photo":
      return form.photo_url ? "Photo set" : null;
    case "gender":
      return form.gender === "male" ? "Male" : form.gender === "female" ? "Female" : "Other";
    case "card_highlights": {
      const values = form.card_highlights.map((value) => value.trim()).filter(Boolean);
      return values.length > 0 ? values.join(" | ") : null;
    }
    case "academic_headline":
      return form.academic_headline || null;
    case "undergrad_university":
      return form.undergrad_university || null;
    case "undergrad_degree":
      return form.undergrad_degree || null;
    case "postgrad": {
      if (!form.has_postgrad) return null;
      return [form.postgrad_university, form.postgrad_degree].filter(Boolean).join(" - ") || "Set";
    }
    case "secondary_school":
      return form.secondary_school || null;
    case "bio":
      return form.qualifications_summary || null;
    case "self_introduction":
      return form.self_introduction || null;
    case "achievements": {
      const count = form.achievements.filter((a) => a.short_text.trim()).length;
      return count > 0 ? `${count} achievement${count === 1 ? "" : "s"}` : null;
    }
    case "exam_results": {
      const count = form.exam_results.reduce(
        (sum, result) => sum + result.subjects.filter((s) => s.subject.trim()).length,
        0,
      );
      return count > 0 ? `${count} subject grade${count === 1 ? "" : "s"}` : null;
    }
    case "subjects":
      return form.subjects.length > 0 ? form.subjects.join(", ") : null;
    case "ia_ee_tok":
      return form.ia_ee_tok_support.length > 0 ? form.ia_ee_tok_support.join(", ") : null;
    case "pricing": {
      const tiers = cleanFormPricingTiers(form.pricing_tiers);
      if (tiers.length > 0) {
        return tiers.map((tier) => `${tier.curriculum} HK$${tier.rate}`).join(" · ");
      }
      return form.hourly_rate > 0 ? `HK$${form.hourly_rate}/hr` : null;
    }
    case "languages":
      return form.languages.length > 0 ? form.languages.join(", ") : null;
    case "location":
      if (form.lesson_mode === "online") return "Online only";
      return form.stations.length > 0
        ? `${form.stations.length} MTR station${form.stations.length === 1 ? "" : "s"}`
        : null;
    case "experience_years":
      return form.experience_years === "" ? null : `${form.experience_years} yrs`;
    default:
      return null;
  }
}

interface TutorEditorProps {
  initialData?: Tutor | null;
  onSave: (data: Record<string, unknown> & { id?: string }) => void;
  onCancel: () => void;
  isSaving?: boolean;
  /** Join application to offer as AI autofill source (never prefills the form). */
  applicationId?: string | null;
}

export function TutorEditor({
  initialData,
  onSave,
  onCancel,
  isSaving = false,
  applicationId = null,
}: TutorEditorProps) {
  const [form, setForm] = React.useState<TutorFormData>(() =>
    initialData ? tutorToFormData(initialData) : emptyTutorForm,
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = React.useState<string>("identity");
  const [originStation, setOriginStation] = React.useState(initialData?.stations?.[0] ?? "");
  const [travelBudget, setTravelBudget] = React.useState("20");
  const [locating, setLocating] = React.useState(false);
  const [locationMessage, setLocationMessage] = React.useState("");
  const [suggestionStatus, setSuggestionStatus] = React.useState<"idle" | "adding" | "done">(
    "idle",
  );
  const [addedCount, setAddedCount] = React.useState(0);
  const [autofillOpen, setAutofillOpen] = React.useState(false);
  // Curriculum scoping for the subject picker: pick a curriculum (optionally
  // an admissions sub-category) to narrow the suggestion pool. Selected
  // subjects still live in the flat `subjects` array.
  const [subjectCurriculum, setSubjectCurriculum] = React.useState("");
  const [admissionsSubcategory, setAdmissionsSubcategory] = React.useState("");
  // Issue #125: per-field approval flags. A key present in fieldFlags means
  // the field is flagged (hidden from public surfaces); the internal note per
  // flag lives in flagNotes and is synced to the admin-only
  // tutor_field_flags table by the save mutation.
  const [fieldFlags, setFieldFlags] = React.useState<TutorFieldFlags>(() =>
    initialData ? normalizeFieldFlags(initialData.field_flags) : {},
  );
  const [flagNotes, setFlagNotes] = React.useState<Record<string, string>>({});
  const flaggedFieldCount = Object.keys(fieldFlags).length;
  const hasCrucialFlag = hasCrucialFieldFlag(fieldFlags);

  const isAdmissionsSubjectCurriculum = subjectCurriculum === "Admissions";
  const subjectCurriculumLabel = TEACHING_CURRICULA.find(
    (curriculum) => curriculum.value === subjectCurriculum,
  )?.label;
  const subjectSuggestions = (() => {
    if (!subjectCurriculum) return SUBJECT_OPTIONS;
    if (isAdmissionsSubjectCurriculum && admissionsSubcategory) {
      return getSubjectOptionsForCategory(admissionsSubcategory);
    }
    return getSubjectOptionsForCategory(subjectCurriculum);
  })();
  const selectedSubjectGroups = React.useMemo(
    () => getTutorSubjectGroups({ subjects: form.subjects, exam_results: form.exam_results }),
    [form.subjects, form.exam_results],
  );

  const applyAutofill = (result: TutorAutofillResult) => {
    const snapshot = form;
    setForm((prev) => mergeAutofillResult(prev, result));
    toast.success("AI draft applied to the form", {
      description: "Review every field before saving — you can undo.",
      action: {
        label: "Undo",
        onClick: () => setForm(snapshot),
      },
      duration: 12_000,
    });
  };

  // Referral program (issue #127): identity link + shareable code are managed
  // outside the form payload — they mutate the tutors row directly. Issue #160
  // renames the UI section to "Assigned account" since linking now also
  // unlocks the tutor's own profile editor in dashboard settings.
  const queryClient = useQueryClient();
  const [linkEmail, setLinkEmail] = React.useState("");
  // Issue #160: searchable assignee dropdown. Admin-only RPC resolves
  // emails + display names out of auth.users as the admin types.
  const [accountSearch, setAccountSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(accountSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [accountSearch]);
  const accountOptionsQuery = useQuery({
    queryKey: ["admin", "account-search", debouncedSearch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_accounts_for_assignment", {
        _search: debouncedSearch,
      });
      if (error) throw error;
      return data as { id: string; email: string | null; display_name: string | null }[];
    },
    enabled: debouncedSearch.length >= 2,
  });
  const accountOptions = (accountOptionsQuery.data ?? []).map((account) => ({
    value: account.id,
    label: account.email ?? account.id,
    description: account.display_name ?? undefined,
  }));
  const tutorReferralQuery = useQuery({
    queryKey: ["admin", "tutor-referral", initialData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(
          `id, referral_code, user_id,
           referrer:tutors!tutors_referred_by_fkey(id, tutor_code, display_name)`,
        )
        .eq("id", initialData!.id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        referral_code: string | null;
        user_id: string | null;
        referrer: { id: string; tutor_code: string; display_name: string } | null;
      } | null;
    },
    enabled: Boolean(initialData?.id),
  });

  // Internal flag notes (issue #125) live in the admin-only
  // tutor_field_flags table, separate from the public tutors row.
  const tutorFlagNotesQuery = useQuery({
    queryKey: ["admin", "tutor-field-flags", initialData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_field_flags")
        .select("field, note")
        .eq("tutor_id", initialData!.id);
      if (error) throw error;
      return data as { field: string; note: string }[];
    },
    enabled: Boolean(initialData?.id),
  });

  React.useEffect(() => {
    if (!tutorFlagNotesQuery.data) return;
    setFlagNotes(
      Object.fromEntries(tutorFlagNotesQuery.data.map((row) => [row.field, row.note] as const)),
    );
  }, [tutorFlagNotesQuery.data]);

  const toggleFieldFlag = (key: string, flagged: boolean) => {
    const next = { ...fieldFlags };
    if (flagged) {
      next[key] = { at: new Date().toISOString() };
    } else {
      delete next[key];
    }
    setFieldFlags(next);
    // Crucial rejection logic (issue #125): a flagged crucial field forces
    // the whole profile out of the public directory immediately.
    if (flagged && hasCrucialFieldFlag(next) && form.is_published) {
      setForm({ ...form, is_published: false });
      toast.warning("Crucial field flagged — this profile is now Hidden / Action Required.");
    }
  };

  const copyFlagSummary = async () => {
    const text = buildFlagSummaryText(
      initialData?.tutor_code || form.tutor_code,
      fieldFlags,
      flagNotes,
    );
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Flagged-field summary copied — ready to paste into WhatsApp");
    } catch {
      toast.error("Could not access the clipboard");
    }
  };

  const linkAccount = useMutation({
    // Issue #160: the dropdown resolves the user id via
    // list_accounts_for_assignment; the email path stays as a fallback.
    mutationFn: async ({ email, userId }: { email?: string; userId?: string }) => {
      let resolvedUserId = userId ?? null;
      if (!resolvedUserId) {
        if (!email) throw new Error("Pick an account or enter an email.");
        const { data: rpcUserId, error: rpcError } = await supabase.rpc("find_user_id_by_email", {
          _email: email.trim(),
        });
        if (rpcError) throw rpcError;
        if (!rpcUserId) {
          throw new Error("No MatchMax account found with that email.");
        }
        resolvedUserId = rpcUserId;
      }
      const { error } = await supabase
        .from("tutors")
        .update({ user_id: resolvedUserId } as never)
        .eq("id", initialData!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        "Account assigned — the tutor can now edit their profile from dashboard settings",
      );
      setLinkEmail("");
      setAccountSearch("");
      void queryClient.invalidateQueries({
        queryKey: ["admin", "tutor-referral", initialData?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkAccount = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tutors")
        .update({ user_id: null } as never)
        .eq("id", initialData!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account unlinked");
      void queryClient.invalidateQueries({
        queryKey: ["admin", "tutor-referral", initialData?.id],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const locateOrigin = () => {
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
        setOriginStation(station);
        setLocationMessage(`Nearest station found: ${station}`);
      },
      () => {
        setLocating(false);
        setLocationMessage("Location permission was unavailable. Choose a station manually.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const addTravelSuggestions = () => {
    if (!originStation) return;
    setSuggestionStatus("adding");
    const reachable = getReachableMtrStations(originStation, Number(travelBudget));
    setForm((prev) => ({ ...prev, stations: [...new Set([...prev.stations, ...reachable])] }));
    setAddedCount(reachable.length);
    window.setTimeout(() => setSuggestionStatus("done"), 150);
  };

  // Track if form has changed
  const isEditing = Boolean(initialData);

  // Live preview tutor object
  const previewTutor = React.useMemo<Tutor>(
    () => ({
      id: initialData?.id ?? "preview-tutor",
      created_at: initialData?.created_at ?? new Date().toISOString(),
      display_name: form.tutor_code.trim() || "MM-PREVIEW",
      headline:
        form.card_highlights
          .map((value) => value.trim())
          .filter(Boolean)
          .join(" | ") ||
        form.headline?.trim() ||
        null,
      card_highlights: form.card_highlights
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, MAX_TUTOR_CARD_HIGHLIGHTS),
      academic_headline: form.academic_headline?.trim() || null,
      undergrad_university: form.undergrad_university?.trim() || null,
      undergrad_degree: form.undergrad_degree?.trim() || null,
      undergrad_graduation_year: form.undergrad_graduation_year?.trim() || null,
      has_postgrad: form.has_postgrad,
      postgrad_university: form.has_postgrad ? form.postgrad_university?.trim() || null : null,
      postgrad_degree: form.has_postgrad ? form.postgrad_degree?.trim() || null : null,
      secondary_school: form.secondary_school?.trim() || null,
      target_students: form.target_students,
      qualifications_summary: form.qualifications_summary?.trim() || null,
      self_introduction: form.self_introduction?.trim() || null,
      subjects: form.subjects,
      district: null,
      stations: form.lesson_mode === "online" ? [] : form.stations,
      gender: form.gender,
      tutor_status: form.tutor_status || null,
      lesson_mode: form.lesson_mode,
      hourly_rate: Number.isFinite(form.hourly_rate) ? form.hourly_rate : 0,
      pricing_tiers: cleanFormPricingTiers(form.pricing_tiers),
      photo_url: form.photo_url?.trim() || null,
      tutor_code: form.tutor_code.trim() || "MM-PREVIEW",
      is_published: form.is_published,
      start_immediately: form.start_immediately,
      earliest_start_date: form.start_immediately ? null : form.earliest_start_date || null,
      experience_years: form.experience_years === "" ? null : Number(form.experience_years),
      languages: form.languages,
      exam_results: form.exam_results
        .map((result) => ({
          system: result.system,
          subjects: result.subjects
            .map((s) => ({ subject: s.subject.trim(), grade: s.grade.trim() }))
            .filter((s) => s.subject),
        }))
        .filter((result) => result.system && result.subjects.length > 0),
      achievements: form.achievements
        .map((a) => ({
          short_text: a.short_text.trim(),
          detail_text: a.detail_text?.trim() || undefined,
        }))
        .filter((a) => a.short_text),
      ia_ee_tok_support: form.ia_ee_tok_support,
      ia_ee_tok_notes: form.ia_ee_tok_notes?.trim() || null,
      field_flags: fieldFlags,
      // Issue #103: admin editor doesn't manage capacity; defaults reflect a
      // live tutor until the tutor sets their own via the dashboard.
      remaining_student_slots: initialData?.remaining_student_slots ?? 2,
      is_accepting_students: initialData?.is_accepting_students ?? true,
      preferred_time_windows: initialData?.preferred_time_windows ?? [],
    }),
    [
      form,
      initialData?.id,
      initialData?.created_at,
      initialData?.remaining_student_slots,
      initialData?.is_accepting_students,
      initialData?.preferred_time_windows,
      fieldFlags,
    ],
  );

  // "Matches student view": the preview card renders exactly what the public
  // fetchers would return, with flagged fields stripped.
  const previewTutorPublic = React.useMemo(
    () => stripFlaggedTutorRow(previewTutor),
    [previewTutor],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = tutorFormSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
      setErrors(errs);
      toast.error("Please resolve highlighted form errors.");
      return;
    }

    const publishErrors: Record<string, string> = {};
    if (parsed.data.is_published) {
      if (
        !(parsed.data.academic_headline ?? "").trim() &&
        !(parsed.data.undergrad_university ?? "").trim() &&
        !(parsed.data.secondary_school ?? "").trim()
      ) {
        publishErrors.academic_headline =
          "Add an academic headline, undergraduate university, or secondary school before publishing.";
      }
      if (
        !(parsed.data.qualifications_summary ?? "").trim() &&
        parsed.data.experience_years === ""
      ) {
        publishErrors.qualifications_summary = "Add bio or experience before publishing.";
      }
      if (parsed.data.lesson_mode !== "online" && parsed.data.stations.length === 0) {
        publishErrors.stations =
          "Select at least one MTR station for in-person or hybrid tutoring.";
      }
      if (
        !parsed.data.start_immediately &&
        !/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.earliest_start_date)
      ) {
        publishErrors.earliest_start_date =
          "Pick the earliest date you can start, or switch to available immediately.";
      }
    }

    if (Object.keys(publishErrors).length > 0) {
      setErrors(publishErrors);
      toast.error("Complete required fields for published tutors.");
      return;
    }

    // Crucial rejection logic (issue #125): publishing is blocked while any
    // crucial field is flagged, whatever the visibility select says.
    if (hasCrucialFlag && parsed.data.is_published) {
      parsed.data.is_published = false;
      toast.warning("A crucial field is flagged — the profile stays Hidden / Action Required.");
    }

    setErrors({});
    const payload = formDataToPayload(parsed.data);
    onSave({
      ...payload,
      ...(initialData ? { id: initialData.id } : {}),
      field_flags: fieldFlags,
      field_flag_notes: flagNotes,
    });
  };

  // Exam Builders
  const addExamSystem = () => {
    if (form.exam_results.length >= 2) return;
    setForm((prev) => ({
      ...prev,
      exam_results: [
        ...prev.exam_results,
        { system: "ib", subjects: [{ subject: "", grade: "" }] },
      ],
    }));
  };

  const updateExamSystem = (index: number, system: string) => {
    setForm((prev) => {
      const copy = [...prev.exam_results];
      copy[index] = { system, subjects: [{ subject: "", grade: "" }] };
      return { ...prev, exam_results: copy };
    });
  };

  const removeExamSystem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      exam_results: prev.exam_results.filter((_, idx) => idx !== index),
    }));
  };

  // Pricing tier rows
  const addPricingTier = () => {
    setForm((prev) => ({
      ...prev,
      pricing_tiers: [
        ...prev.pricing_tiers,
        { curriculum: "", rate: Number.isFinite(prev.hourly_rate) ? prev.hourly_rate : 0 },
      ],
    }));
  };

  const updatePricingTier = (
    index: number,
    patch: Partial<TutorFormData["pricing_tiers"][number]>,
  ) => {
    setForm((prev) => {
      const tiers = [...prev.pricing_tiers];
      tiers[index] = { ...tiers[index], ...patch };
      return { ...prev, pricing_tiers: tiers };
    });
  };

  const removePricingTier = (index: number) => {
    setForm((prev) => ({
      ...prev,
      pricing_tiers: prev.pricing_tiers.filter((_, idx) => idx !== index),
    }));
  };

  const addSubjectToExam = (examIndex: number) => {
    setForm((prev) => {
      const copy = [...prev.exam_results];
      copy[examIndex] = {
        ...copy[examIndex],
        subjects: [...copy[examIndex].subjects, { subject: "", grade: "" }],
      };
      return { ...prev, exam_results: copy };
    });
  };

  const updateExamSubject = (
    examIndex: number,
    subjectIndex: number,
    patch: Partial<ExamResultEntry>,
  ) => {
    setForm((prev) => {
      const copy = [...prev.exam_results];
      const subs = [...copy[examIndex].subjects];
      const current = subs[subjectIndex];
      if (patch.subject && patch.subject !== current.subject) {
        subs[subjectIndex] = { ...current, ...patch, grade: "" };
      } else {
        subs[subjectIndex] = { ...current, ...patch };
      }
      copy[examIndex] = { ...copy[examIndex], subjects: subs };
      return { ...prev, exam_results: copy };
    });
  };

  const removeExamSubject = (examIndex: number, subjectIndex: number) => {
    setForm((prev) => {
      const copy = [...prev.exam_results];
      const subs = copy[examIndex].subjects.filter((_, idx) => idx !== subjectIndex);
      copy[examIndex] = {
        ...copy[examIndex],
        subjects: subs.length ? subs : [{ subject: "", grade: "" }],
      };
      return { ...prev, exam_results: copy };
    });
  };

  const toggleIaEeTok = (item: IaEeTokSupport, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      ia_ee_tok_support: checked
        ? Array.from(new Set([...prev.ia_ee_tok_support, item]))
        : prev.ia_ee_tok_support.filter((val) => val !== item),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[color:var(--ink)]/10">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="rounded-xl h-10 w-10 text-muted-foreground hover:text-[color:var(--ink)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ink)]">
                {isEditing ? `Edit Tutor — ${initialData?.tutor_code}` : "New Tutor Profile"}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                  hasCrucialFlag
                    ? "bg-destructive/10 text-destructive"
                    : form.is_published
                      ? "bg-[color:var(--foreground)]/[0.06] text-[color:var(--foreground)]"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {hasCrucialFlag
                  ? "Hidden · Action Required"
                  : form.is_published
                    ? "Published"
                    : "Draft / Hidden"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure public credentials, subjects, exam breakdown, and booking logistics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAutofillOpen(true)}
            className="h-9 text-xs font-bold"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            AI Autofill
          </Button>
          {isEditing && initialData?.tutor_code && (
            <Button variant="outline" size="sm" asChild className="text-xs h-9">
              <Link
                to="/tutors/$tutorCode"
                params={{ tutorCode: initialData.tutor_code }}
                target="_blank"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Live Page
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-9 font-bold text-xs"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {isEditing ? "Save Changes" : "Create Profile"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 items-start lg:grid-cols-[minmax(0,1fr)_calc((100vw_-_96px)/3_+_32px)] xl:grid-cols-[minmax(0,1fr)_427px]">
          {/* Left: Sections Canvas */}
          <div className="space-y-8">
            {/* 1. Identity & Credentials */}
            <EditorSection
              icon={User}
              title="Identity & Media"
              description="Basic profile identification and photo. Card highlights are edited in their own section below."
              id="identity"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  label="Tutor Code"
                  required
                  error={errors.tutor_code}
                  hint="Unique slug (e.g. MM-1042)"
                >
                  <Input
                    value={form.tutor_code}
                    onChange={(e) => setForm({ ...form, tutor_code: e.target.value })}
                    placeholder="MM-1042"
                    className="font-mono uppercase font-semibold tracking-wide"
                  />
                </FormField>

                <FormField label="Gender" required error={errors.gender}>
                  <SearchableSelect
                    value={form.gender}
                    onChange={(v) => setForm({ ...form, gender: v as "male" | "female" | "other" })}
                    options={[
                      { value: "female", label: "Female" },
                      { value: "male", label: "Male" },
                      { value: "other", label: "Other" },
                    ]}
                    placeholder="Select gender"
                  />
                </FormField>

                <FormField label="Tutor Status" error={errors.tutor_status}>
                  <SearchableSelect
                    value={form.tutor_status}
                    onChange={(v) =>
                      setForm({ ...form, tutor_status: v as TutorFormData["tutor_status"] })
                    }
                    options={TUTOR_STATUS_OPTIONS}
                    placeholder="Not set"
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  label="Academic Headline"
                  error={errors.academic_headline}
                  hint="IBDP 45 / 45 | AP"
                >
                  <Input
                    value={form.academic_headline}
                    onChange={(e) => setForm({ ...form, academic_headline: e.target.value })}
                    placeholder="e.g. IBDP 44/45 or HKDSE Best 5: 32"
                  />
                </FormField>

                <FormField
                  label="Undergraduate University"
                  error={errors.undergrad_university}
                  hint="Search or add — e.g. The University of Hong Kong"
                >
                  <SearchableSelect
                    value={form.undergrad_university ?? ""}
                    onChange={(v) => setForm({ ...form, undergrad_university: v })}
                    options={universityEditorOptions(form.undergrad_university)}
                    placeholder="e.g. The University of Hong Kong"
                    searchPlaceholder="Search universities…"
                    emptyText="No university found — keep typing to add it"
                    allowCustom
                  />
                </FormField>

                <FormField
                  label="Secondary School"
                  error={errors.secondary_school}
                  hint="Search or add — e.g. Diocesan Boys' School"
                >
                  <SearchableSelect
                    value={form.secondary_school ?? ""}
                    onChange={(v) => setForm({ ...form, secondary_school: v })}
                    options={highSchoolEditorOptions(form.secondary_school)}
                    placeholder="e.g. Diocesan Boys' School"
                    searchPlaceholder="Search schools…"
                    emptyText="No school found — keep typing to add it"
                    allowCustom
                  />
                </FormField>

                <FormField
                  label="Undergraduate Degree"
                  error={errors.undergrad_degree}
                  hint="Degree / programme major"
                >
                  <Input
                    value={form.undergrad_degree}
                    onChange={(e) => setForm({ ...form, undergrad_degree: e.target.value })}
                    placeholder="e.g. BSc Theoretical Physics"
                  />
                </FormField>

                <FormField label="Graduation Year" error={errors.undergrad_graduation_year}>
                  <Input
                    value={form.undergrad_graduation_year}
                    onChange={(e) =>
                      setForm({ ...form, undergrad_graduation_year: e.target.value })
                    }
                    placeholder="e.g. 2023"
                  />
                </FormField>
              </div>

              <div className="rounded-sm border border-border p-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                  <Checkbox
                    checked={form.has_postgrad}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, has_postgrad: checked === true })
                    }
                  />
                  <span>Master&apos;s / Postgraduate / Dual Degree</span>
                </label>
                {form.has_postgrad ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Postgraduate University"
                      error={errors.postgrad_university}
                      hint="Search or add — shown abbreviated on cards"
                    >
                      <SearchableSelect
                        value={form.postgrad_university ?? ""}
                        onChange={(v) => setForm({ ...form, postgrad_university: v })}
                        options={universityEditorOptions(form.postgrad_university)}
                        placeholder="e.g. University of Edinburgh"
                        searchPlaceholder="Search universities…"
                        emptyText="No university found — keep typing to add it"
                        allowCustom
                      />
                    </FormField>
                    <FormField
                      label="Postgraduate Degree"
                      error={errors.postgrad_degree}
                      hint="Cards abbreviate to MSc / MA / PhD etc."
                    >
                      <Input
                        value={form.postgrad_degree}
                        onChange={(e) => setForm({ ...form, postgrad_degree: e.target.value })}
                        placeholder="e.g. MSc Theoretical Physics"
                      />
                    </FormField>
                  </div>
                ) : null}
              </div>

              <FormField label="Profile Photo" error={errors.photo_url}>
                <ModernPhotoUpload
                  value={form.photo_url ?? ""}
                  onChange={(url) => setForm({ ...form, photo_url: url })}
                />
              </FormField>

              <FormField
                label="Earliest Availability"
                hint="Drives the pre-booking badge and hides the tutor from public browse beyond 30 days out."
              >
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={form.start_immediately ? "immediate" : "date"}
                  onValueChange={(val) => {
                    if (!val) return;
                    setForm({
                      ...form,
                      start_immediately: val === "immediate",
                      earliest_start_date: val === "immediate" ? "" : form.earliest_start_date,
                    });
                  }}
                >
                  <ToggleGroupItem value="immediate" className="text-xs">
                    Available immediately
                  </ToggleGroupItem>
                  <ToggleGroupItem value="date" className="text-xs">
                    From a specific date
                  </ToggleGroupItem>
                </ToggleGroup>
              </FormField>

              {!form.start_immediately ? (
                <FormField
                  label="Earliest Start Date"
                  required
                  error={errors.earliest_start_date}
                  className="sm:max-w-xs"
                >
                  <Input
                    type="date"
                    value={form.earliest_start_date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setForm({ ...form, earliest_start_date: e.target.value })}
                  />
                </FormField>
              ) : null}
            </EditorSection>

            {/* Referral program */}
            <EditorSection
              icon={Gift}
              title="Referral Program"
              description="Every tutor gets a unique shareable link automatically. Manage the code and referrer attribution here."
              id="referral"
            >
              {!initialData ? (
                <p className="text-sm text-muted-foreground">
                  The referral code is generated when the profile is created. Save the tutor first,
                  then manage referrals here.
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-4">
                      <p className="text-xs font-medium text-[color:var(--ink)]/60">
                        Referral code
                      </p>
                      <p className="mt-1 font-mono text-lg font-bold text-[color:var(--ink)]">
                        {tutorReferralQuery.data?.referral_code ?? "—"}
                      </p>
                      {tutorReferralQuery.data?.referral_code ? (
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          matchmax.hk/join?ref={tutorReferralQuery.data.referral_code}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-4">
                      <p className="text-xs font-medium text-[color:var(--ink)]/60">Referred by</p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--ink)]">
                        {tutorReferralQuery.data?.referrer
                          ? `${tutorReferralQuery.data.referrer.display_name} (${tutorReferralQuery.data.referrer.tutor_code})`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </EditorSection>

            {/* Assigned account (issue #160): GitHub-style assignee. Links a
                MatchMax account to this card — unlocks the Referrals & Rewards
                tab AND the tutor's own profile editor in dashboard settings. */}
            <EditorSection
              icon={UserCheck}
              title="Assigned Account"
              description="Link the tutor's MatchMax account to this profile. Once assigned, they can view and edit their profile from dashboard settings."
              id="assigned-account"
            >
              {!initialData ? (
                <p className="text-sm text-muted-foreground">
                  Save the tutor first, then assign their account here.
                </p>
              ) : (
                <div>
                  <Label className="text-sm font-bold text-[color:var(--ink)]">
                    Assigned account
                  </Label>
                  {tutorReferralQuery.data?.user_id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]">
                        <UserCheck className="h-4 w-4" aria-hidden="true" />
                        Assigned — this tutor can edit their profile in dashboard settings.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={unlinkAccount.isPending}
                        onClick={() => unlinkAccount.mutate()}
                      >
                        Unassign
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <SearchableSelect
                        value=""
                        onChange={(userId) => linkAccount.mutate({ userId })}
                        options={accountOptions}
                        placeholder="Search accounts by email or name…"
                        searchPlaceholder="Type at least 2 characters…"
                        emptyText="No matching accounts"
                      />
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          type="email"
                          value={linkEmail}
                          onChange={(e) => setLinkEmail(e.target.value)}
                          placeholder="…or type the tutor's account email"
                          className="sm:max-w-sm"
                        />
                        <Button
                          type="button"
                          disabled={!linkEmail.trim() || linkAccount.isPending}
                          onClick={() => linkAccount.mutate({ email: linkEmail })}
                        >
                          {linkAccount.isPending ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : null}
                          Assign account
                        </Button>
                      </div>
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Search with the dropdown, or fall back to the exact email the tutor signed up
                    with. Assignment takes effect immediately.
                  </p>
                </div>
              )}
            </EditorSection>

            {/* 2. Subjects & Target Levels */}
            <EditorSection
              icon={BookOpen}
              title="Subjects & Levels"
              description="Pick a curriculum to narrow suggestions, then tag what the tutor can specifically teach for each one."
              id="subjects"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Teaching Curriculum"
                  hint="Narrows the subject suggestions — Primary School, Junior Secondary, and University Admissions & Test Prep included."
                >
                  <SearchableSelect
                    value={subjectCurriculum}
                    onChange={(v) => {
                      setSubjectCurriculum(v);
                      setAdmissionsSubcategory("");
                    }}
                    options={[
                      { value: "", label: "All curricula" },
                      ...TEACHING_CURRICULA.map((curriculum) => ({
                        value: curriculum.value,
                        label: curriculum.label,
                      })),
                    ]}
                    placeholder="All curricula"
                  />
                </FormField>
                {isAdmissionsSubjectCurriculum ? (
                  <FormField
                    label="Admissions Sub-category"
                    hint="Standardized Testing & Language (SAT, ACT, IELTS, TOEFL, UCAT, ISAT) or Application & Admissions Support (personal statement, interviews, portfolio)."
                  >
                    <SearchableSelect
                      value={admissionsSubcategory}
                      onChange={(v) => setAdmissionsSubcategory(v)}
                      options={[
                        { value: "", label: "All admissions subjects" },
                        ...ADMISSIONS_SUBCATEGORY_OPTIONS,
                      ]}
                      placeholder="All admissions subjects"
                    />
                  </FormField>
                ) : null}
              </div>

              <FormField
                label="Subjects Taught"
                required
                error={errors.subjects}
                hint="Type to search or add custom subject tags"
              >
                <TagInput
                  value={form.subjects}
                  onChange={(subjects) => setForm({ ...form, subjects })}
                  suggestions={subjectSuggestions}
                  placeholder={
                    subjectCurriculumLabel
                      ? `Add ${subjectCurriculumLabel} subjects (e.g. IB Biology, Math HL)...`
                      : "Add subjects (e.g. IB Biology, Math HL)..."
                  }
                />
              </FormField>

              {selectedSubjectGroups.length > 0 ? (
                <div className="space-y-1.5 rounded-sm border border-border bg-[color:var(--surface-subtle)]/60 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Taught subjects by curriculum
                  </p>
                  {selectedSubjectGroups.map((group) => (
                    <p key={group.systemId} className="text-xs leading-relaxed">
                      <span className="font-bold text-[color:var(--ink)]">
                        {getCurriculumGroupLabel(group.systemId)}:
                      </span>{" "}
                      <span className="text-muted-foreground">{group.subjects.join(", ")}</span>
                    </p>
                  ))}
                </div>
              ) : null}

              <FormField
                label="Target Student Levels"
                error={errors.target_students}
                hint="Target curriculum or grade levels"
              >
                <TagInput
                  value={form.target_students}
                  onChange={(target_students) => setForm({ ...form, target_students })}
                  suggestions={TARGET_STUDENT_OPTIONS}
                  placeholder="Add target levels (e.g. IBDP, HKDSE)..."
                />
              </FormField>
            </EditorSection>

            {/* 3. Core Academic Breakdown & Exam Results */}
            <EditorSection
              icon={GraduationCap}
              title="Exam Results & Breakdown"
              description="Standardized exam systems (IBDP, HKDSE, A-Level, AP, IELTS, ISAT, UCAT) and subject score pills."
              id="academics"
              badge={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addExamSystem}
                  disabled={form.exam_results.length >= 3}
                  className="h-8 text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add System ({form.exam_results.length}/3)
                </Button>
              }
            >
              {form.exam_results.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center bg-[color:var(--surface-subtle)]/30">
                  <GraduationCap className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-xs font-semibold text-[color:var(--ink)]">
                    No Exam Systems Added
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mt-0.5">
                    Highlight official exam results (e.g. IB 7s, DSE 5**, A*s) to build credibility.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExamSystem}
                    className="mt-3 text-xs"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Exam System
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {form.exam_results.map((result, examIdx) => {
                    const currentSystem = getSystem(result.system);
                    const paperLabels: readonly string[] =
                      currentSystem?.paperLabels ?? EXAM_PAPER_LABELS;
                    const paperScoreOptions = currentSystem?.paperScoreOptions;
                    return (
                      <div
                        key={examIdx}
                        className="rounded-xl border border-[color:var(--ink)]/15 bg-[color:var(--surface-subtle)]/40 p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--ink)]/10 pb-3">
                          <div className="flex items-center gap-2 flex-1 max-w-xs">
                            <span className="text-xs font-bold text-[color:var(--ink)]">
                              System #{examIdx + 1}:
                            </span>
                            <SearchableSelect
                              value={result.system}
                              onChange={(v) => updateExamSystem(examIdx, v)}
                              options={EXAM_SYSTEMS.map((s) => ({
                                value: s.id,
                                label: s.label,
                              }))}
                              placeholder="Select system"
                              className="h-9 text-xs"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExamSystem(examIdx)}
                            className="h-8 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Remove System
                          </Button>
                        </div>

                        {/* Subject Rows within this Exam System */}
                        <div className="space-y-3">
                          {result.subjects.map((entry, subIdx) => {
                            const gradeOptions = getGradesForSelection(
                              result.system,
                              entry.subject,
                            );
                            const subjectSuggestions = currentSystem
                              ? currentSystem.subjects
                              : SUBJECT_OPTIONS;

                            return (
                              <div
                                key={subIdx}
                                className="rounded-lg border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-3 space-y-2.5"
                              >
                                <div className="grid gap-2 grid-cols-[1fr_130px_36px] sm:grid-cols-[1fr_160px_36px] items-center">
                                  <SearchableSelect
                                    value={entry.subject}
                                    onChange={(v) =>
                                      updateExamSubject(examIdx, subIdx, { subject: v })
                                    }
                                    options={subjectSuggestions}
                                    placeholder="Search or pick subject…"
                                    allowCustom
                                    className="h-9 text-xs"
                                  />
                                  <SearchableSelect
                                    value={entry.grade}
                                    onChange={(v) =>
                                      updateExamSubject(examIdx, subIdx, { grade: v })
                                    }
                                    options={gradeOptions}
                                    placeholder={
                                      gradeOptions.length === 0 ? "Enter grade" : "Grade"
                                    }
                                    allowCustom={gradeOptions.length === 0}
                                    disabled={!entry.subject}
                                    className="h-9 text-xs"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeExamSubject(examIdx, subIdx)}
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* Optional Paper Breakdown Pills */}
                                {entry.subject && (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                    {paperLabels.map((label) => {
                                      const componentScoreOptions =
                                        currentSystem?.paperScoreOptionsFor?.(label) ??
                                        paperScoreOptions;
                                      const currentScore =
                                        (entry.papers ?? []).find((p) => p.label === label)
                                          ?.score ?? "";
                                      const setPaperScore = (score: string) => {
                                        const rest = (entry.papers ?? []).filter(
                                          (p) => p.label !== label,
                                        );
                                        const next = score.trim()
                                          ? [...rest, { label, score }]
                                          : rest;
                                        const rank = (paperLabel: string) => {
                                          const index = paperLabels.indexOf(paperLabel);
                                          return index === -1 ? paperLabels.length : index;
                                        };
                                        next.sort((a, b) => rank(a.label) - rank(b.label));
                                        updateExamSubject(examIdx, subIdx, { papers: next });
                                      };
                                      return componentScoreOptions ? (
                                        <Select
                                          key={label}
                                          value={currentScore}
                                          onValueChange={setPaperScore}
                                        >
                                          <SelectTrigger className="h-7.5 text-[11px]">
                                            <SelectValue placeholder={`${label} (optional)`} />
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
                                          key={label}
                                          value={currentScore}
                                          placeholder={`${label} (optional)`}
                                          onChange={(e) => setPaperScore(e.target.value)}
                                          className="h-7.5 text-[11px]"
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addSubjectToExam(examIdx)}
                            className="w-full text-xs h-8 border-dashed"
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add Subject Row
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </EditorSection>

            {/* 4. Lesson Format & Logistics */}
            <EditorSection
              icon={Briefcase}
              title="Rates & Delivery Format"
              description="Lesson modes, MTR station coverage for in-person tutoring, and hourly rates."
              id="logistics"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField label="Lesson Delivery Mode" required error={errors.lesson_mode}>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={form.lesson_mode}
                    onValueChange={(val) => {
                      if (!val) return;
                      setForm({
                        ...form,
                        lesson_mode: val as TutorFormData["lesson_mode"],
                        stations: val === "online" ? [] : form.stations,
                      });
                    }}
                    className="grid grid-cols-3 gap-1.5 w-full"
                  >
                    <ToggleGroupItem value="online" className="text-xs h-9">
                      Online
                    </ToggleGroupItem>
                    <ToggleGroupItem value="in_person" className="text-xs h-9">
                      In-Person
                    </ToggleGroupItem>
                    <ToggleGroupItem value="either" className="text-xs h-9">
                      Hybrid
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormField>

                <FormField
                  label="Hourly Rate (HKD)"
                  required
                  error={errors.hourly_rate}
                  hint="E.g. 450"
                >
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                      HK$
                    </span>
                    <Input
                      type="number"
                      value={form.hourly_rate}
                      onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })}
                      className="pl-10 font-semibold"
                    />
                  </div>
                </FormField>
              </div>

              <div className="mt-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <Label className="text-xs font-semibold">Per-curriculum rates</Label>
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                      Optional. Search cards show the lowest rate as “HK$X up” and the profile lists
                      every rate. Leave empty to use the flat hourly rate everywhere.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPricingTier}
                    disabled={form.pricing_tiers.length >= MAX_PRICING_TIERS}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add rate tier
                  </Button>
                </div>
                {form.pricing_tiers.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {form.pricing_tiers.map((tier, index) => (
                      <div
                        key={index}
                        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center"
                      >
                        <Select
                          value={tier.curriculum}
                          onValueChange={(val) => updatePricingTier(index, { curriculum: val })}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Curriculum" />
                          </SelectTrigger>
                          <SelectContent>
                            {TEACHING_CURRICULA.map((curriculum) => (
                              <SelectItem
                                key={curriculum.value}
                                value={curriculum.value}
                                className="text-xs"
                              >
                                {curriculum.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                            HK$
                          </span>
                          <Input
                            type="number"
                            value={tier.rate}
                            onChange={(e) =>
                              updatePricingTier(index, { rate: Number(e.target.value) })
                            }
                            className="pl-10 text-xs font-semibold"
                            aria-label={`Rate for ${tier.curriculum || "new tier"}`}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          aria-label={`Remove ${tier.curriculum || "tier"} rate`}
                          onClick={() => removePricingTier(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {form.lesson_mode !== "online" ? (
                  <FormField
                    className="sm:col-span-2"
                    label="Teaching Stations (MTR)"
                    required={form.is_published}
                    error={errors.stations}
                    hint="Parents search by their nearest station — suggestions use estimated MTR travel time."
                  >
                    <div className="space-y-3 rounded-lg border border-border bg-[color:var(--surface-subtle)]/40 p-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Starting MTR station</Label>
                          <MtrStationSelect
                            value={originStation}
                            onChange={(v) => {
                              setOriginStation(v);
                              setLocationMessage("");
                              setSuggestionStatus("idle");
                            }}
                            placeholder="Choose their closest station"
                            showAnyOption={false}
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
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Estimated MTR travel time</Label>
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
                                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-50",
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
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addTravelSuggestions}
                          disabled={!originStation || suggestionStatus === "adding"}
                        >
                          <Plus />
                          Quick Add Stations
                        </Button>
                        {suggestionStatus === "done" ? (
                          <p
                            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                            role="status"
                            aria-live="polite"
                          >
                            Done · {addedCount} stations within {travelBudget} min
                          </p>
                        ) : null}
                      </div>
                      <MtrStationMultiSelect
                        value={form.stations}
                        onChange={(stations) => setForm({ ...form, stations })}
                      />
                    </div>
                  </FormField>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-[color:var(--surface-subtle)]/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]" />
                    Online tutoring is available territory-wide; no stations required.
                  </div>
                )}

                <FormField
                  label="Years of Experience"
                  error={errors.experience_years}
                  hint="Optional number of years teaching"
                >
                  <Input
                    type="number"
                    value={form.experience_years}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        experience_years: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    placeholder="e.g. 3"
                    className="h-10 text-xs"
                  />
                </FormField>
              </div>

              <FormField
                label="Languages Spoken"
                error={errors.languages}
                hint="Languages used during tutoring"
              >
                <TagInput
                  value={form.languages}
                  onChange={(languages) => setForm({ ...form, languages })}
                  suggestions={LANGUAGE_SUGGESTIONS}
                  placeholder="Add languages (English, Cantonese...)"
                />
              </FormField>
            </EditorSection>

            {/* 5. Tutor Card Highlights */}
            <EditorSection
              icon={Sparkles}
              title="Tutor Card Highlights"
              description="Three concise rows shown on tutor cards. The longer biography below remains profile-only."
              id="card-highlights"
            >
              <div className="space-y-3">
                {Array.from({ length: MAX_TUTOR_CARD_HIGHLIGHTS }).map((_, index) => {
                  const value = form.card_highlights[index] ?? "";
                  const reachedLimit = value.length >= TUTOR_CARD_HIGHLIGHT_ROW_LIMIT;
                  return (
                    <FormField
                      key={`card-highlight-${index}`}
                      label={`Card row ${index + 1}`}
                      error={
                        errors[`card_highlights.${index}`] ??
                        (index === 0 ? errors.card_highlights : undefined)
                      }
                      hint={`${value.length}/${TUTOR_CARD_HIGHLIGHT_ROW_LIMIT}`}
                    >
                      <div className="relative">
                        <Input
                          value={value}
                          maxLength={TUTOR_CARD_HIGHLIGHT_ROW_LIMIT}
                          aria-label={`Tutor card row ${index + 1}`}
                          onChange={(e) => {
                            const nextValue = e.target.value.slice(
                              0,
                              TUTOR_CARD_HIGHLIGHT_ROW_LIMIT,
                            );
                            const wasAtLimit =
                              (form.card_highlights[index] ?? "").length >=
                              TUTOR_CARD_HIGHLIGHT_ROW_LIMIT;
                            setForm((previous) => {
                              const cardHighlights = [...previous.card_highlights];
                              cardHighlights[index] = nextValue;
                              return { ...previous, card_highlights: cardHighlights };
                            });
                            if (
                              !wasAtLimit &&
                              nextValue.length === TUTOR_CARD_HIGHLIGHT_ROW_LIMIT
                            ) {
                              toast.info(
                                `Card row ${index + 1} reached the ${TUTOR_CARD_HIGHLIGHT_ROW_LIMIT}-character limit.`,
                              );
                            }
                          }}
                          placeholder={
                            index === 0
                              ? "e.g. IBDP Biology specialist"
                              : index === 1
                                ? "e.g. Medicine student at HKU"
                                : "e.g. Patient, exam-focused teaching"
                          }
                          className={cn(
                            "pr-16 text-xs",
                            reachedLimit &&
                              "border-amber-500 focus-visible:ring-amber-500 dark:border-amber-400 dark:focus-visible:ring-amber-400",
                          )}
                        />
                        <span
                          className={cn(
                            "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground",
                            reachedLimit && "text-amber-600 dark:text-amber-400",
                          )}
                          aria-live="polite"
                        >
                          {value.length}/{TUTOR_CARD_HIGHLIGHT_ROW_LIMIT}
                        </span>
                      </div>
                      {reachedLimit ? (
                        <p
                          className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                          role="status"
                        >
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Maximum length reached; shorten this row to edit it.
                        </p>
                      ) : null}
                    </FormField>
                  );
                })}
              </div>
            </EditorSection>

            {/* 6. Biography & Mentoring */}
            <EditorSection
              icon={Sparkles}
              title="Bio & Mentorship"
              description="Rich personal bio and IB coursework mentoring support."
              id="bio"
            >
              <FormField
                label="Tutor Biography & Teaching Philosophy"
                error={errors.qualifications_summary}
                hint="Formatting supported (bold ⌘B, italic ⌘I, bullets) · shown on the public profile"
              >
                <RichTextEditor
                  value={form.qualifications_summary}
                  onChange={(val) => setForm({ ...form, qualifications_summary: val })}
                  placeholder="e.g. Full-time IB & DSE specialist with 5+ years experience. Proven track record guiding 30+ students to grade 7 in IB Biology and Chemistry..."
                  maxLength={1500}
                />
              </FormField>

              {/* Issue #119: tutor-written self-introduction, shown verbatim
                  (line breaks preserved) on the public profile when non-empty. */}
              <FormField
                label="Self-Introduction / 簡介 (verbatim from tutor)"
                error={errors.self_introduction}
                hint="Remove personal contact info · line breaks kept · blank hides the section"
              >
                <Textarea
                  rows={6}
                  maxLength={2000}
                  value={form.self_introduction}
                  onChange={(e) => setForm({ ...form, self_introduction: e.target.value })}
                  placeholder="The tutor's self-introduction in their own words..."
                  className="text-xs"
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground" aria-live="polite">
                  {form.self_introduction?.length ?? 0}/2000
                </p>
              </FormField>

              {/* IA / EE / TOK Mentorship */}
              <div className="space-y-3 pt-2 border-t border-[color:var(--ink)]/10">
                <div>
                  <Label className="text-xs font-semibold text-[color:var(--ink)]">
                    IB Coursework Mentoring Support
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select if tutor provides specialized guidance on Internal Assessments, Extended
                    Essays, or TOK.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {IA_EE_TOK_SUPPORT_OPTIONS.map((item) => (
                    <label
                      key={item}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                        form.ia_ee_tok_support.includes(item)
                          ? "border-[color:var(--ring)] bg-[color:var(--ring)]/[0.08] text-[color:var(--ink)]"
                          : "border-border bg-background text-[color:var(--ink)] hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={form.ia_ee_tok_support.includes(item)}
                        onCheckedChange={(checked) => toggleIaEeTok(item, checked === true)}
                      />
                      <span>{item} Mentoring</span>
                    </label>
                  ))}
                </div>

                {form.ia_ee_tok_support.length > 0 && (
                  <FormField
                    label="Coursework Support Notes"
                    error={errors.ia_ee_tok_notes}
                    hint="Optional specifics (e.g. topic selection, draft feedback)"
                  >
                    <Textarea
                      rows={2}
                      value={form.ia_ee_tok_notes}
                      onChange={(e) => setForm({ ...form, ia_ee_tok_notes: e.target.value })}
                      placeholder="e.g. Topic brainstorming, methodology review, formatting & rubric alignment."
                      className="text-xs"
                    />
                  </FormField>
                )}
              </div>
            </EditorSection>

            {/* Field Review & Flags (issue #125): every public field gets an
                Approve / Flagged (hidden) toggle. Non-crucial flags hide only
                that field while the profile stays live; crucial flags force
                the whole profile to Hidden / Action Required. */}
            <EditorSection
              icon={Flag}
              title="Field Review & Flags"
              description="Flag a field to hide just that field from the public profile. Notes are internal — relay them to the tutor via WhatsApp."
              badge={
                flaggedFieldCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                      {flaggedFieldCount} flagged
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => void copyFlagSummary()}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy notes
                    </Button>
                  </div>
                ) : (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    All approved
                  </span>
                )
              }
            >
              {hasCrucialFlag ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-xs leading-relaxed text-destructive">
                    <span className="font-bold">Action required:</span> a crucial field is flagged.
                    The whole profile is forced to Hidden and cannot go live until the flag is
                    cleared.
                  </p>
                </div>
              ) : null}
              <div className="space-y-2.5">
                {TUTOR_FIELD_FLAG_FIELDS.map((field) => {
                  const isFlagged = Object.prototype.hasOwnProperty.call(fieldFlags, field.key);
                  const preview = fieldFlagValuePreview(field.key, form);
                  return (
                    <div
                      key={field.key}
                      className={cn(
                        "rounded-xl border px-4 py-3 transition-colors",
                        isFlagged
                          ? "border-amber-500/40 bg-amber-500/[0.06]"
                          : "border-[color:var(--ink)]/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[color:var(--ink)]">
                              {field.label}
                            </span>
                            {field.crucial ? (
                              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                                Crucial
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "text-[11px] font-semibold",
                                isFlagged
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-emerald-700 dark:text-emerald-400",
                              )}
                            >
                              {isFlagged ? "Flagged (hidden)" : "Approved"}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {preview ?? "Empty"}
                          </p>
                        </div>
                        <Switch
                          checked={isFlagged}
                          onCheckedChange={(checked) => toggleFieldFlag(field.key, checked)}
                          aria-label={`${isFlagged ? "Unflag" : "Flag"} ${field.label}`}
                        />
                      </div>
                      {isFlagged ? (
                        <div className="mt-2.5 space-y-1.5">
                          <Input
                            value={flagNotes[field.key] ?? ""}
                            onChange={(e) =>
                              setFlagNotes((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            placeholder="Internal note — reason for the flag (you relay this to the tutor)"
                            maxLength={500}
                            className="h-8 text-xs"
                          />
                          {field.crucial ? (
                            <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              Crucial — the whole profile stays hidden until this flag is cleared.
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              Hidden from the public profile only — the rest of the profile stays
                              live.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Students never see flagged fields on tutor cards, the profile page, search, or case
                matches. Non-crucial flags keep the tutor Published; the live card preview on the
                right shows the student view.
              </p>
            </EditorSection>

            {/* 6. Publication Settings */}
            <ConsolePanel padding="lg">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <Label className="text-sm font-bold text-foreground">
                    Public Directory Visibility
                  </Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    When public, this tutor is discoverable in the MatchMax directory and search
                    filters.
                  </p>
                  {hasCrucialFlag ? (
                    <p className="text-xs font-semibold text-destructive">
                      A crucial field is flagged — this profile cannot go live until it is resolved
                      in Field Review &amp; Flags.
                    </p>
                  ) : null}
                </div>
                <Select
                  value={form.is_published ? "public" : "private"}
                  onValueChange={(v) => setForm({ ...form, is_published: v === "public" })}
                >
                  <SelectTrigger className="h-9 w-[110px] shrink-0 text-sm font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public" disabled={hasCrucialFlag}>
                      Public
                    </SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </ConsolePanel>
          </div>

          {/* Right: Sticky Live Preview Card */}
          <div className="lg:sticky lg:top-20 space-y-4">
            <ConsolePanel padding="sm">
              <div className="flex items-center justify-between mb-3 border-b border-[color:var(--ink)]/[0.08] pb-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse dark:bg-emerald-400" />
                  <span className="text-xs font-bold text-[color:var(--ink)]">
                    Live Card Preview
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">Matches student view</span>
              </div>

              <PublicTutorCard
                tutor={previewTutorPublic}
                priceSuffix="/hr"
                shareable={false}
                footerAction={
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    className="pointer-events-none text-xs w-full"
                  >
                    Contact Tutor
                  </Button>
                }
              />
            </ConsolePanel>

            {/* Sticky Action Card */}
            <ConsolePanel padding="sm" className="space-y-3">
              <Button type="submit" disabled={isSaving} className="w-full h-11 font-bold text-sm">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving changes…
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    {isEditing ? "Save Tutor Changes" : "Create Tutor Profile"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="w-full h-9 text-xs"
              >
                Cancel & Return
              </Button>
            </ConsolePanel>
          </div>
        </div>
      </form>

      <AutofillDialog
        open={autofillOpen}
        onOpenChange={setAutofillOpen}
        applicationId={applicationId}
        onApply={applyAutofill}
      />
    </div>
  );
}
