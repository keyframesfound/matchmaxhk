import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import {
  fetchAllTutors,
  getTutorGenderLabel,
  HK_DISTRICTS,
  IA_EE_TOK_SUPPORT_OPTIONS,
  MAX_TUTOR_ACHIEVEMENTS,
  TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT,
  type Tutor,
  type Education,
  type IaEeTokSupport,
  type TutorAchievement,
} from "@/features/tutors/queries";
import {
  EXAM_SYSTEMS,
  getSystem,
  getGradesForSelection,
  type ExamResult,
  type ExamResultEntry,
} from "@/features/tutors/examSystems";
import {
  deleteTutorProfileImage,
  listTutorProfileImages,
  uploadTutorProfileImage,
  type R2TutorImage,
} from "@/features/tutors/r2.functions";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";

export const Route = createFileRoute("/_authenticated/admin/tutors")({
  head: () => ({
    meta: [
      { title: "Tutors — MatchMax admin" },
      { name: "description", content: "Manage tutors on MatchMax." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTutors,
});

const EDUCATION_LEVELS = [
  "Secondary school",
  "Undergraduate",
  "Postgraduate",
  "Doctorate",
  "Diploma / Certificate",
  "Other",
];

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

import { DEFAULT_SUBJECT_OPTIONS as SUBJECT_OPTIONS } from "@/features/tutors/subjects";

function PhotoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const listImagesFn = useServerFn(listTutorProfileImages);
  const uploadImageFn = useServerFn(uploadTutorProfileImage);
  const deleteImageFn = useServerFn(deleteTutorProfileImage);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
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
      toast.success("Image uploaded");
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
      toast.success("Image removed from R2");
      await refetchLibrary();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const selectedLibraryItem = useMemo(
    () => library.find((item) => item.url === value) ?? null,
    [library, value],
  );

  const handleBlur = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !trimmed.match(/^https?:\/\/.+/)) {
      toast.error("Please enter a valid image URL.");
      return;
    }
    onChange(trimmed);
  };

  const onFilePick: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    upload.mutate(file);
  };

  const handleRemoveCurrent = () => {
    if (!value) return;

    if (!selectedLibraryItem) {
      onChange("");
      setInputValue("");
      return;
    }

    if (!confirm("Remove this image from R2 storage? This cannot be undone.")) {
      return;
    }
    removeFromR2.mutate({ key: selectedLibraryItem.key, url: selectedLibraryItem.url });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt=""
            className="h-16 w-16 rounded-md object-cover ring-1 ring-border"
          />
        ) : (
          <div className="h-16 w-16 rounded-md bg-muted ring-1 ring-border" />
        )}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted">
              {upload.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload to R2
              <input type="file" accept="image/*" className="hidden" onChange={onFilePick} />
            </label>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removeFromR2.isPending}
                onClick={handleRemoveCurrent}
              >
                {selectedLibraryItem ? "Remove from R2" : "Remove"}
              </Button>
            ) : null}
          </div>
          <Input
            placeholder="Or paste direct image URL"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleBlur();
              }
            }}
          />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">R2 library (click to select)</p>
        {isLibraryLoading ? (
          <div
            aria-label="Loading image library"
            className="grid grid-cols-5 gap-2 rounded-md border border-border p-2"
          >
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : isLibraryError ? (
          <div className="flex min-h-20 items-center justify-center rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive">
            {(libraryError as Error)?.message || "Failed to load R2 library."}
          </div>
        ) : library.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
            No R2 images yet. Upload one above.
          </div>
        ) : (
          <div className="grid max-h-40 grid-cols-5 gap-2 overflow-y-auto rounded-md border border-border p-2">
            {library.map((item) => (
              <div key={item.key} className="relative">
                <button
                  type="button"
                  className={`overflow-hidden rounded-md ring-2 ring-offset-1 transition ${value === item.url ? "ring-[color:var(--brand-teal)]" : "ring-transparent hover:ring-border"}`}
                  onClick={() => {
                    onChange(item.url);
                    setInputValue(item.url);
                  }}
                  title={item.key}
                >
                  <img src={item.url} alt="" className="h-14 w-full object-cover" />
                </button>
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow-sm ring-1 ring-border hover:bg-background"
                  title="Remove image from R2"
                  aria-label="Remove image from R2"
                  disabled={removeFromR2.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!confirm("Remove this image from R2 storage? This cannot be undone.")) {
                      return;
                    }
                    removeFromR2.mutate({ key: item.key, url: item.url });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void refetchLibrary()}>
            Refresh library
          </Button>
        </div>
      </div>
    </div>
  );
}

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
    .min(1, "A short achievement line is required")
    .max(TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT),
  detail_text: z.string().trim().max(1000).optional().or(z.literal("")),
});

