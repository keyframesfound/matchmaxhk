import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { findContactViolations } from "@/lib/contact-filter";
import { validateCourseVideoUrl } from "@/lib/vimeo";
import {
  buildMaterialSlug,
  MAX_PDF_BYTES,
  nextStatus,
  type MaterialStatus,
} from "@/features/materials/lifecycle";
import {
  COURSE_DESCRIPTION_MAX_LEN,
  COURSE_LESSON_TITLE_MAX_LEN,
  COURSE_MAX_LESSONS,
  COURSE_TITLE_MAX_LEN,
  validateCourseForSubmit,
  type CourseKind,
} from "@/features/courses/course-rules";
import {
  asAdminDb,
  assertPdfNotEncrypted,
  base64ToBytes,
  type AdminDb,
} from "@/features/materials/storage-helpers";
import { watermarkFullPdf } from "@/features/materials/watermark";

/**
 * #392: tutor-side Video Course / General Course lifecycle. A course is a
 * digital_materials row (material_type 'video_course' | 'general_course',
 * document_type 'course') with 1–10 lessons in course_lessons. Videos are
 * UNLISTED YouTube / Vimeo links validated by validateCourseVideoUrl (no
 * video file upload path exists); general-course lessons may carry a
 * watermarked PDF (watermarkFullPdf — full document). The clean original is
 * kept privately next to the watermarked copy under a `.orig.pdf` twin.
 * Lesson writes are service-role (course_lessons is RLS-deny for clients).
 */

const PRIVATE_BUCKET = "materials-originals";
const PUBLIC_BUCKET = "materials-previews";

type CourseRow = {
  id: string;
  tutor_id: string;
  title: string;
  slug: string | null;
  status: MaterialStatus;
  price_hkd: number;
  description: string | null;
  cover_image_path: string | null;
  rejection_reason: string | null;
  material_type: string;
};

type CourseLessonDbRow = {
  id: string;
  position: number;
  title: string;
  video_url: string | null;
  video_provider: string | null;
  pdf_path: string | null;
};

const COURSE_SELECT =
  "id, tutor_id, title, slug, status, price_hkd, description, cover_image_path, rejection_reason, material_type";
const LESSON_SELECT = "id, position, title, video_url, video_provider, pdf_path";

export type CourseEditorLesson = {
  position: number;
  title: string;
  videoUrl: string | null;
  videoProvider: string | null;
  hasPdf: boolean;
};

export type CourseEditorData = {
  course: {
    id: string;
    kind: CourseKind;
    title: string;
    description: string | null;
    priceHkd: number;
    status: MaterialStatus;
    rejectionReason: string | null;
    coverUrl: string;
  } | null;
  lessons: CourseEditorLesson[];
};

async function myTutorRow(db: AdminDb, userId: string): Promise<{ id: string }> {
  const { data, error } = await db
    .from<{ id: string }>("tutors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Failed to look up tutor account");
  if (!data) throw new Error("Your account is not linked to a tutor profile yet.");
  return data;
}

/** Owner-only load that works for every status (drafts included). */
async function loadOwnedCourse(db: AdminDb, courseId: string, tutorId: string): Promise<CourseRow> {
  const { data, error } = await db
    .from<CourseRow>("digital_materials")
    .select(COURSE_SELECT)
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Course not found.");
  if (data.tutor_id !== tutorId) throw new Error("This course belongs to another account.");
  if (data.status && !["draft", "pending_review", "rejected"].includes(data.status)) {
    throw new Error("Only draft or rejected courses can be edited here.");
  }
  return data;
}

async function loadLessons(db: AdminDb, courseId: string): Promise<CourseLessonDbRow[]> {
  const { data, error } = await db
    .from<CourseLessonDbRow>("course_lessons")
    .select(LESSON_SELECT)
    .eq("material_id", courseId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function assertCleanCourseCopy(fields: Record<string, string | undefined>) {
  const labels: Record<string, string> = {
    title: "Title",
    description: "Description",
    lesson: "Lesson title",
  };
  for (const [field, text] of Object.entries(fields)) {
    if (!text) continue;
    const violations = findContactViolations(text);
    if (violations.length > 0) {
      throw new Error(
        `${labels[field] ?? field} contains contact details (${violations
          .map((v) => v.match)
          .slice(0, 2)
          .join(", ")}). Remove them to save.`,
      );
    }
  }
}

async function generateUniqueCourseSlug(
  db: AdminDb,
  title: string,
  excludeId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = buildMaterialSlug(title, attempt === 0 ? "course" : `course-${attempt + 1}`);
    const { data } = await db
      .from<{ id: string }>("digital_materials")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === excludeId) return candidate;
  }
  return buildMaterialSlug(title, `course-${Date.now().toString(36)}`);
}

const LessonInput = z.object({
  title: z.string().trim().max(COURSE_LESSON_TITLE_MAX_LEN),
  /** The raw pasted unlisted link — parsed/validated server-side. */
  videoUrl: z.string().trim().max(500).nullish(),
});

