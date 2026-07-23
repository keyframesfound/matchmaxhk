import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { StarRating } from "@/components/ui/StarRating";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import { fetchAllTutors, HK_DISTRICTS, type Tutor, type Education } from "@/features/tutors/queries";
import { EXAM_SYSTEMS, getSystem, getGradesForSelection, type ExamResult, type ExamResultEntry } from "@/features/tutors/examSystems";
import { SearchableSelect } from "@/components/ui/searchable-select";

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

import { DEFAULT_SUBJECT_OPTIONS as SUBJECT_OPTIONS } from "@/features/tutors/subjects";

const CURRENT_YEAR = new Date().getFullYear();

const eduSchema = z.object({
  institution: z.string().trim().min(1).max(120),
  qualification: z.string().trim().min(1).max(120),
  year: z.union([z.coerce.number().int().min(1900).max(2100), z.literal(""), z.null()]).optional(),
  level: z.string().trim().max(60).optional().or(z.literal("")).nullable(),
});

const examEntrySchema = z.object({
  subject: z.string().trim().min(1).max(120),
  grade: z.string().trim().min(1).max(40),
});

const examSchema = z.object({
  system: z.string().trim().min(1),
  subjects: z.array(examEntrySchema).min(1, "Add at least one subject"),
});

const formSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  headline: z.string().trim().max(200).optional().or(z.literal("")),
  subjects: z.array(z.string().trim().min(1).max(80)).min(1, "Pick at least one subject"),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  hourly_rate: z.coerce.number().int().min(0).max(100000),
  badge: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  photo_url: z.string().trim().max(1000).optional().or(z.literal("")),
  tutor_code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, dashes only"),
  weekly_rating: z.coerce.number().min(0).max(5),
  weekly_score: z.coerce.number().int().min(0).max(100),
  is_published: z.boolean(),
  languages_csv: z.string().trim().max(200).optional().or(z.literal("")),
  experience_years: z.coerce.number().int().min(0).max(80).optional().or(z.literal("")),
  teaching_since: z.union([z.coerce.number().int().min(1950).max(2100), z.literal("")]).optional(),
  education: z.array(eduSchema),
  exam_results: z.array(examSchema),
});

type FormValues = z.infer<typeof formSchema>;

const empty: FormValues = {
  display_name: "",
  headline: "",
  subjects: [],
  district: "",
  hourly_rate: 0,
  badge: "",
  bio: "",
  photo_url: "",
  tutor_code: "",
  weekly_rating: 5,
  weekly_score: 50,
  is_published: true,
  languages_csv: "",
  experience_years: "",
  teaching_since: "",
  education: [],
  exam_results: [],
};

function tutorToForm(t: Tutor): FormValues {
  return {
    display_name: t.display_name,
    headline: t.headline ?? "",
    subjects: t.subjects ?? [],
    district: t.district ?? "",
    hourly_rate: t.hourly_rate,
    badge: t.badge ?? "",
    bio: t.bio ?? "",
    photo_url: t.photo_url ?? "",
    tutor_code: t.tutor_code,
    weekly_rating: Number(t.weekly_rating),
    weekly_score: t.weekly_score,
    is_published: t.is_published,
    languages_csv: (t.languages ?? []).join(", "),
    experience_years: t.experience_years ?? "",
    teaching_since: t.teaching_since ?? "",
    education: (t.education ?? []).map((e) => ({
      institution: e.institution ?? "",
      qualification: e.qualification ?? "",
      year: e.year ?? "",
      level: e.level ?? "",
    })),
    exam_results: (t.exam_results ?? []).map((r) => ({
      system: r.system ?? "",
      subjects: (r.subjects ?? []).map((s) => ({ subject: s.subject ?? "", grade: s.grade ?? "" })),
    })),
  };
}