const formSchema = z.object({
  headline: z.string().trim().min(1, "Headline is required").max(200),
  subjects: z.array(z.string().trim().min(1).max(80)).min(1, "Pick at least one subject"),
  target_students_csv: z.string().trim().max(300).optional().or(z.literal("")),
  university: z.string().trim().max(120).optional().or(z.literal("")),
  highschool: z.string().trim().max(120).optional().or(z.literal("")),
  qualifications_summary: z.string().trim().max(1200).optional().or(z.literal("")),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  lesson_mode: z.enum(["online", "in_person", "either"]),
  hourly_rate: z.coerce.number().int().min(0).max(100000),
  badge: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  photo_url: z.string().trim().max(1000).optional().or(z.literal("")),
  tutor_code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, dashes only"),
  is_published: z.boolean(),
  languages_csv: z.string().trim().max(200).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]),
  experience_years: z.coerce.number().int().min(0).max(80).optional().or(z.literal("")),
  teaching_since: z.union([z.coerce.number().int().min(1950).max(2100), z.literal("")]).optional(),
  education: z.array(eduSchema),
  exam_results: z.array(examSchema).max(2, "Add no more than two exam systems"),
  achievements: z
    .array(achievementSchema)
    .max(MAX_TUTOR_ACHIEVEMENTS, "Add no more than three achievements"),
  ia_ee_tok_support: z.array(z.enum(IA_EE_TOK_SUPPORT_OPTIONS)),
  ia_ee_tok_notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

const empty: FormValues = {
  headline: "",
  subjects: [],
  target_students_csv: "",
  university: "",
  highschool: "",
  qualifications_summary: "",
  district: "",
  lesson_mode: "either",
  hourly_rate: 0,
  badge: "",
  bio: "",
  photo_url: "",
  tutor_code: "",
  is_published: true,
  languages_csv: "",
  gender: "female",
  experience_years: "",
  teaching_since: "",
  education: [],
  exam_results: [],
  achievements: [],
  ia_ee_tok_support: [],
  ia_ee_tok_notes: "",
};

function tutorToForm(t: Tutor): FormValues {
  return {
    headline: t.headline ?? "",
    subjects: t.subjects ?? [],
    target_students_csv: (t.target_students ?? []).join(", "),
    university: t.university ?? "",
    highschool: t.highschool ?? "",
    qualifications_summary: t.qualifications_summary ?? "",
    district: t.district ?? "",
    lesson_mode: t.lesson_mode ?? "either",
    hourly_rate: t.hourly_rate,
    badge: t.badge ?? "",
    bio: t.bio ?? "",
    photo_url: t.photo_url ?? "",
    tutor_code: t.tutor_code,
    is_published: t.is_published,
    languages_csv: (t.languages ?? []).join(", "),
    gender: ["male", "female", "other"].includes(
      (t as unknown as { gender?: string | null }).gender ?? "",
    )
      ? (t as unknown as { gender: "male" | "female" | "other" }).gender
      : "female",
    experience_years: t.experience_years ?? "",
    teaching_since: t.teaching_since ?? "",
    education: (t.education ?? []).map((e) => ({
      institution: e.institution ?? "",
      qualification: e.qualification ?? "",
      year: e.year ?? "",
      level: e.level ?? "",
    })),
    exam_results: (t.exam_results ?? []).slice(0, 2).map((r) => ({
      system: r.system ?? "",
      subjects: (r.subjects ?? []).map((s) => ({ subject: s.subject ?? "", grade: s.grade ?? "" })),
    })),
    achievements: (t.achievements ?? []).slice(0, MAX_TUTOR_ACHIEVEMENTS).map((achievement) => ({
      short_text: achievement.short_text ?? "",
      detail_text: achievement.detail_text ?? "",
    })),
    ia_ee_tok_support: t.ia_ee_tok_support ?? [],
    ia_ee_tok_notes: t.ia_ee_tok_notes ?? "",
  };
}