const SaveCourseInput = z.object({
  materialId: z.string().uuid().optional(),
  kind: z.enum(["video_course", "general_course"]),
  title: z.string().trim().max(COURSE_TITLE_MAX_LEN).optional(),
  description: z.string().trim().max(COURSE_DESCRIPTION_MAX_LEN).optional(),
  priceHkd: z.number().min(0).max(100_000).optional(),
  lessons: z.array(LessonInput).max(COURSE_MAX_LESSONS),
});

/**
 * Create or update the signed-in tutor's course draft, lessons included.
 * Lessons upsert on (material_id, position) so a re-save never clobbers an
 * uploaded PDF on an untouched lesson; dropped positions are deleted. Video
 * URLs must parse as YouTube/Vimeo embeds — anything else (Drive, Loom, a
 * bare MP4) is rejected here.
 */
export const saveCourseDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => SaveCourseInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    assertCleanCourseCopy({ title: data.title, description: data.description });

    // Parse + validate every video link up front; store the RAW url plus
    // its provider (CHECK (video_url IS NULL) = (video_provider IS NULL)).
    const parsedLessons = data.lessons.map((lesson, index) => {
      const video = lesson.videoUrl ? validateCourseVideoUrl(lesson.videoUrl) : null;
      if (lesson.videoUrl && !video) {
        throw new Error(`Lesson ${index + 1}: only unlisted YouTube or Vimeo links are supported.`);
      }
      const title = lesson.title.trim();
      if (!title) throw new Error(`Lesson ${index + 1} needs a title.`);
      assertCleanCourseCopy({ [`lesson ${index + 1}`]: title });
      return {
        position: index + 1,
        title,
        video_url: lesson.videoUrl || null,
        video_provider: video?.provider ?? null,
      };
    });

    const existing = data.materialId ? await loadOwnedCourse(db, data.materialId, tutor.id) : null;

    if (existing) {
      const { error } = await db
        .from<never>("digital_materials")
        .update({
          material_type: data.kind,
          document_type: "course",
          ...(data.title != null ? { title: data.title } : {}),
          ...(data.description != null ? { description: data.description } : {}),
          ...(data.priceHkd != null ? { price_hkd: data.priceHkd } : {}),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await db
        .from<{ id: string }>("digital_materials")
        .insert({
          tutor_id: tutor.id,
          title: data.title?.trim() || "Untitled course",
          description: data.description ?? null,
          price_hkd: data.priceHkd ?? 0,
          curriculum_tag: "",
          material_type: data.kind,
          document_type: "course",
          status: "draft",
          original_file_path: null,
          watermarked_preview_url: "",
          cover_image_path: null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      data.materialId = inserted.id;
    }
    const courseId = data.materialId as string;

    // Upsert lessons in place; delete positions that dropped out. pdf_path
    // is never part of the upsert payload, so uploaded worksheets survive.
    const keptPositions = new Set(parsedLessons.map((lesson) => lesson.position));
    if (parsedLessons.length > 0) {
      const { error: upsertError } = await db.from<never>("course_lessons").upsert(
        parsedLessons.map((lesson) => ({ ...lesson, material_id: courseId })),
        { onConflict: "material_id,position" },
      );
      if (upsertError) throw new Error(upsertError.message);
    }
    const existingLessons = await loadLessons(db, courseId);
    for (const row of existingLessons) {
      if (!keptPositions.has(Number(row.position))) {
        const { error: deleteError } = await db
          .from<never>("course_lessons")
          .delete()
          .eq("material_id", courseId)
          .eq("position", Number(row.position));
        if (deleteError) throw new Error(deleteError.message);
      }
    }

    return { courseId };
  });

const UploadLessonPdfInput = z.object({
  materialId: z.string().uuid(),
  position: z.number().int().min(1).max(COURSE_MAX_LESSONS),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/\.pdf$/i, "Lesson worksheets must be PDF files"),
  base64Data: z.string().trim().min(100).max(60_000_000),
});

/**
 * Attach/replace a lesson's PDF worksheet. The pipeline mirrors the notes
 * flow: encryption probe → watermarkFullPdf (FULL document, unlike the
 * preview pipeline) → clean original kept privately as `<stamp>.orig.pdf`,
 * watermarked copy uploaded as `<stamp>.pdf` → ONLY the watermarked path
 * lands in course_lessons.pdf_path. Buyers sign the watermarked copy.
 */
export const uploadCourseLessonPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => UploadLessonPdfInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const course = await loadOwnedCourse(db, data.materialId, tutor.id);

    const lessons = await loadLessons(db, course.id);
    const lesson = lessons.find((row) => Number(row.position) === data.position);
    if (!lesson) {
      throw new Error("Save the draft with this lesson first, then upload its PDF.");
    }

    const bytes = base64ToBytes(data.base64Data);
    if (bytes.byteLength > MAX_PDF_BYTES) {
      throw new Error("The PDF must be 20MB or smaller.");
    }
    const pageCount = await assertPdfNotEncrypted(bytes).catch(() => {
      throw new Error("This PDF is password-protected. Please upload an unlocked file.");
    });
    if (pageCount < 1) throw new Error("The PDF has no pages.");

    const watermarked = await watermarkFullPdf(bytes);

    const stamp = `${data.position}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const cleanPath = `courses/${course.id}/${stamp}.orig.pdf`;
    const watermarkedPath = `courses/${course.id}/${stamp}.pdf`;

    const { error: cleanError } = await db.storage
      .from(PRIVATE_BUCKET)
      .upload(cleanPath, bytes as unknown as BlobPart, { contentType: "application/pdf" });
    if (cleanError) throw new Error(cleanError.message);
    const { error: markedError } = await db.storage
      .from(PRIVATE_BUCKET)
      .upload(watermarkedPath, watermarked as unknown as BlobPart, {
        contentType: "application/pdf",
      });
    if (markedError) {
      await db.storage.from(PRIVATE_BUCKET).remove([cleanPath]);
      throw new Error(markedError.message);
    }

    const { error: updateError } = await db
      .from<never>("course_lessons")
      .update({ pdf_path: watermarkedPath })
      .eq("material_id", course.id)
      .eq("position", data.position);
    if (updateError) {
      await db.storage.from(PRIVATE_BUCKET).remove([cleanPath, watermarkedPath]);
      throw new Error(updateError.message);
    }
    if (lesson.pdf_path && lesson.pdf_path !== watermarkedPath) {
      // Best-effort cleanup of the replaced pair.
      const oldClean = lesson.pdf_path.replace(/\.pdf$/, ".orig.pdf");
      await db.storage.from(PRIVATE_BUCKET).remove([lesson.pdf_path, oldClean]);
    }
    return { pdfPath: watermarkedPath };
  });

/**
 * Submit gate: completeness (video_course → every lesson has a video;
 * general_course → ≥1 lesson, each with video and/or PDF), cover required,
 * contact filter on title/description AND every lesson title, then
 * draft/rejected → pending_review with slug + submitted_at.
 */
export const submitCourseForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => z.object({ courseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const existing = await loadOwnedCourse(db, data.courseId, tutor.id);

    const lessons = await loadLessons(db, existing.id);
    const kind: CourseKind =
      existing.material_type === "general_course" ? "general_course" : "video_course";
    const errors = validateCourseForSubmit({
      kind,
      title: existing.title,
      description: existing.description,
      priceHkd: Number(existing.price_hkd ?? 0),
      hasCover: Boolean(existing.cover_image_path),
      lessons: lessons.map((lesson) => ({
        title: lesson.title,
        hasVideo: Boolean(lesson.video_url),
        hasPdf: Boolean(lesson.pdf_path),
      })),
    });
    if (errors.length > 0) throw new Error(errors.join(" "));

    assertCleanCourseCopy({
      title: existing.title,
      description: existing.description ?? undefined,
      ...Object.fromEntries(lessons.map((lesson) => [`lesson ${lesson.position}`, lesson.title])),
    });

    const next = nextStatus(existing.status, "submit");
    if (!next) throw new Error("This course cannot be submitted right now.");

    const { error } = await db
      .from<never>("digital_materials")
      .update({
        status: next,
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);

    if (!existing.slug) {
      const slug = await generateUniqueCourseSlug(db, existing.title.trim(), existing.id);
      const { error: slugError } = await db
        .from<never>("digital_materials")
        .update({ slug })
        .eq("id", existing.id);
      if (slugError) throw new Error(slugError.message);
    }

    return { courseId: existing.id };
  });

/** Editor bootstrap: stored course (if any) + its lessons. */
export const getCourseEditorData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ courseId: z.string().uuid().optional() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<CourseEditorData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);

    if (!data.courseId) return { course: null, lessons: [] };

    const { data: rows, error } = await db
      .from<CourseRow>("digital_materials")
      .select(COURSE_SELECT)
      .eq("id", data.courseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rows || rows.tutor_id !== tutor.id) return { course: null, lessons: [] };

    const lessons = await loadLessons(db, rows.id);
    return {
      course: {
        id: rows.id,
        kind: rows.material_type === "general_course" ? "general_course" : "video_course",
        title: rows.title,
        description: rows.description,
        priceHkd: Number(rows.price_hkd ?? 0),
        status: rows.status,
        rejectionReason: rows.rejection_reason,
        coverUrl: rows.cover_image_path
          ? (db.storage.from(PUBLIC_BUCKET).getPublicUrl(rows.cover_image_path).data?.publicUrl ??
            "")
          : "",
      },
      lessons: lessons.map((lesson) => ({
        position: Number(lesson.position),
        title: lesson.title,
        videoUrl: lesson.video_url,
        videoProvider: lesson.video_provider,
        hasPdf: Boolean(lesson.pdf_path),
      })),
    };
  });
