/**
 * Issue #392: pure rules for Video Course / General Course listings —
 * deliberately free of Supabase / TanStack imports so the vitest suite
 * exercises them directly (tests/courses/course-rules.test.ts).
 *
 * A course is a normal digital_materials row (material_type
 * 'video_course' | 'general_course', document_type 'course') with 1–10
 * lessons in course_lessons. Videos are UNLISTED YouTube / Vimeo links
 * parsed app-side (validateCourseVideoUrl is the single validator) — there
 * is NO video file upload path. General courses may attach a per-lesson
 * watermarked PDF instead of (or alongside) a video.
 */

export const COURSE_KINDS = ["video_course", "general_course"] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];

export const COURSE_MIN_LESSONS = 1;
export const COURSE_MAX_LESSONS = 10;
export const COURSE_LESSON_TITLE_MAX_LEN = 120;

/** Same caps as notes/folders. */
export const COURSE_TITLE_MAX_LEN = 160;
export const COURSE_DESCRIPTION_MAX_LEN = 4000;

export type CourseLessonInput = {
  title?: string | null;
  /** True when the lesson carries a validated YouTube/Vimeo link. */
  hasVideo?: boolean;
  /** True when the lesson carries an uploaded (watermarked) PDF. */
  hasPdf?: boolean;
};

/**
 * Lesson repeater gate. video_course: EVERY lesson needs a video (that is
 * what the kind means). general_course: at least one lesson overall and
 * each lesson carries a video or a PDF (or both). Titles are required,
 * ≤120 chars. Returns human-readable problems — empty array means clean.
 */
export function validateCourseLessons(kind: CourseKind, lessons: CourseLessonInput[]): string[] {
  const errors: string[] = [];

  if (lessons.length < COURSE_MIN_LESSONS || lessons.length > COURSE_MAX_LESSONS) {
    errors.push(`A course needs between ${COURSE_MIN_LESSONS} and ${COURSE_MAX_LESSONS} lessons.`);
    return errors;
  }

  lessons.forEach((lesson, index) => {
    const n = index + 1;
    const title = (lesson.title ?? "").trim();
    if (!title) errors.push(`Lesson ${n} needs a title.`);
    else if (title.length > COURSE_LESSON_TITLE_MAX_LEN) {
      errors.push(
        `Lesson ${n}'s title must be ${COURSE_LESSON_TITLE_MAX_LEN} characters or fewer.`,
      );
    }
    if (kind === "video_course" && !lesson.hasVideo) {
      errors.push(`Lesson ${n} needs a video (video courses are video-only lessons).`);
    }
    if (!lesson.hasVideo && !lesson.hasPdf) {
      errors.push(`Lesson ${n} needs a video or a PDF worksheet.`);
    }
  });

  return errors;
}

export type CourseSubmitInput = {
  kind?: string | null;
  title?: string | null;
  description?: string | null;
  priceHkd?: number | null;
  hasCover: boolean;
  lessons: CourseLessonInput[];
};

/**
 * Submit gate: kind membership, title/description caps, whole-HKD price
 * (HK$0 free course allowed, matching notes), cover REQUIRED, then the
 * per-kind lesson rules. Returns human-readable problems — empty array
 * means clean.
 */
export function validateCourseForSubmit(input: CourseSubmitInput): string[] {
  const errors: string[] = [];

  const kind = (input.kind ?? "").trim();
  if (!(COURSE_KINDS as readonly string[]).includes(kind)) {
    errors.push("Course type must be video course or general course.");
  }

  const title = (input.title ?? "").trim();
  if (title.length < 3) errors.push("Title is required (at least 3 characters).");
  else if (title.length > COURSE_TITLE_MAX_LEN) {
    errors.push(`Title must be ${COURSE_TITLE_MAX_LEN} characters or fewer.`);
  }

  const description = (input.description ?? "").trim();
  if (description.length > COURSE_DESCRIPTION_MAX_LEN) {
    errors.push(`Description must be ${COURSE_DESCRIPTION_MAX_LEN} characters or fewer.`);
  }

  const price = input.priceHkd;
  if (price == null || Number.isNaN(price) || !Number.isInteger(price) || price < 0) {
    errors.push("Price must be a whole HK$ amount of 0 or more.");
  }

  if (!input.hasCover) errors.push("A cover image is required for courses.");

  // Lesson rules run even when the kind itself is unknown — the looser
  // general-course rules apply so an empty/invalid lesson list still fails.
  const lessonKind: CourseKind = kind === "video_course" ? "video_course" : "general_course";
  errors.push(...validateCourseLessons(lessonKind, input.lessons));

  return errors;
}