function formToPayload(v: FormValues, isNew: boolean) {
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
  const langs = (v.languages_csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const targetStudents = (v.target_students_csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const base: Record<string, unknown> = {
    display_name: v.tutor_code.trim(),
    headline: v.headline.trim(),
    university: v.university || null,
    highschool: v.highschool || null,
    qualifications_summary: v.qualifications_summary || null,
    subjects: v.subjects,
    target_students: targetStudents,
    district: v.lesson_mode === "online" ? null : v.district || null,
    lesson_mode: v.lesson_mode,
    hourly_rate: v.hourly_rate,
    badge: v.badge || null,
    photo_url: v.photo_url || null,
    tutor_code: v.tutor_code.trim(),
    is_published: v.is_published,
    languages: langs,
    gender: v.gender,
    experience_years: v.experience_years === "" ? null : Number(v.experience_years),
    teaching_since: v.teaching_since === "" ? null : Number(v.teaching_since),
    exam_results: cleanExams,
    achievements: cleanAchievements,
    ia_ee_tok_support: v.ia_ee_tok_support,
    ia_ee_tok_notes: v.ia_ee_tok_notes?.trim() || null,
  };
  return base;
}


function AdminTutors() {
  const { hasAnyRole, loading, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tutor | null>(null);
  const [form, setForm] = useState<FormValues>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["admin", "tutors"],
    queryFn: fetchAllTutors,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tutors;
    return tutors.filter(
      (r) =>
        r.display_name.toLowerCase().includes(q) ||
        r.tutor_code.toLowerCase().includes(q) ||
        (r.subjects ?? []).some((s) => s.toLowerCase().includes(q)),
    );
  }, [tutors, search]);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase
          .from("tutors")
          .update(rest as never)
          .eq("id", id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tutors")
          .insert({ ...payload, created_by: user?.id ?? null } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(empty);
      setErrors({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tutor deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAdd() {
    setEditing(null);
    setForm(empty);
    setErrors({});
    setDialogOpen(true);
  }
  function openEdit(row: Tutor) {
    setEditing(row);
    setForm(tutorToForm(row));
    setErrors({});
    setDialogOpen(true);
  }
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path.join(".")] = issue.message;
      setErrors(errs);
      return;
    }
    const publishErrors: Record<string, string> = {};
    if (parsed.data.is_published) {
      if (!(parsed.data.university ?? "").trim() && !(parsed.data.highschool ?? "").trim()) {
        publishErrors.university = "Add at least university or highschool before publishing.";
      }
      if (
        !(parsed.data.qualifications_summary ?? "").trim() &&
        parsed.data.education.length === 0 &&
        parsed.data.experience_years === ""
      ) {
        publishErrors.qualifications_summary =
          "Add qualifications summary, education, or experience before publishing.";
      }
      if (parsed.data.lesson_mode !== "online" && !(parsed.data.district ?? "").trim()) {
        publishErrors.district = "District is required for in-person or hybrid tutoring.";
      }
    }
    if (Object.keys(publishErrors).length > 0) {
      setErrors(publishErrors);
      return;
    }
    save.mutate({
      ...formToPayload(parsed.data, !editing),
      ...(editing ? { id: editing.id } : {}),
    });
  }

  function addEdu() {
    setForm({
      ...form,
      education: [...form.education, { institution: "", qualification: "", year: "", level: "" }],
    });
  }
  function updateEdu(i: number, patch: Partial<Education & { year: number | "" | null }>) {
    const next = form.education.slice();
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, education: next });
  }
  function removeEdu(i: number) {
    setForm({ ...form, education: form.education.filter((_, idx) => idx !== i) });
  }

  function addExam() {
    if (form.exam_results.length >= 2) return;
    setForm({
      ...form,
      exam_results: [
        ...form.exam_results,
        { system: "ib", subjects: [{ subject: "", grade: "" }] },
      ],
    });
  }
  function updateExamSystem(i: number, system: string) {
    const next = form.exam_results.slice();
    if (next[i].system === system) return;
    // Reset dependent subjects/grades when the system changes.
    next[i] = { system, subjects: [{ subject: "", grade: "" }] };
    setForm({ ...form, exam_results: next });
  }
  function addSubjectRow(i: number) {
    const next = form.exam_results.slice();
    next[i] = { ...next[i], subjects: [...next[i].subjects, { subject: "", grade: "" }] };
    setForm({ ...form, exam_results: next });
  }
  function updateSubjectRow(i: number, j: number, patch: Partial<ExamResultEntry>) {
    const next = form.exam_results.slice();
    const subs = next[i].subjects.slice();
    const current = subs[j];
    // Reset grade if subject changes (grade options depend on subject for some systems).
    if (patch.subject && patch.subject !== current.subject) {
      subs[j] = { ...current, ...patch, grade: "" };
    } else {
      subs[j] = { ...current, ...patch };
    }
    next[i] = { ...next[i], subjects: subs };
    setForm({ ...form, exam_results: next });
  }
  function removeSubjectRow(i: number, j: number) {
    const next = form.exam_results.slice();
    const subs = next[i].subjects.filter((_, idx) => idx !== j);
    next[i] = { ...next[i], subjects: subs.length ? subs : [{ subject: "", grade: "" }] };
    setForm({ ...form, exam_results: next });
  }
  function removeExam(i: number) {
    setForm({ ...form, exam_results: form.exam_results.filter((_, idx) => idx !== i) });
  }
  function addAchievement() {
    if (form.achievements.length >= MAX_TUTOR_ACHIEVEMENTS) return;
    setForm({ ...form, achievements: [...form.achievements, { short_text: "", detail_text: "" }] });
  }
  function updateAchievement(i: number, patch: Partial<TutorAchievement>) {
    const next = form.achievements.slice();
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, achievements: next });
  }
  function removeAchievement(i: number) {
    setForm({ ...form, achievements: form.achievements.filter((_, idx) => idx !== i) });
  }
  function toggleIaEeTokSupport(item: IaEeTokSupport, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...form.ia_ee_tok_support, item]))
      : form.ia_ee_tok_support.filter((value) => value !== item);
    setForm({ ...form, ia_ee_tok_support: next });
  }

  const previewTutor = useMemo<Tutor>(
    () => ({
      id: editing?.id ?? "preview-tutor",
      display_name: form.tutor_code.trim() || "MM-PREVIEW",
      headline: form.headline.trim() || null,
      university: (form.university ?? "").trim() || null,
      highschool: (form.highschool ?? "").trim() || null,
      target_students: (form.target_students_csv ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      academic_summary: null,
      qualifications_summary: (form.qualifications_summary ?? "").trim() || null,
      subjects: form.subjects,
      district: form.lesson_mode === "online" ? null : (form.district ?? "").trim() || null,
      gender: form.gender,
      lesson_mode: form.lesson_mode,
      hourly_rate: Number.isFinite(form.hourly_rate) ? form.hourly_rate : 0,
      badge: (form.badge ?? "").trim() || null,
      bio: (form.bio ?? "").trim() || null,
      photo_url: (form.photo_url ?? "").trim() || null,
      tutor_code: form.tutor_code.trim() || "MM-PREVIEW",
      is_published: form.is_published,
      education: form.education.map((education) => ({
        institution: education.institution,
        qualification: education.qualification,
        year: education.year === "" ? null : education.year,
        level: education.level ?? null,
      })),
      experience_years: form.experience_years === "" ? null : Number(form.experience_years),
      teaching_since: form.teaching_since === "" ? null : Number(form.teaching_since),
      languages: (form.languages_csv ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      exam_results: form.exam_results
        .map((result) => ({
          system: result.system,
          subjects: result.subjects
            .map((subject) => ({ subject: subject.subject.trim(), grade: subject.grade.trim() }))
            .filter((subject) => subject.subject),
        }))
        .filter((result) => result.system && result.subjects.length > 0),
      achievements: form.achievements
        .map((achievement) => ({
          short_text: achievement.short_text.trim(),
          detail_text: achievement.detail_text?.trim() || undefined,
        }))
        .filter((achievement) => achievement.short_text),
      ia_ee_tok_support: form.ia_ee_tok_support,
      ia_ee_tok_notes: (form.ia_ee_tok_notes ?? "").trim() || null,
    }),
    [editing?.id, form],
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
                Tutors
              </h1>
              <p className="mt-2 text-muted-foreground">
                Add, edit or remove tutors shown on MatchMax.
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={openAdd}
                  className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add tutor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[94vh] overflow-y-auto bg-white sm:max-w-[min(96vw,88rem)]">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit tutor" : "Add tutor"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="py-1">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                    <div className="space-y-6">
                      <Section title="Tutor identity">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Tutor code (unique)" error={errors.tutor_code}>
                            <Input
                              value={form.tutor_code}
                              onChange={(e) => setForm({ ...form, tutor_code: e.target.value })}
                              placeholder="MM-1042"
                            />
                          </Field>
                          <Field label="Gender" error={errors.gender}>
                            <SearchableSelect
                              value={form.gender}
                              onChange={(gender) =>
                                setForm({
                                  ...form,
                                  gender: gender as "male" | "female" | "other",
                                })
                              }
                              options={[
                                { value: "female", label: "Female" },
                                { value: "male", label: "Male" },
                                { value: "other", label: "Other" },
                              ]}
                              placeholder="Select gender"
                              searchPlaceholder="Search gender…"
                            />
                          </Field>
                        </div>
                        <Field label="Headline" error={errors.headline}>
                          <Input
                            value={form.headline}
                            onChange={(e) => setForm({ ...form, headline: e.target.value })}
                            placeholder="IB Biology tutor focused on exam strategy"
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="University" error={errors.university}>
                            <Input
                              value={form.university}
                              onChange={(e) => setForm({ ...form, university: e.target.value })}
                              placeholder="Chinese University of Hong Kong"
                            />
                          </Field>
                          <Field label="Highschool" error={errors.highschool}>
                            <Input
                              value={form.highschool}
                              onChange={(e) => setForm({ ...form, highschool: e.target.value })}
                              placeholder="Diocesan Boys' School"
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Photo (optional)" error={errors.photo_url}>
                            <PhotoUpload
                              value={form.photo_url ?? ""}
                              onChange={(url) => setForm({ ...form, photo_url: url })}
                            />
                          </Field>
                          <Field label="Badge (optional)" error={errors.badge}>
                            <Input
                              value={form.badge}
                              onChange={(e) => setForm({ ...form, badge: e.target.value })}
                              placeholder="CUHK MBChB Year 2"
                            />
                          </Field>
                        </div>
                      </Section>

                      <Section title="Subjects">
                        <Field label="Subjects" error={errors.subjects}>
                          <div className="space-y-2">
                            {form.subjects.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {form.subjects.map((s) => (
                                  <span
                                    key={s}
                                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-navy)]/10 px-2.5 py-1 text-xs font-medium text-[color:var(--brand-navy)]"
                                  >
                                    {s}
                                    <button
                                      type="button"
                                      aria-label={`Remove ${s}`}
                                      onClick={() =>
                                        setForm({
                                          ...form,
                                          subjects: form.subjects.filter((x) => x !== s),
                                        })
                                      }
                                      className="hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <SearchableSelect
                              value=""
                              onChange={(v) => {
                                const val = v.trim();
                                if (!val) return;
                                if (form.subjects.includes(val)) return;
                                setForm({ ...form, subjects: [...form.subjects, val] });
                              }}
                              options={SUBJECT_OPTIONS.filter((s) => !form.subjects.includes(s))}
                              placeholder="Add a subject…"
                              searchPlaceholder="Search or type a subject…"
                              allowCustom
                            />
                          </div>
                        </Field>

                        <Field label="Target students" error={errors.target_students_csv}>
                          {(() => {
                            const targetStudentsValue = form.target_students_csv ?? "";
                            const targetStudentList = targetStudentsValue
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean);

                            return (
                              <div className="space-y-2">
                                {targetStudentList.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {targetStudentList.map((item) => (
                                      <span
                                        key={item}
                                        className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-navy)]/10 px-2.5 py-1 text-xs font-medium text-[color:var(--brand-navy)]"
                                      >
                                        {item}
                                        <button
                                          type="button"
                                          aria-label={`Remove ${item}`}
                                          onClick={() => {
                                            const next = targetStudentList.filter(
                                              (value) => value !== item,
                                            );
                                            setForm({
                                              ...form,
                                              target_students_csv: next.join(", "),
                                            });
                                          }}
                                          className="hover:text-destructive"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                <SearchableSelect
                                  value=""
                                  onChange={(value) => {
                                    const val = value.trim();
                                    if (!val) return;
                                    const current = targetStudentList;
                                    if (current.includes(val)) return;
                                    setForm({
                                      ...form,
                                      target_students_csv: [...current, val].join(", "),
                                    });
                                  }}
                                  options={TARGET_STUDENT_OPTIONS.filter(
                                    (value) => !targetStudentList.includes(value),
                                  )}
                                  placeholder="Add target students…"
                                  searchPlaceholder="Search target students…"
                                  allowCustom
                                />
                              </div>
                            );
                          })()}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Separate multiple targets with commas.
                          </p>
                        </Field>
                      </Section>

                      <Section title="Academic Excellence">
                        <div className="space-y-3">
                        

                        <p className="text-xs text-muted-foreground">
                          Pick an exam system, then add each subject with its grade. The first
                          system is the primary qualification shown publicly; the optional second
                          system is displayed alongside it. Lists are searchable and match the
                          chosen system.
                        </p>
                        <div className="space-y-4">
                          {form.exam_results.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No scores yet. Add an exam system below.
                            </p>
                          )}
                          {form.exam_results.map((row, i) => {
                            const sys = getSystem(row.system);
                            const subjectOptions = sys?.subjects ?? [];
                            return (
                              <div
                                key={i}
                                className="rounded-xl border border-border bg-muted/30 p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="min-w-[180px] flex-1">
                                    <SearchableSelect
                                      value={row.system}
                                      onChange={(v) => updateExamSystem(i, v)}
                                      options={EXAM_SYSTEMS.map((s) => ({
                                        value: s.id,
                                        label: s.label,
                                      }))}
                                      placeholder="Exam system"
                                      searchPlaceholder="Search systems…"
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addSubjectRow(i)}
                                  >
                                    <Plus className="mr-1 h-3.5 w-3.5" /> Subject
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => removeExam(i)}
                                    aria-label="Remove exam system"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {row.subjects.map((entry, j) => {
                                    const gradeOptions = getGradesForSelection(
                                      row.system,
                                      entry.subject,
                                    );
                                    return (
                                      <div
                                        key={j}
                                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,140px)_auto] gap-2"
                                      >
                                        <SearchableSelect
                                          value={entry.subject}
                                          onChange={(v) => updateSubjectRow(i, j, { subject: v })}
                                          options={subjectOptions}
                                          placeholder={
                                            sys?.freeSubject ? "Type a subject" : "Subject"
                                          }
                                          searchPlaceholder="Search subjects…"
                                          allowCustom={sys?.freeSubject ?? false}
                                          disabled={!row.system}
                                        />
                                        <SearchableSelect
                                          value={entry.grade}
                                          onChange={(v) => updateSubjectRow(i, j, { grade: v })}
                                          options={gradeOptions}
                                          placeholder={
                                            gradeOptions.length === 0 ? "Type a grade" : "Grade"
                                          }
                                          searchPlaceholder="Search grades…"
                                          allowCustom={gradeOptions.length === 0}
                                          disabled={!entry.subject}
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removeSubjectRow(i, j)}
                                          aria-label="Remove subject"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={addExam}
                            disabled={form.exam_results.length >= 2}
                          >
                            <Plus className="mr-2 h-4 w-4" /> Add exam system
                          </Button>
                        </div>
                      </Section>

                      <Section title="Achievements and Experiences">
                        <p className="text-xs text-muted-foreground">
                          Add up to {MAX_TUTOR_ACHIEVEMENTS} highlights. The short line appears on
                          the public card; the optional detail appears on the tutor profile.
                        </p>
                        <div className="space-y-3">
                          {form.achievements.map((achievement, index) => (
                            <div
                              key={index}
                              className="rounded-xl border border-border bg-muted/30 p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold text-[color:var(--brand-navy)]">
                                  Highlight {index + 1}
                                </p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAchievement(index)}
                                  aria-label={`Remove highlight ${index + 1}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="mt-2 space-y-3">
                                <Field
                                  label={`Short card line (${achievement.short_text.length}/${TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT} characters)`}
                                  error={errors[`achievements.${index}.short_text`]}
                                >
                                  <Input
                                    value={achievement.short_text}
                                    maxLength={TUTOR_ACHIEVEMENT_SHORT_TEXT_LIMIT}
                                    onChange={(event) =>
                                      updateAchievement(index, { short_text: event.target.value })
                                    }
                                    placeholder="e.g. Award-winning debate coach"
                                  />
                                </Field>
                                <Field
                                  label="Profile detail (optional)"
                                  error={errors[`achievements.${index}.detail_text`]}
                                >
                                  <Textarea
                                    rows={3}
                                    value={achievement.detail_text ?? ""}
                                    maxLength={1000}
                                    onChange={(event) =>
                                      updateAchievement(index, { detail_text: event.target.value })
                                    }
                                    placeholder="Add context that prospective students can read on the full profile."
                                  />
                                </Field>
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={addAchievement}
                            disabled={form.achievements.length >= MAX_TUTOR_ACHIEVEMENTS}
                          >
                            <Plus className="mr-2 h-4 w-4" /> Add achievement
                          </Button>
                        </div>
                      </Section>

                      <Section title="IA / EE / TOK Support">
                        <p className="text-xs text-muted-foreground">
                          Select the mentoring support this tutor offers. This section is only shown
                          on public profiles when at least one option is selected.
                        </p>
                        <div
                          className="flex flex-wrap gap-3"
                          role="group"
                          aria-label="IA, EE, and TOK support"
                        >
                          {IA_EE_TOK_SUPPORT_OPTIONS.map((item) => (
                            <label
                              key={item}
                              className="flex cursor-pointer items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-[color:var(--brand-navy)]"
                            >
                              <Checkbox
                                checked={form.ia_ee_tok_support.includes(item)}
                                onCheckedChange={(checked) =>
                                  toggleIaEeTokSupport(item, checked === true)
                                }
                              />
                              {item}
                            </label>
                          ))}
                        </div>
                        <Field label="Support notes (optional)" error={errors.ia_ee_tok_notes}>
                          <Textarea
                            rows={3}
                            value={form.ia_ee_tok_notes}
                            maxLength={1000}
                            onChange={(event) =>
                              setForm({ ...form, ia_ee_tok_notes: event.target.value })
                            }
                            placeholder="e.g. Topic selection, outline review, and structural framework support."
                          />
                        </Field>
                      </Section>

                      <Section title="Qualifications and Experience">
                        <Field
                          label="Qualifications & teaching profile"
                          error={errors.qualifications_summary}
                        >
                          <Textarea
                            rows={4}
                            value={form.qualifications_summary}
                            onChange={(e) =>
                              setForm({ ...form, qualifications_summary: e.target.value })
                            }
                            placeholder="Private tutoring focused on medical-track sciences since 2024"
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Languages (comma separated)" error={errors.languages_csv}>
                            <Input
                              value={form.languages_csv}
                              onChange={(e) => setForm({ ...form, languages_csv: e.target.value })}
                              placeholder="English, Cantonese"
                            />
                          </Field>
                          <Field label="Experience (years)" error={errors.experience_years}>
                            <Input
                              type="number"
                              value={form.experience_years}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === "") {
                                  setForm({ ...form, experience_years: "", teaching_since: "" });
                                } else {
                                  const years = Number(raw);
                                  setForm({
                                    ...form,
                                    experience_years: years,
                                    teaching_since: new Date().getFullYear() - years,
                                  });
                                }
                              }}
                            />
                          </Field>
                        </div>
                        <Field label="Teaching since (year)" error={errors.teaching_since}>
                          <Input
                            type="number"
                            value={form.teaching_since}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                setForm({ ...form, teaching_since: "", experience_years: "" });
                              } else {
                                const year = Number(raw);
                                setForm({
                                  ...form,
                                  teaching_since: year,
                                  experience_years: Math.max(0, new Date().getFullYear() - year),
                                });
                              }
                            }}
                            placeholder="2015"
                          />
                        </Field>
                      </Section>

                      <Section title="Lesson Format">
                        <Field label="Lesson mode" error={errors.lesson_mode}>
                          <ToggleGroup
                            type="single"
                            variant="outline"
                            value={form.lesson_mode}
                            onValueChange={(value) => {
                              if (!value) return;
                              setForm({
                                ...form,
                                lesson_mode: value as FormValues["lesson_mode"],
                                district: value === "online" ? "" : form.district,
                              });
                            }}
                            className="grid w-full grid-cols-3 gap-2"
                          >
                            <ToggleGroupItem value="online" className="w-full">
                              Online
                            </ToggleGroupItem>
                            <ToggleGroupItem value="in_person" className="w-full">
                              In person
                            </ToggleGroupItem>
                            <ToggleGroupItem value="either" className="w-full">
                              Hybrid
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {form.lesson_mode !== "online" ? (
                            <Field label="District" error={errors.district}>
                              <Select
                                value={form.district || "__none"}
                                onValueChange={(v) =>
                                  setForm({ ...form, district: v === "__none" ? "" : v })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">—</SelectItem>
                                  {HK_DISTRICTS.map((d) => (
                                    <SelectItem key={d} value={d}>
                                      {d}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          ) : (
                            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground sm:mt-6">
                              Online lessons do not need a district.
                            </div>
                          )}
                          <Field label="Hourly rate (HKD)" error={errors.hourly_rate}>
                            <Input
                              type="number"
                              value={form.hourly_rate}
                              onChange={(e) =>
                                setForm({ ...form, hourly_rate: Number(e.target.value) })
                              }
                            />
                          </Field>
                        </div>
                      </Section>

                      <div className="flex items-center gap-3 pt-2">
                        <Switch
                          id="pub"
                          checked={form.is_published}
                          onCheckedChange={(v) => setForm({ ...form, is_published: v })}
                        />
                        <Label htmlFor="pub">Published (visible to visitors)</Label>
                      </div>

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={save.isPending}
                          className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
                        >
                          {save.isPending ? "Saving…" : editing ? "Save changes" : "Add tutor"}
                        </Button>
                      </DialogFooter>
                    </div>

                    <aside className="rounded-2xl border border-border bg-muted/30 p-4 xl:sticky xl:top-0">
                      <div className="mb-3">
                        <h3 className="text-sm font-bold text-[color:var(--brand-navy)]">
                          Live public-card preview
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          This uses the same card that visitors see and updates as you edit.
                        </p>
                      </div>
                      <PublicTutorCard
                        tutor={previewTutor}
                        priceSuffix="/hr"
                        footerAction={
                          <Button
                            type="button"
                            size="sm"
                            disabled
                            className="pointer-events-none text-xs"
                          >
                            Preview
                          </Button>
                        }
                      />
                    </aside>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-8">
            <Input
              placeholder="Search by name, code, or subject…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Tutor</th>
                  <th className="px-4 py-3">Subjects</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-t border-border">
                      <td className="px-4 py-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-2 h-3 w-40" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="ml-auto h-8 w-24" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No tutors yet. Click “Add tutor” to create one.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link
                        to="/tutors/$tutorCode"
                        params={{ tutorCode: row.tutor_code }}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {row.tutor_code}
                        {getTutorGenderLabel(row.gender)
                          ? ` · ${getTutorGenderLabel(row.gender)}`
                          : ""}
                      </Link>
                      <p className="text-xs leading-relaxed text-muted-foreground break-words whitespace-pre-line">
                        {row.headline ?? "No headline yet"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(row.subjects ?? []).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.district ?? "—"}</td>
                    <td className="px-4 py-3">HK${row.hourly_rate}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.is_published
                            ? "text-[color:var(--brand-teal)]"
                            : "text-muted-foreground"
                        }
                      >
                        {row.is_published ? "Published" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/tutors/$tutorCode" params={{ tutorCode: row.tutor_code }}>
                            View profile
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Delete tutor "${row.tutor_code}"?`)) remove.mutate(row.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
