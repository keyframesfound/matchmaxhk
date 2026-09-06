import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
};

const WEEKDAY_OPTIONS = [
  { code: "sun", label: "Sun" },
  { code: "mon", label: "Mon" },
  { code: "tue", label: "Tue" },
  { code: "wed", label: "Wed" },
  { code: "thu", label: "Thu" },
  { code: "fri", label: "Fri" },
  { code: "sat", label: "Sat" },
];

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

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(course?.image_url ?? null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => getInitialFormState(course, duplicate));

  useEffect(() => {
    if (!open) return;
    setForm(getInitialFormState(course, duplicate));
    setImageUrl(course?.image_url ?? null);
    setImageKey(null);
  }, [open, course, duplicate]);

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
      toast.error(error instanceof Error ? error.message : "Failed to save course");
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
                    <button
                      key={day.code}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setField({
                          session_days: active
                            ? form.session_days.filter((code) => code !== day.code)
                            : [...form.session_days, day.code],
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-colors ${
                        active
                          ? "bg-[color:var(--btn-accent)] text-[color:var(--btn-accent-fg)] ring-[color:var(--btn-accent)]"
                          : "bg-muted text-muted-foreground ring-transparent hover:text-[color:var(--ink)]"
                      }`}
                    >
                      {day.label}
                    </button>
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
                <Input
                  id="course-start-date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setField({ start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course-end-date">Last class</Label>
                <Input
                  id="course-end-date"
                  type="date"
                  min={form.start_date || undefined}
                  value={form.end_date}
                  onChange={(e) => setField({ end_date: e.target.value })}
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
              placeholder="Full course details — what students learn, who it's for, materials included…"
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
