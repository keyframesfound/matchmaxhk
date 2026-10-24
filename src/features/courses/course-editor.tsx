import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, FileText, Loader2, PlayCircle, X, Youtube } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findContactViolations } from "@/lib/contact-filter";
import { validateCourseVideoUrl } from "@/lib/vimeo";
import {
  uploadMaterialCover,
  MAX_MATERIAL_COVER_BYTES,
} from "@/features/materials/cover.functions";
import {
  COURSE_LESSON_TITLE_MAX_LEN,
  COURSE_MAX_LESSONS,
  COURSE_MIN_LESSONS,
} from "@/features/courses/course-rules";
import {
  getCourseEditorData,
  saveCourseDraft,
  submitCourseForReview,
  uploadCourseLessonPdf,
} from "@/features/courses/course-drafts.functions";

/**
 * #392: the Video Course / General Course editor (/account/courses/new +
 * edit). Kind selector, REQUIRED cover, and a 1–10 lesson repeater, each
 * lesson carries a title (≤120), an UNLISTED YouTube/Vimeo link validated
 * by validateCourseVideoUrl (Drive/Loom/anything else is rejected at the
 * paste, and again server-side; there is NO video upload path), and for
 * general courses an optional per-lesson PDF that the server watermarks in
 * full (watermarkFullPdf) before storing. Draft → submitForReview →
 * pending_review; staff watch the actual embeds in the review dialog.
 */

type LessonDraft = {
  title: string;
  videoUrl: string;
  pdfFile: File | null;
  hasStoredPdf: boolean;
};

