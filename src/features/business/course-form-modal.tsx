import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DatePicker, dateToIso, isoToDate } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Toggle } from "@/components/base/toggle/toggle";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteOrganizationImage,
  uploadOrganizationImage,
} from "@/features/business/business.functions";
import {
  COURSE_FORMATS,
  COURSE_FORMAT_LABELS,
  COURSE_HIGHLIGHTS_MAX,
  COURSE_HIGHLIGHT_MAX_CHARS,
  COURSE_INSTRUCTION_LANGUAGES,
  COURSE_INSTRUCTION_LANGUAGE_LABELS,
  COURSE_PRICE_DISPLAY_MAX_CHARS,
  COURSE_SCHEDULE_SUMMARY_MAX_CHARS,
  normalizeHighlights,
  normalizeInstructionLanguages,
} from "@/features/business/course-showcase";
import { listAssignableAffiliates } from "@/features/business/course-showcase.functions";
import type { Organization } from "@/features/business/useMyOrganization";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { COURSE_LEVEL_OPTIONS, COURSE_MODE_OPTIONS, type Course } from "@/features/courses/queries";

type CourseFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization;
  course: Course | null;
  duplicate?: boolean;
  onSaved: () => void;
};

type FormState = {
  title: string;
  summary: string;
  description: string;
  subject: string;
  level: string;
  mode: "online" | "in_person" | "either";
  price: string;
  schedule_text: string;
  session_days: string[];
  start_date: string;
  end_date: string;
  district: string;
  is_published: boolean;
  curriculum: string;
  target_grade: string;
  format: string;
  schedule_summary: string;
  price_display: string;
  trial_available: boolean;
  highlights: string[];
  instruction_languages: string[];
  assigned_tutor_id: string;
};

type AffiliateOption = { userId: string; tutorCode: string; displayName: string };

const WEEKDAY_OPTIONS = [
  { code: "sun", label: "Sun" },
  { code: "mon", label: "Mon" },
  { code: "tue", label: "Tue" },
  { code: "wed", label: "Wed" },
  { code: "thu", label: "Thu" },
  { code: "fri", label: "Fri" },
  { code: "sat", label: "Sat" },
];

/** The form always shows three highlight slots, even when a course has fewer. */
function toHighlightSlots(values: string[] | null | undefined): string[] {
  const slots = (values ?? []).slice(0, COURSE_HIGHLIGHTS_MAX);
  while (slots.length < COURSE_HIGHLIGHTS_MAX) slots.push("");
  return slots;
}

function ChipToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? "border-[color:var(--btn-accent)] bg-[color:var(--btn-accent)] text-[color:var(--btn-accent-fg)]"
          : "border-transparent bg-muted text-muted-foreground hover:text-[color:var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function getInitialFormState(course: Course | null, duplicate: boolean): FormState {
  return {
    title: course?.title ?? "",
    summary: course?.summary ?? "",
    description: course?.description ?? "",
    subject: course?.subject ?? "",
    level: course?.level ?? "",
    mode: course?.mode ?? "either",
    price: course?.price !== null && course?.price !== undefined ? String(course.price) : "",
    schedule_text: course?.schedule_text ?? "",
    session_days: [...(course?.session_days ?? [])],
    start_date: course?.start_date ?? "",
    end_date: course?.end_date ?? "",
    district: course?.district ?? "",
    is_published: duplicate ? false : (course?.is_published ?? true),
    curriculum: course?.curriculum ?? "",
    target_grade: course?.target_grade ?? "",
    format: course?.format ?? "",
    schedule_summary: course?.schedule_summary ?? "",
    price_display: course?.price_display ?? "",
    trial_available: course?.trial_available ?? false,
    highlights: toHighlightSlots(course?.highlights),
    instruction_languages: [...(course?.instruction_languages ?? [])],
    assigned_tutor_id: course?.assigned_tutor_id ?? "",
  };
}