function formToPayload(v: FormValues, isNew: boolean) {
  const cleanEdu: Education[] = v.education
    .map((e) => ({
      institution: e.institution.trim(),
      qualification: e.qualification.trim(),
      year: e.year === "" || e.year == null ? null : Number(e.year),
      level: e.level && e.level.trim() ? e.level.trim() : null,
    }))
    .filter((e) => e.institution && e.qualification);
  const cleanExams: ExamResult[] = v.exam_results
    .map((r) => ({
      system: r.system,
      subjects: (r.subjects ?? [])
        .map((s) => ({ subject: s.subject.trim(), grade: s.grade.trim() }))
        .filter((s) => s.subject && s.grade),
    }))
    .filter((r) => r.system && r.subjects.length > 0);
  const langs = (v.languages_csv || "").split(",").map((s) => s.trim()).filter(Boolean);
  const base: Record<string, unknown> = {
    display_name: v.display_name,
    headline: v.headline || null,
    subjects: v.subjects,
    district: v.district || null,
    hourly_rate: v.hourly_rate,
    badge: v.badge || null,
    bio: v.bio || null,
    photo_url: v.photo_url || null,
    tutor_code: v.tutor_code.trim(),
    weekly_rating: v.weekly_rating,
    weekly_score: v.weekly_score,
    is_published: v.is_published,
    languages: langs,
    experience_years: v.experience_years === "" ? null : Number(v.experience_years),
    teaching_since: v.teaching_since === "" ? null : Number(v.teaching_since),
    education: cleanEdu,
    exam_results: cleanExams,
  };
  if (isNew) {
    // New tutors start at 5★; rating auto-updates once reviews exist.
    base.rating = 5.0;
    base.review_count = 0;
  }
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
    return tutors.filter((r) =>
      r.display_name.toLowerCase().includes(q) ||
      r.tutor_code.toLowerCase().includes(q) ||
      (r.subjects ?? []).some((s) => s.toLowerCase().includes(q)),
    );
  }, [tutors, search]);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("tutors").update(rest as never).eq("id", id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tutors").insert({ ...payload, created_by: user?.id ?? null } as never);
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
    save.mutate({ ...formToPayload(parsed.data, !editing), ...(editing ? { id: editing.id } : {}) });
  }

  function addEdu() {
    setForm({ ...form, education: [...form.education, { institution: "", qualification: "", year: "", level: "" }] });
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
    setForm({
      ...form,
      exam_results: [...form.exam_results, { system: "ib", subjects: [{ subject: "", grade: "" }] }],
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
                Tutors
              </h1>
              <p className="mt-2 text-muted-foreground">Add, edit or remove tutors shown on MatchMax.</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAdd} className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                  <Plus className="mr-2 h-4 w-4" /> Add tutor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit tutor" : "Add tutor"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-6">
                  <Section title="Basics">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Display name" error={errors.display_name}>
                        <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                      </Field>
                      <Field label="Tutor code (unique)" error={errors.tutor_code}>
                        <Input value={form.tutor_code} onChange={(e) => setForm({ ...form, tutor_code: e.target.value })} placeholder="MM-1042" />
                      </Field>
                    </div>
                    <Field label="Headline" error={errors.headline}>
                      <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="DSE Mathematics · M2" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Badge (short credential)" error={errors.badge}>
                        <Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="PhD Cambridge" />
                      </Field>
                      <Field label="Photo (optional)" error={errors.photo_url}>
                        <PhotoUpload
                          value={form.photo_url}
                          onChange={(url) => setForm({ ...form, photo_url: url })}
                        />
                      </Field>
                    </div>
                  </Section>

                  <Section title="Teaching">
                    <Field label="Subjects" error={errors.subjects}>
                      <div className="space-y-2">
                        {form.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {form.subjects.map((s) => (
                              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-navy)]/10 px-2.5 py-1 text-xs font-medium text-[color:var(--brand-navy)]">
                                {s}
                                <button
                                  type="button"
                                  aria-label={`Remove ${s}`}
                                  onClick={() => setForm({ ...form, subjects: form.subjects.filter((x) => x !== s) })}
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
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="District" error={errors.district}>
                        <Select value={form.district || "__none"} onValueChange={(v) => setForm({ ...form, district: v === "__none" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">—</SelectItem>
                            {HK_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Hourly rate (HKD)" error={errors.hourly_rate}>
                        <Input type="number" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: Number(e.target.value) })} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Languages (comma separated)" error={errors.languages_csv}>
                        <Input value={form.languages_csv} onChange={(e) => setForm({ ...form, languages_csv: e.target.value })} placeholder="English, Cantonese" />
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
                              setForm({ ...form, experience_years: years, teaching_since: CURRENT_YEAR - years });
                            }
                          }}
                        />
                      </Field>
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
                              setForm({ ...form, teaching_since: year, experience_years: Math.max(0, CURRENT_YEAR - year) });
                            }
                          }}
                          placeholder="2015"
                        />
                      </Field>
                    </div>
                    <Field label="Bio" error={errors.bio}>
                      <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
                    </Field>
                  </Section>

                  <Section title="Education & qualifications">
                    <div className="space-y-3">
                      {form.education.length === 0 && (
                        <p className="text-sm text-muted-foreground">No qualifications yet. Add one below.</p>
                      )}
                      {form.education.map((row, i) => (
                        <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-[160px_1fr_1fr_100px_auto]">
                          <Select
                            value={row.level || "__none"}
                            onValueChange={(v) => updateEdu(i, { level: v === "__none" ? "" : v })}
                          >
                            <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">Level…</SelectItem>
                              {EDUCATION_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input placeholder="Institution (e.g. DBS, HKU)" value={row.institution} onChange={(e) => updateEdu(i, { institution: e.target.value })} />
                          <Input placeholder="Qualification (e.g. HKDSE, BSc Maths)" value={row.qualification} onChange={(e) => updateEdu(i, { qualification: e.target.value })} />
                          <Input
                            type="number"
                            placeholder="Year"
                            value={row.year ?? ""}
                            onChange={(e) => updateEdu(i, { year: e.target.value === "" ? null : Number(e.target.value) })}
                          />
                          <Button type="button" variant="outline" size="icon" onClick={() => removeEdu(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addEdu}>
                        <Plus className="mr-2 h-4 w-4" /> Add qualification
                      </Button>
                    </div>
                  </Section>

                  <Section title="Exam results (scores)">
                    <p className="text-xs text-muted-foreground">
                      Pick an exam system, then add each subject with its grade. Lists are searchable and match the chosen system.
                    </p>
                    <div className="space-y-4">
                      {form.exam_results.length === 0 && (
                        <p className="text-sm text-muted-foreground">No scores yet. Add an exam system below.</p>
                      )}
                      {form.exam_results.map((row, i) => {
                        const sys = getSystem(row.system);
                        const subjectOptions = sys?.subjects ?? [];
                        return (
                          <div key={i} className="rounded-xl border border-border bg-muted/30 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="min-w-[180px] flex-1">
                                <SearchableSelect
                                  value={row.system}
                                  onChange={(v) => updateExamSystem(i, v)}
                                  options={EXAM_SYSTEMS.map((s) => ({ value: s.id, label: s.label }))}
                                  placeholder="Exam system"
                                  searchPlaceholder="Search systems…"
                                />
                              </div>
                              <Button type="button" variant="outline" size="sm" onClick={() => addSubjectRow(i)}>
                                <Plus className="mr-1 h-3.5 w-3.5" /> Subject
                              </Button>
                              <Button type="button" variant="outline" size="icon" onClick={() => removeExam(i)} aria-label="Remove exam system">
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="mt-3 space-y-2">
                              {row.subjects.map((entry, j) => {
                                const gradeOptions = getGradesForSelection(row.system, entry.subject);
                                return (
                                  <div
                                    key={j}
                                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,140px)_auto] gap-2"
                                  >
                                    <SearchableSelect
                                      value={entry.subject}
                                      onChange={(v) => updateSubjectRow(i, j, { subject: v })}
                                      options={subjectOptions}
                                      placeholder={sys?.freeSubject ? "Type a subject" : "Subject"}
                                      searchPlaceholder="Search subjects…"
                                      allowCustom={sys?.freeSubject ?? false}
                                      disabled={!row.system}
                                    />
                                    <SearchableSelect
                                      value={entry.grade}
                                      onChange={(v) => updateSubjectRow(i, j, { grade: v })}
                                      options={gradeOptions}
                                      placeholder={gradeOptions.length === 0 ? "Type a grade" : "Grade"}
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
                      <Button type="button" variant="outline" onClick={addExam}>
                        <Plus className="mr-2 h-4 w-4" /> Add exam system
                      </Button>
                    </div>
                  </Section>




                  <Section title="Scoring">
                    {editing && (
                      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        Overall rating auto-updates from reviews. Current: <strong>{Number(editing.rating).toFixed(1)}★</strong> ({editing.review_count} review{editing.review_count === 1 ? "" : "s"}).
                      </p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="This week rating">
                        <StarRating value={form.weekly_rating} onChange={(v) => setForm({ ...form, weekly_rating: v })} />
                      </Field>
                      <Field label={`Weekly rank score (${form.weekly_score})`}>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={[form.weekly_score]}
                          onValueChange={(v) => setForm({ ...form, weekly_score: v[0] ?? 0 })}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">Higher = shown earlier in “Featured tutors”.</p>
                      </Field>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <Switch id="pub" checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
                      <Label htmlFor="pub">Published (visible to visitors)</Label>
                    </div>
                  </Section>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={save.isPending} className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                      {save.isPending ? "Saving…" : (editing ? "Save changes" : "Add tutor")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-8">
            <Input placeholder="Search by name, code, or subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Subjects</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No tutors yet. Click “Add tutor” to create one.</td></tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link to="/tutors/$tutorCode" params={{ tutorCode: row.tutor_code }} className="font-semibold text-foreground hover:underline">
                        {row.display_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.tutor_code}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{(row.subjects ?? []).join(", ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.district ?? "—"}</td>
                    <td className="px-4 py-3">HK${row.hourly_rate}</td>
                    <td className="px-4 py-3">{Number(row.rating).toFixed(1)}★ <span className="text-xs text-muted-foreground">({row.review_count})</span></td>
                    <td className="px-4 py-3">{row.weekly_score}</td>
                    <td className="px-4 py-3">
                      <span className={row.is_published ? "text-[color:var(--brand-teal)]" : "text-muted-foreground"}>
                        {row.is_published ? "Published" : "Hidden"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/tutors/$tutorCode" params={{ tutorCode: row.tutor_code }}>Reviews</Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Delete tutor "${row.display_name}"?`)) remove.mutate(row.id);
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
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
