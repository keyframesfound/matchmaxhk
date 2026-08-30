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
  ExternalLink,
  GraduationCap,
  Info,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { z } from "zod";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { TagInput } from "@/components/ui/tag-input";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import {
  deleteTutorProfileImage,
  listTutorProfileImages,
  uploadTutorProfileImage,
  type R2TutorImage,
} from "@/features/tutors/r2.functions";
import {
  DEFAULT_SUBJECT_OPTIONS as SUBJECT_OPTIONS,
} from "@/features/tutors/subjects";
import {
  HK_DISTRICTS,
  IA_EE_TOK_SUPPORT_OPTIONS,
  MAX_TUTOR_ACHIEVEMENTS,
  TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT,
  type Tutor,
  type IaEeTokSupport,
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

const TARGET_STUDENT_OPTIONS = [
  "Primary",
  "Junior Secondary",
  "IBDP",
  "IGCSE",
  "HKDSE",
  "A-Level",
  "AP",
  "SAT",
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

export const tutorFormSchema = z.object({
  headline: z.string().trim().min(1, "Headline is required").max(200),
  subjects: z.array(z.string().trim().min(1).max(80)).min(1, "Pick at least one subject"),
  target_students: z.array(z.string().trim().min(1).max(80)),
  university: z.string().trim().max(120).optional().or(z.literal("")),
  highschool: z.string().trim().max(120).optional().or(z.literal("")),
  qualifications_summary: z.string().trim().max(1200).optional().or(z.literal("")),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  lesson_mode: z.enum(["online", "in_person", "either"]),
  hourly_rate: z.coerce.number().int().min(0).max(100000),
  badge: z.string().trim().max(80).optional().or(z.literal("")),
  photo_url: z.string().trim().max(1000).optional().or(z.literal("")),
  tutor_code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, and dashes only"),
  is_published: z.boolean(),
  languages: z.array(z.string().trim().min(1).max(60)),
  gender: z.enum(["male", "female", "other"]),
  experience_years: z.coerce.number().int().min(0).max(80).optional().or(z.literal("")),
  exam_results: z.array(examSchema).max(2, "Add no more than two exam systems"),
  achievements: z
    .array(achievementSchema)
    .max(MAX_TUTOR_ACHIEVEMENTS, "Add no more than three achievements"),
  ia_ee_tok_support: z.array(z.enum(IA_EE_TOK_SUPPORT_OPTIONS)),
  ia_ee_tok_notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type TutorFormData = z.infer<typeof tutorFormSchema>;

export const emptyTutorForm: TutorFormData = {
  headline: "",
  subjects: [],
  target_students: [],
  university: "",
  highschool: "",
  qualifications_summary: "",
  district: "",
  lesson_mode: "either",
  hourly_rate: 0,
  badge: "",
  photo_url: "",
  tutor_code: "",
  is_published: true,
  languages: ["English", "Cantonese"],
  gender: "female",
  experience_years: "",
  exam_results: [],
  achievements: [],
  ia_ee_tok_support: [],
  ia_ee_tok_notes: "",
};

export function tutorToFormData(t: Tutor): TutorFormData {
  return {
    headline: t.headline ?? "",
    subjects: t.subjects ?? [],
    target_students: t.target_students ?? [],
    university: t.university ?? "",
    highschool: t.highschool ?? "",
    qualifications_summary: t.qualifications_summary ?? "",
    district: t.district ?? "",
    lesson_mode: t.lesson_mode ?? "either",
    hourly_rate: t.hourly_rate ?? 0,
    badge: t.badge ?? "",
    photo_url: t.photo_url ?? "",
    tutor_code: t.tutor_code ?? "",
    is_published: t.is_published ?? true,
    languages: t.languages ?? ["English"],
    gender: ["male", "female", "other"].includes(
      (t as unknown as { gender?: string | null }).gender ?? "",
    )
      ? (t as unknown as { gender: "male" | "female" | "other" }).gender
      : "female",
    experience_years: t.experience_years ?? "",
    exam_results: (t.exam_results ?? []).slice(0, 2).map((r) => ({
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
    .slice(0, 2);

  const cleanAchievements: TutorAchievement[] = v.achievements
    .map((achievement) => ({
      short_text: achievement.short_text.trim(),
      detail_text: achievement.detail_text?.trim() || undefined,
    }))
    .filter((achievement) => achievement.short_text)
    .slice(0, MAX_TUTOR_ACHIEVEMENTS);

  return {
    display_name: v.tutor_code.trim(),
    headline: v.headline.trim(),
    university: v.university?.trim() || null,
    highschool: v.highschool?.trim() || null,
    qualifications_summary: v.qualifications_summary?.trim() || null,
    subjects: v.subjects,
    target_students: v.target_students,
    district: v.lesson_mode === "online" ? null : v.district?.trim() || null,
    lesson_mode: v.lesson_mode,
    hourly_rate: v.hourly_rate,
    badge: v.badge?.trim() || null,
    photo_url: v.photo_url?.trim() || null,
    tutor_code: v.tutor_code.trim(),
    is_published: v.is_published,
    languages: v.languages,
    gender: v.gender,
    experience_years: v.experience_years === "" ? null : Number(v.experience_years),
    exam_results: cleanExams,
    achievements: cleanAchievements,
    ia_ee_tok_support: v.ia_ee_tok_support,
    ia_ee_tok_notes: v.ia_ee_tok_notes?.trim() || null,
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
              className="h-20 w-20 rounded-2xl object-cover ring-2 ring-[color:var(--ink)]/10 shadow-sm"
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
              className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-1 text-destructive shadow-sm hover:bg-destructive hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 space-y-2.5 w-full">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[color:var(--ink)] px-3.5 text-xs font-semibold text-[color:var(--surface)] shadow-sm hover:bg-[color:var(--ink)]/90 transition-colors">
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
                        ? "border-[#1FA8B6] ring-2 ring-[#77E8EE]/40"
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
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 rounded-full bg-background/90 p-1 text-destructive shadow-sm hover:bg-destructive hover:text-white transition-all"
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
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] shadow-[0_1px_3px_rgba(4,19,68,0.04)] overflow-hidden"
    >
      <div className="border-b border-[color:var(--ink)]/[0.07] px-6 py-4.5 bg-[color:var(--surface-subtle)]/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--ink)]/[0.06] text-[color:var(--ink)]">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[color:var(--ink)]">{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {badge}
      </div>
      <div className="p-6 space-y-6">{children}</div>
    </section>
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

interface TutorEditorProps {
  initialData?: Tutor | null;
  onSave: (data: Record<string, unknown> & { id?: string }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function TutorEditor({ initialData, onSave, onCancel, isSaving = false }: TutorEditorProps) {
  const [form, setForm] = React.useState<TutorFormData>(() =>
    initialData ? tutorToFormData(initialData) : emptyTutorForm,
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = React.useState<string>("identity");

  // Track if form has changed
  const isEditing = Boolean(initialData);

  // Live preview tutor object
  const previewTutor = React.useMemo<Tutor>(
    () => ({
      id: initialData?.id ?? "preview-tutor",
      display_name: form.tutor_code.trim() || "MM-PREVIEW",
      headline: form.headline.trim() || null,
      university: form.university?.trim() || null,
      highschool: form.highschool?.trim() || null,
      target_students: form.target_students,
      qualifications_summary: form.qualifications_summary?.trim() || null,
      subjects: form.subjects,
      district: form.lesson_mode === "online" ? null : form.district?.trim() || null,
      gender: form.gender,
      lesson_mode: form.lesson_mode,
      hourly_rate: Number.isFinite(form.hourly_rate) ? form.hourly_rate : 0,
      badge: form.badge?.trim() || null,
      photo_url: form.photo_url?.trim() || null,
      tutor_code: form.tutor_code.trim() || "MM-PREVIEW",
      is_published: form.is_published,
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
    }),
    [form, initialData?.id],
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
      if (!(parsed.data.university ?? "").trim() && !(parsed.data.highschool ?? "").trim()) {
        publishErrors.university = "Add university or high school before publishing.";
      }
      if (
        !(parsed.data.qualifications_summary ?? "").trim() &&
        parsed.data.experience_years === ""
      ) {
        publishErrors.qualifications_summary = "Add bio or experience before publishing.";
      }
      if (parsed.data.lesson_mode !== "online" && !(parsed.data.district ?? "").trim()) {
        publishErrors.district = "District is required for in-person or hybrid tutoring.";
      }
    }

    if (Object.keys(publishErrors).length > 0) {
      setErrors(publishErrors);
      toast.error("Complete required fields for published tutors.");
      return;
    }

    setErrors({});
    const payload = formDataToPayload(parsed.data);
    onSave({
      ...payload,
      ...(initialData ? { id: initialData.id } : {}),
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

  // Achievements Builder
  const addAchievement = () => {
    if (form.achievements.length >= MAX_TUTOR_ACHIEVEMENTS) return;
    setForm((prev) => ({
      ...prev,
      achievements: [...prev.achievements, { short_text: "", detail_text: "" }],
    }));
  };

  const updateAchievement = (index: number, patch: Partial<TutorAchievement>) => {
    setForm((prev) => {
      const copy = [...prev.achievements];
      copy[index] = { ...copy[index], ...patch };
      return { ...prev, achievements: copy };
    });
  };

  const removeAchievement = (index: number) => {
    setForm((prev) => ({
      ...prev,
      achievements: prev.achievements.filter((_, idx) => idx !== index),
    }));
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
              <h1 className="text-2xl font-black tracking-tight text-[color:var(--ink)]">
                {isEditing ? `Edit Tutor — ${initialData?.tutor_code}` : "New Tutor Profile"}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                  form.is_published
                    ? "bg-[#77E8EE]/30 text-[#156B73]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {form.is_published ? "Published" : "Draft / Hidden"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure public credentials, subjects, exam breakdown, and booking logistics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            className="h-9 bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)] text-xs shadow-sm"
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
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] items-start">
          {/* Left: Sections Canvas */}
          <div className="space-y-8">
            {/* 1. Identity & Credentials */}
            <EditorSection
              icon={User}
              title="Identity & Media"
              description="Basic profile identification, headline, badge, and photo."
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
                    onChange={(v) =>
                      setForm({ ...form, gender: v as "male" | "female" | "other" })
                    }
                    options={[
                      { value: "female", label: "Female" },
                      { value: "male", label: "Male" },
                      { value: "other", label: "Other" },
                    ]}
                    placeholder="Select gender"
                  />
                </FormField>

                <FormField
                  label="Profile Badge"
                  error={errors.badge}
                  hint="Shown as header pill"
                >
                  <Input
                    value={form.badge}
                    onChange={(e) => setForm({ ...form, badge: e.target.value })}
                    placeholder="CUHK MBChB Year 2"
                  />
                </FormField>
              </div>

              <FormField
                label="Headline"
                required
                error={errors.headline}
                hint="Concise 1-line specialty pitch"
              >
                <Input
                  value={form.headline}
                  onChange={(e) => setForm({ ...form, headline: e.target.value })}
                  placeholder="e.g. IB 45/45 Scorer · Medicine Specialist & Biology Mentor"
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="University / Institution"
                  error={errors.university}
                  hint="Current or graduated"
                >
                  <Input
                    value={form.university}
                    onChange={(e) => setForm({ ...form, university: e.target.value })}
                    placeholder="e.g. Chinese University of Hong Kong"
                  />
                </FormField>

                <FormField
                  label="Secondary School"
                  error={errors.highschool}
                  hint="Graduated institution"
                >
                  <Input
                    value={form.highschool}
                    onChange={(e) => setForm({ ...form, highschool: e.target.value })}
                    placeholder="e.g. Diocesan Boys' School"
                  />
                </FormField>
              </div>

              <FormField label="Profile Photo" error={errors.photo_url}>
                <ModernPhotoUpload
                  value={form.photo_url ?? ""}
                  onChange={(url) => setForm({ ...form, photo_url: url })}
                />
              </FormField>
            </EditorSection>

            {/* 2. Subjects & Target Levels */}
            <EditorSection
              icon={BookOpen}
              title="Subjects & Levels"
              description="Subjects taught and student target levels with instant search tags."
              id="subjects"
            >
              <FormField
                label="Subjects Taught"
                required
                error={errors.subjects}
                hint="Type to search or add custom subject tags"
              >
                <TagInput
                  value={form.subjects}
                  onChange={(subjects) => setForm({ ...form, subjects })}
                  suggestions={SUBJECT_OPTIONS.map((s) => ({
                    value: s.name,
                    label: s.name,
                    category: s.category,
                  }))}
                  placeholder="Add subjects (e.g. IB Biology, Math HL)..."
                />
              </FormField>

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
              description="Standardized exam systems (IBDP, HKDSE, A-Level, AP) and subject score pills."
              id="academics"
              badge={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addExamSystem}
                  disabled={form.exam_results.length >= 2}
                  className="h-8 text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add System ({form.exam_results.length}/2)
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
                    return (
                      <div
                        key={examIdx}
                        className="rounded-xl border border-[color:var(--ink)]/15 bg-[color:var(--surface-subtle)]/40 p-4 space-y-4 shadow-sm"
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
                              ? currentSystem.subjects.map((s) => ({
                                  value: s.name,
                                  label: s.name,
                                }))
                              : SUBJECT_OPTIONS.map((s) => ({
                                  value: s.name,
                                  label: s.name,
                                }));

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
                                    {EXAM_PAPER_LABELS.map((label) => {
                                      const currentScore =
                                        (entry.papers ?? []).find((p) => p.label === label)
                                          ?.score ?? "";
                                      return (
                                        <Input
                                          key={label}
                                          value={currentScore}
                                          placeholder={`${label} (optional)`}
                                          onChange={(e) => {
                                            const score = e.target.value;
                                            const rest = (entry.papers ?? []).filter(
                                              (p) => p.label !== label,
                                            );
                                            const next = score.trim()
                                              ? [...rest, { label, score }]
                                              : rest;
                                            next.sort(
                                              (a, b) =>
                                                EXAM_PAPER_LABELS.indexOf(
                                                  a.label as (typeof EXAM_PAPER_LABELS)[number],
                                                ) -
                                                EXAM_PAPER_LABELS.indexOf(
                                                  b.label as (typeof EXAM_PAPER_LABELS)[number],
                                                ),
                                            );
                                            updateExamSubject(examIdx, subIdx, { papers: next });
                                          }}
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
              description="Lesson modes, district coverage for in-person tutoring, and hourly rates."
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
                        district: val === "online" ? "" : form.district,
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
                      onChange={(e) =>
                        setForm({ ...form, hourly_rate: Number(e.target.value) })
                      }
                      className="pl-10 font-semibold"
                    />
                  </div>
                </FormField>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                {form.lesson_mode !== "online" ? (
                  <FormField
                    label="Primary District"
                    required={form.is_published}
                    error={errors.district}
                    hint="For in-person lesson matchmaking"
                  >
                    <Select
                      value={form.district || "__none"}
                      onValueChange={(v) =>
                        setForm({ ...form, district: v === "__none" ? "" : v })
                      }
                    >
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue placeholder="Select District…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— No specific district —</SelectItem>
                        {HK_DISTRICTS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-[color:var(--surface-subtle)]/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 text-[#1FA8B6]" />
                    Online tutoring is available territory-wide; no district required.
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

            {/* 5. Biography, Highlights & Mentoring */}
            <EditorSection
              icon={Sparkles}
              title="Bio, Highlights & Mentorship"
              description="Rich personal bio, top achievements, and IB coursework support tags."
              id="bio"
            >
              <FormField
                label="Tutor Biography & Teaching Philosophy"
                error={errors.qualifications_summary}
                hint="Detailed overview shown on the public profile"
              >
                <Textarea
                  rows={4}
                  value={form.qualifications_summary}
                  onChange={(e) =>
                    setForm({ ...form, qualifications_summary: e.target.value })
                  }
                  placeholder="e.g. Full-time IB & DSE specialist with 5+ years experience. Proven track record guiding 30+ students to grade 7 in IB Biology and Chemistry..."
                  className="text-xs leading-relaxed"
                />
              </FormField>

              {/* Achievements slots */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-[color:var(--ink)]">
                      Key Achievement Highlights ({form.achievements.length}/{MAX_TUTOR_ACHIEVEMENTS})
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Bullet pills displayed prominently on public cards.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAchievement}
                    disabled={form.achievements.length >= MAX_TUTOR_ACHIEVEMENTS}
                    className="h-7.5 text-xs"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Highlight
                  </Button>
                </div>

                {form.achievements.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    No highlights added yet. Click &ldquo;Add Highlight&rdquo; to add awards, honors, or scoring feats.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {form.achievements.map((ach, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)]/40 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[color:var(--ink)]">
                            Highlight #{idx + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAchievement(idx)}
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <Input
                          value={ach.short_text}
                          onChange={(e) =>
                            updateAchievement(idx, { short_text: e.target.value })
                          }
                          placeholder="e.g. Top in Hong Kong for IB Chemistry (Grade 7)"
                          maxLength={TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT}
                          className="h-8 text-xs font-medium"
                        />
                        <Input
                          value={ach.detail_text ?? ""}
                          onChange={(e) =>
                            updateAchievement(idx, { detail_text: e.target.value })
                          }
                          placeholder="Optional extra context or verification detail"
                          className="h-7.5 text-[11px] text-muted-foreground"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* IA / EE / TOK Mentorship */}
              <div className="space-y-3 pt-2 border-t border-[color:var(--ink)]/10">
                <div>
                  <Label className="text-xs font-semibold text-[color:var(--ink)]">
                    IB Coursework Mentoring Support
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select if tutor provides specialized guidance on Internal Assessments, Extended Essays, or TOK.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {IA_EE_TOK_SUPPORT_OPTIONS.map((item) => (
                    <label
                      key={item}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                        form.ia_ee_tok_support.includes(item)
                          ? "border-[#1FA8B6] bg-[#77E8EE]/15 text-[#156B73]"
                          : "border-border bg-background text-[color:var(--ink)] hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={form.ia_ee_tok_support.includes(item)}
                        onCheckedChange={(checked) =>
                          toggleIaEeTok(item, checked === true)
                        }
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
                      onChange={(e) =>
                        setForm({ ...form, ia_ee_tok_notes: e.target.value })
                      }
                      placeholder="e.g. Topic brainstorming, methodology review, formatting & rubric alignment."
                      className="text-xs"
                    />
                  </FormField>
                )}
              </div>
            </EditorSection>

            {/* 6. Publication Settings */}
            <div className="rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-6 flex items-center justify-between shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor="pub-switch" className="text-sm font-bold text-[color:var(--ink)]">
                  Public Directory Visibility
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, this tutor is discoverable in the MatchMax directory and search filters.
                </p>
              </div>
              <Switch
                id="pub-switch"
                checked={form.is_published}
                onCheckedChange={(v) => setForm({ ...form, is_published: v })}
              />
            </div>
          </div>

          {/* Right: Sticky Live Preview Card */}
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-[color:var(--ink)]/[0.08] pb-2.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-[color:var(--ink)]">
                    Live Card Preview
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Matches student view
                </span>
              </div>

              <PublicTutorCard
                tutor={previewTutor}
                priceSuffix="/hr"
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
            </div>

            {/* Sticky Action Card */}
            <div className="rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-4 space-y-3 shadow-sm">
              <Button
                type="submit"
                disabled={isSaving}
                className="w-full h-11 bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)] text-sm shadow-md"
              >
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
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