export function CourseFormModal({
  open,
  onOpenChange,
  organization,
  course,
  duplicate = false,
  onSaved,
}: CourseFormModalProps) {
  const uploadImageFn = useServerFn(uploadOrganizationImage);
  const deleteImageFn = useServerFn(deleteOrganizationImage);
  const listAffiliatesFn = useServerFn(listAssignableAffiliates);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [affiliates, setAffiliates] = useState<AffiliateOption[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(course?.image_url ?? null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => getInitialFormState(course, duplicate));

  useEffect(() => {
    if (!open) return;
    setForm(getInitialFormState(course, duplicate));
    setImageUrl(course?.image_url ?? null);
    setImageKey(null);
  }, [open, course, duplicate]);

  // The tutor list is a convenience, never a blocker: a failed fetch leaves the
  // "No assigned tutor" option in place.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAffiliates([]);
    void (async () => {
      try {
        const rows = await listAffiliatesFn({ data: { orgId: organization.id } });
        if (!cancelled) setAffiliates(rows ?? []);
      } catch {
        if (!cancelled) setAffiliates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organization.id, listAffiliatesFn]);

  const setField = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const fileToBase64 = async (file: File): Promise<string> => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return btoa(binary);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = (await uploadImageFn({
        data: {
          orgId: organization.id,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          base64Data: await fileToBase64(file),
        },
      })) as { key: string; url: string };
      setImageUrl(result.url);
      setImageKey(result.key);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!imageKey) {
      setImageUrl(null);
      return;
    }
    setRemovingImage(true);
    try {
      await deleteImageFn({ data: { orgId: organization.id, key: imageKey } });
      setImageUrl(null);
      setImageKey(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove image");
    } finally {
      setRemovingImage(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      description: form.description.trim() || null,
      subject: form.subject || null,
      level: form.level || null,
      mode: form.mode,
      price: form.price.trim() === "" ? null : Number(form.price),
      schedule_text: form.schedule_text.trim() || null,
      session_days: form.session_days,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      district: form.district || null,
      image_url: imageUrl,
      is_published: form.is_published,
      curriculum: form.curriculum.trim() || null,
      target_grade: form.target_grade.trim() || null,
      format: form.format || null,
      schedule_summary: form.schedule_summary.trim() || null,
      price_display: form.price_display.trim() || null,
      trial_available: form.trial_available,
      highlights: normalizeHighlights(form.highlights),
      instruction_languages: normalizeInstructionLanguages(form.instruction_languages),
      assigned_tutor_id: form.assigned_tutor_id || null,
    };

    setSaving(true);
    try {
      if (course && !duplicate) {
        const { error } = await supabase.from("courses").update(payload).eq("id", course.id);
        if (error) throw new Error(error.message);
        toast.success("Course updated");
      } else {
        const { error } = await supabase.from("courses").insert({
          organization_id: organization.id,
          ...payload,
        });
        if (error) throw new Error(error.message);
        toast.success("Course created");
      }
      onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("is not an approved affiliated tutor")) {
        // The DB guard fires when a card still points at a tutor whose
        // affiliation was withdrawn. Raw Postgres text would confuse the admin.
        toast.error(
          "That tutor is no longer affiliated with your centre. Clear the assigned tutor and save again.",
        );
      } else {
        toast.error(message || "Failed to save course");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {course ? (duplicate ? "Duplicate course" : "Edit course") : "New course"}
          </DialogTitle>
          <DialogDescription>
            {course && !duplicate
              ? "Update the details of this course."
              : "Publish a course to the public directory. You can unpublish it any time."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="course-title">Course title *</Label>
            <Input
              required
              maxLength={160}
              placeholder="e.g. IB Physics intensive revision"
              value={form.title}
              onChange={(e) => setField({ title: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Course image</Label>
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={imageUrl}
                  alt=""
                  className="h-16 w-28 rounded-md border border-border object-cover"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={removingImage}
                  onClick={handleRemoveImage}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await handleImageUpload(file);
                  e.target.value = "";
                }}
              />
            )}
            {uploading && <p className="text-xs text-muted-foreground">Uploading image…</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Level</Label>
              <SearchableSelect
                value={form.level}
                onChange={(v) => setField({ level: v })}
                options={[
                  { value: "", label: "No level" },
                  ...COURSE_LEVEL_OPTIONS.map((level) => ({ value: level, label: level })),
                ]}
                placeholder="No level"
                searchPlaceholder="Search level..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <SearchableSelect
                value={form.subject}
                onChange={(v) => setField({ subject: v })}
                options={[
                  { value: "", label: "No subject" },
                  ...DEFAULT_SUBJECT_OPTIONS.map((s) => ({ value: s, label: s })),
                ]}
                placeholder="No subject"
                searchPlaceholder="Search subject..."
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Lesson mode</Label>
              <SearchableSelect
                value={form.mode}
                onChange={(v) => setField({ mode: (v || "either") as FormState["mode"] })}
                options={COURSE_MODE_OPTIONS}
                placeholder="Any lesson mode"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Price (HKD)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 4800"
                value={form.price}
                onChange={(e) => setField({ price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>District</Label>
              <SearchableSelect
                value={form.district}
                onChange={(v) => setField({ district: v })}
                options={[
                  { value: "", label: "No district" },
                  ...HK_DISTRICTS.map((d) => ({ value: d, label: d })),
                ]}
                placeholder="No district"
                searchPlaceholder="Search district..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Class days</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = form.session_days.includes(day.code);
                  return (
                    <ChipToggle
                      key={day.code}
                      active={active}
                      onClick={() =>
                        setField({
                          session_days: active
                            ? form.session_days.filter((code) => code !== day.code)
                            : [...form.session_days, day.code],
                        })
                      }
                    >
                      {day.label}
                    </ChipToggle>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Selected days appear on the class calendar of your public profile.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="course-start-date">First class</Label>
                <DatePicker
                  id="course-start-date"
                  label="First class"
                  value={isoToDate(form.start_date)}
                  onChange={(date) => setField({ start_date: dateToIso(date) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course-end-date">Last class</Label>
                <DatePicker
                  id="course-end-date"
                  label="Last class"
                  value={isoToDate(form.end_date)}
                  min={isoToDate(form.start_date)}
                  onChange={(date) => setField({ end_date: dateToIso(date) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-schedule">Schedule notes</Label>
              <Input
                id="course-schedule"
                maxLength={200}
                placeholder="e.g. Every Sat 2–4pm, 12 weeks"
                value={form.schedule_text}
                onChange={(e) => setField({ schedule_text: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-semibold">Showcase</p>
              <p className="text-xs text-muted-foreground">
                Shown on the public course card. All of it is optional.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="course-curriculum">Curriculum</Label>
                <Input
                  id="course-curriculum"
                  maxLength={80}
                  placeholder="e.g. HKDSE / IBDP"
                  value={form.curriculum}
                  onChange={(e) => setField({ curriculum: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course-target-grade">Target grade</Label>
                <Input
                  id="course-target-grade"
                  maxLength={60}
                  placeholder="e.g. S4–S6"
                  value={form.target_grade}
                  onChange={(e) => setField({ target_grade: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Format</Label>
              <SearchableSelect
                value={form.format}
                onChange={(v) => setField({ format: v })}
                options={[
                  { value: "", label: "No format" },
                  ...COURSE_FORMATS.map((value) => ({
                    value,
                    label: COURSE_FORMAT_LABELS[value],
                  })),
                ]}
                placeholder="No format"
                searchPlaceholder="Search format..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-schedule-summary">Schedule summary</Label>
              <Input
                id="course-schedule-summary"
                maxLength={COURSE_SCHEDULE_SUMMARY_MAX_CHARS}
                placeholder="e.g. Every Sat, 2–4pm, 8 weeks"
                value={form.schedule_summary}
                onChange={(e) => setField({ schedule_summary: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {form.schedule_summary.length}/{COURSE_SCHEDULE_SUMMARY_MAX_CHARS}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-price-display">Price display</Label>
              <Input
                id="course-price-display"
                maxLength={COURSE_PRICE_DISPLAY_MAX_CHARS}
                placeholder="e.g. HK$480 per lesson (enquire to reserve)"
                value={form.price_display}
                onChange={(e) => setField({ price_display: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              {Array.from({ length: COURSE_HIGHLIGHTS_MAX }, (_, index) => (
                <div key={index} className="space-y-1.5">
                  <Label htmlFor={`course-highlight-${index}`}>{`Highlight ${index + 1}`}</Label>
                  <Input
                    id={`course-highlight-${index}`}
                    maxLength={COURSE_HIGHLIGHT_MAX_CHARS}
                    placeholder="One line on what makes this course worth it."
                    value={form.highlights[index] ?? ""}
                    onChange={(e) => {
                      const next = [...form.highlights];
                      next[index] = e.target.value;
                      setField({ highlights: next });
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Instruction languages</Label>
              <div className="flex flex-wrap gap-1.5">
                {COURSE_INSTRUCTION_LANGUAGES.map((code) => {
                  const active = form.instruction_languages.includes(code);
                  return (
                    <ChipToggle
                      key={code}
                      active={active}
                      onClick={() =>
                        setField({
                          instruction_languages: active
                            ? form.instruction_languages.filter((item) => item !== code)
                            : [...form.instruction_languages, code],
                        })
                      }
                    >
                      {COURSE_INSTRUCTION_LANGUAGE_LABELS[code] ?? code}
                    </ChipToggle>
                  );
                })}
              </div>
            </div>

            <Toggle
              label="Trial available"
              hint="Shows a Trial available badge on the public card"
              checked={form.trial_available}
              onCheckedChange={(checked) => setField({ trial_available: checked })}
            />

            <div className="space-y-1.5">
              <Label>Assigned tutor</Label>
              <SearchableSelect
                value={form.assigned_tutor_id}
                onChange={(v) => setField({ assigned_tutor_id: v })}
                options={[
                  { value: "", label: "No assigned tutor" },
                  ...affiliates.map((row) => ({ value: row.userId, label: row.displayName })),
                ]}
                placeholder="No assigned tutor"
                searchPlaceholder="Search tutor..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Short summary</Label>
            <Textarea
              rows={2}
              maxLength={300}
              placeholder="One or two sentences shown on the course card."
              value={form.summary}
              onChange={(e) => setField({ summary: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Full description</Label>
            <Textarea
              rows={5}
              placeholder="Full course details, what students learn, who it's for, materials included…"
              value={form.description}
              onChange={(e) => setField({ description: e.target.value })}
            />
          </div>

          <div className="rounded-lg border border-border p-3">
            <Toggle
              label="Published"
              hint="Visible on the public courses directory"
              checked={form.is_published}
              onCheckedChange={(checked) => setField({ is_published: checked })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              variant="solid"
              color="blue"
              className="font-bold"
            >
              {saving ? "Saving…" : course ? "Save changes" : "Create course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