function newLesson(): LessonDraft {
  return { title: "", videoUrl: "", pdfFile: null, hasStoredPdf: false };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function CourseEditorForm({ courseId }: { courseId?: string }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<"video_course" | "general_course">("video_course");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [lessons, setLessons] = useState<LessonDraft[]>([newLesson()]);
  const [saving, setSaving] = useState(false);
  const hydratedRef = useRef(false);

  const editorQuery = useQuery({
    queryKey: ["course-editor", courseId ?? "new"],
    queryFn: () => getCourseEditorData({ data: { courseId } }),
    enabled: true,
  });

  // Hydrate exactly once, when the editor data first lands.
  useEffect(() => {
    const data = editorQuery.data;
    if (!data || hydratedRef.current) return;
    hydratedRef.current = true;
    if (data.course) {
      setKind(data.course.kind);
      setTitle(data.course.title === "Untitled course" ? "" : data.course.title);
      setDescription(data.course.description ?? "");
      setPrice(data.course.priceHkd ? String(data.course.priceHkd) : "");
      setLessons(
        data.lessons.length > 0
          ? data.lessons.map((lesson) => ({
              title: lesson.title,
              videoUrl: lesson.videoUrl ?? "",
              pdfFile: null,
              hasStoredPdf: lesson.hasPdf,
            }))
          : [newLesson()],
      );
    }
  }, [editorQuery.data]);

  const copyViolations = useMemo(() => {
    const titleV = findContactViolations(title);
    const descV = findContactViolations(description);
    const lessonVs = lessons.map((lesson) => findContactViolations(lesson.title));
    return { titleV, descV, lessonVs };
  }, [title, description, lessons]);
  const blockedByContact =
    copyViolations.titleV.length > 0 ||
    copyViolations.descV.length > 0 ||
    copyViolations.lessonVs.some((v) => v.length > 0);

  const priceNum = price.trim() === "" ? Number.NaN : Number(price);
  const priceInvalid = Number.isNaN(priceNum) || !Number.isInteger(priceNum) || priceNum < 0;
  const coverMissingForSubmit = !cover && !editorQuery.data?.course?.coverUrl;

  // Per-lesson client gates (mirror the submit validator).
  const lessonProblems = lessons.map((lesson, index) => {
    const n = index + 1;
    const problems: string[] = [];
    if (!lesson.title.trim()) problems.push(t("shop.form.lesson_needs_title", { n }));
    else if (lesson.title.trim().length > COURSE_LESSON_TITLE_MAX_LEN) {
      problems.push(t("shop.form.lesson_title_long", { n }));
    }
    const video = lesson.videoUrl.trim() ? validateCourseVideoUrl(lesson.videoUrl) : null;
    if (lesson.videoUrl.trim() && !video) {
      problems.push(t("shop.form.lesson_bad_video", { n }));
    }
    const hasVideo = Boolean(video);
    const hasPdf = lesson.hasStoredPdf || lesson.pdfFile != null;
    if (kind === "video_course" && !hasVideo) {
      problems.push(t("shop.form.lesson_video_course_video", { n }));
    }
    if (!hasVideo && !hasPdf) {
      problems.push(t("shop.form.lesson_needs_media", { n }));
    }
    return problems;
  });
  const lessonError = lessonProblems.find((problems) => problems.length > 0);
  const lessonsCountInvalid =
    lessons.length < COURSE_MIN_LESSONS || lessons.length > COURSE_MAX_LESSONS;

  const done = () => {
    window.location.assign("/account");
  };

  const saveDraft = async () => {
    const { courseId: savedId } = await saveCourseDraft({
      data: {
        materialId: editorQuery.data?.course?.id,
        kind,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        priceHkd: price.trim() === "" ? undefined : Number(price),
        lessons: lessons.map((lesson) => ({
          title: lesson.title.trim(),
          videoUrl: lesson.videoUrl.trim() || null,
        })),
      },
    });
    // Cover rides uploadMaterialCover (draft must exist first).
    if (cover) {
      const base64 = await fileToBase64(cover);
      await uploadMaterialCover({
        data: { materialId: savedId, fileName: cover.name, base64Data: base64 },
      });
    }
    // Per-lesson PDFs, the server watermarks the FULL document.
    for (let index = 0; index < lessons.length; index += 1) {
      const pdf = lessons[index].pdfFile;
      if (!pdf) continue;
      const base64 = await fileToBase64(pdf);
      await uploadCourseLessonPdf({
        data: { materialId: savedId, position: index + 1, fileName: pdf.name, base64Data: base64 },
      });
    }
    return savedId;
  };

  const draftMutation = useMutation({
    mutationFn: saveDraft,
    onSuccess: () => {
      toast.success(t("notes.form.draft_saved"));
      done();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("notes.form.save_failed")),
    onSettled: () => setSaving(false),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const savedId = await saveDraft();
      return submitCourseForReview({ data: { courseId: savedId } });
    },
    onSuccess: () => {
      toast.success(t("notes.form.submitted"));
      done();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("notes.form.submit_failed")),
    onSettled: () => setSaving(false),
  });

  const missing: string[] = [];
  if (title.trim().length < 3) missing.push(t("shop.form.field_title"));
  if (priceInvalid) missing.push(t("shop.form.field_price"));
  if (coverMissingForSubmit) missing.push(t("shop.form.field_cover"));
  if (lessonsCountInvalid) missing.push(t("shop.form.field_lessons"));
  if (lessonError) missing.push(lessonError[0]);

  const run = (mode: "draft" | "submit") => {
    setSaving(true);
    if (mode === "draft") draftMutation.mutate();
    else submitMutation.mutate();
  };

  const violationNote = (violations: { match: string }[]) =>
    violations.length > 0 ? (
      <p className="text-xs text-destructive">
        {t("notes.form.contact_block", {
          match: violations
            .map((v) => v.match)
            .slice(0, 2)
            .join(", "),
        })}
      </p>
    ) : null;

  const setLesson = (index: number, patch: Partial<LessonDraft>) => {
    setLessons((prev) => prev.map((lesson, i) => (i === index ? { ...lesson, ...patch } : lesson)));
  };
  const moveLesson = (index: number, delta: -1 | 1) => {
    setLessons((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!blockedByContact && missing.length === 0) run("submit");
      }}
    >
      {editorQuery.data?.course?.rejectionReason ? (
        <p className="rounded-md border border-[#B42318]/30 bg-[#B42318]/5 px-3 py-2 text-xs leading-relaxed text-destructive">
          {editorQuery.data.course.rejectionReason}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="course-kind">{t("shop.form.field_course_kind")}</Label>
        <select
          id="course-kind"
          value={kind}
          onChange={(e) => {
            if (e.target.value === "video_course" || e.target.value === "general_course") {
              setKind(e.target.value);
            }
          }}
          className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-[0.95rem]"
        >
          <option value="video_course">{t("shop.kind_video_course")}</option>
          <option value="general_course">{t("shop.kind_general_course")}</option>
        </select>
        <p className="text-xs text-muted-foreground">{t("shop.form.course_kind_hint")}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="course-title">{t("shop.form.field_title")}</Label>
        <Input
          id="course-title"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("shop.form.title_placeholder")}
          className="h-11"
        />
        {violationNote(copyViolations.titleV)}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="course-description">{t("shop.form.field_description")}</Label>
        <textarea
          id="course-description"
          value={description}
          maxLength={4000}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={t("shop.form.description_placeholder")}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[0.95rem] focus-visible:border-[color:var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40"
        />
        {violationNote(copyViolations.descV)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="course-price">{t("shop.form.field_price")}</Label>
          <Input
            id="course-price"
            type="number"
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t("shop.form.price_free_hint")}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="course-cover">{t("shop.form.field_cover")}</Label>
          <Input
            id="course-cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="h-11 cursor-pointer"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">{t("shop.form.cover_hint")}</p>
          {cover != null && cover.size > MAX_MATERIAL_COVER_BYTES ? (
            <p className="text-xs text-destructive">{t("shop.form.cover_too_large")}</p>
          ) : null}
        </div>
      </div>

      {/* Lesson repeater (1–10). */}
      <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{t("shop.form.lessons_label")}</Label>
          <span
            className={
              lessonsCountInvalid
                ? "text-xs font-medium text-destructive"
                : "text-xs font-medium text-emerald-700 dark:text-emerald-400"
            }
          >
            {t("shop.form.lessons_count", { count: lessons.length })}
          </span>
        </div>

        {lessons.map((lesson, index) => {
          const video = lesson.videoUrl.trim() ? validateCourseVideoUrl(lesson.videoUrl) : null;
          const problems = lessonProblems[index];
          return (
            <div key={index} className="space-y-2 rounded-md border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[color:var(--ink)]">
                  {t("shop.form.lesson_n", { n: index + 1 })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={t("shop.form.lesson_move_up")}
                    disabled={index === 0}
                    onClick={() => moveLesson(index, -1)}
                    className="rounded-md border border-border p-1 text-muted-foreground disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={t("shop.form.lesson_move_down")}
                    disabled={index === lessons.length - 1}
                    onClick={() => moveLesson(index, 1)}
                    className="rounded-md border border-border p-1 text-muted-foreground disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={t("shop.form.lesson_remove")}
                    disabled={lessons.length <= 1}
                    onClick={() => setLessons((prev) => prev.filter((_, i) => i !== index))}
                    className="rounded-md border border-border p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              <Input
                value={lesson.title}
                maxLength={COURSE_LESSON_TITLE_MAX_LEN}
                onChange={(e) => setLesson(index, { title: e.target.value })}
                placeholder={t("shop.form.lesson_title_placeholder")}
                aria-label={t("shop.form.lesson_title_label", { n: index + 1 })}
                className="h-10"
              />
              {copyViolations.lessonVs[index]?.length > 0
                ? violationNote(copyViolations.lessonVs[index])
                : null}

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={lesson.videoUrl}
                  maxLength={500}
                  onChange={(e) => setLesson(index, { videoUrl: e.target.value })}
                  placeholder={t("shop.form.lesson_video_placeholder")}
                  aria-label={t("shop.form.lesson_video_label", { n: index + 1 })}
                  className="h-10 min-w-0 flex-1"
                />
                {video ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-[color:var(--ink)]">
                    <Youtube className="h-3.5 w-3.5" aria-hidden />
                    {video.provider === "youtube"
                      ? t("shop.form.provider_youtube")
                      : t("shop.form.provider_vimeo")}
                  </span>
                ) : lesson.videoUrl.trim() ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#B42318]/40 bg-[#B42318]/5 px-2 py-1 text-xs font-medium text-destructive">
                    {t("shop.form.lesson_bad_video", { n: index + 1 })}
                  </span>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor={`lesson-pdf-${index}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  {t("shop.form.lesson_pdf_label", { n: index + 1 })}
                </Label>
                <Input
                  id={`lesson-pdf-${index}`}
                  type="file"
                  accept="application/pdf"
                  className="h-9 cursor-pointer text-xs"
                  onChange={(e) => setLesson(index, { pdfFile: e.target.files?.[0] ?? null })}
                />
                {lesson.hasStoredPdf && !lesson.pdfFile ? (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" aria-hidden />
                    {t("shop.form.lesson_pdf_stored")}
                  </p>
                ) : null}
              </div>

              {problems.length > 0 ? (
                <p className="text-xs text-destructive">{problems.join(" ")}</p>
              ) : (
                <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                  {t("shop.form.lesson_ready")}
                </p>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          disabled={lessons.length >= COURSE_MAX_LESSONS}
          onClick={() => setLessons((prev) => [...prev, newLesson()])}
        >
          {t("shop.form.lesson_add")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("shop.form.lessons_hint")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" disabled={saving} onClick={() => run("draft")}>
          {saving && draftMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {t("notes.form.save_draft")}
        </Button>
        <Button
          type="submit"
          variant="solid"
          color="accent"
          className="font-medium"
          disabled={saving || blockedByContact || missing.length > 0}
        >
          {saving && submitMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {t("notes.form.submit_review")}
        </Button>
      </div>
      {missing.length > 0 && !blockedByContact && (
        <p className="text-xs text-muted-foreground">
          {t("notes.form.missing_note", { fields: missing.join(", ") })}
        </p>
      )}
    </form>
  );
}
