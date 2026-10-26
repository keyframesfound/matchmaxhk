import { describe, expect, it } from "vitest";

import {
  COURSE_MAX_LESSONS,
  validateCourseForSubmit,
  validateCourseLessons,
  type CourseLessonInput,
} from "../../src/features/courses/course-rules";

const videoLesson = (overrides: Partial<CourseLessonInput> = {}): CourseLessonInput => ({
  title: "Kinematics basics",
  hasVideo: true,
  hasPdf: false,
  ...overrides,
});

describe("validateCourseLessons — completeness per kind", () => {
  it("video_course: every lesson needs a video", () => {
    expect(
      validateCourseLessons("video_course", [videoLesson(), videoLesson({ title: "Waves" })]),
    ).toEqual([]);

    const errors = validateCourseLessons("video_course", [
      videoLesson(),
      videoLesson({ title: "Waves", hasVideo: false, hasPdf: true }),
    ]);
    expect(errors.join(" ")).toMatch(/Lesson 2 needs a video/);
  });

  it("general_course: each lesson needs a video or a PDF (or both)", () => {
    expect(
      validateCourseLessons("general_course", [
        videoLesson({ hasPdf: true }),
        videoLesson({ title: "Worksheet only", hasVideo: false, hasPdf: true }),
      ]),
    ).toEqual([]);

    const errors = validateCourseLessons("general_course", [
      videoLesson(),
      videoLesson({ title: "Empty", hasVideo: false, hasPdf: false }),
    ]);
    expect(errors.join(" ")).toMatch(/Lesson 2 needs a video or a PDF/);
  });

  it("rejects an empty course and more than 10 lessons", () => {
    expect(validateCourseLessons("video_course", []).join(" ")).toMatch(/between 1 and 10/);
    const tooMany = Array.from({ length: COURSE_MAX_LESSONS + 1 }, (_, i) =>
      videoLesson({ title: `Lesson ${i}` }),
    );
    expect(validateCourseLessons("video_course", tooMany).join(" ")).toMatch(/between 1 and 10/);
  });

  it("requires a title of at most 120 characters per lesson", () => {
    const errors = validateCourseLessons("general_course", [
      videoLesson({ title: "   " }),
      videoLesson({ title: "x".repeat(121) }),
    ]);
    const joined = errors.join(" ");
    expect(joined).toMatch(/Lesson 1 needs a title/);
    expect(joined).toMatch(/Lesson 2's title must be 120 characters or fewer/);
  });
});

describe("validateCourseForSubmit — the full submit gate", () => {
  const base = {
    kind: "video_course" as const,
    title: "IB Physics video crash course",
    description: "Ten lessons with unlisted links.",
    priceHkd: 399,
    hasCover: true,
    lessons: [videoLesson()],
  };

  it("accepts a clean video course", () => {
    expect(validateCourseForSubmit(base)).toEqual([]);
  });

  it("accepts a free general course with one PDF-only lesson", () => {
    expect(
      validateCourseForSubmit({
        ...base,
        kind: "general_course",
        priceHkd: 0,
        lessons: [videoLesson({ hasVideo: false, hasPdf: true })],
      }),
    ).toEqual([]);
  });

  it("rejects an unknown kind, a missing cover and a negative price", () => {
    const errors = validateCourseForSubmit({
      ...base,
      kind: "self_paced" as unknown as "video_course",
      priceHkd: -5,
      hasCover: false,
      lessons: [],
    });
    const joined = errors.join(" ");
    expect(joined).toMatch(/Course type must be video course or general course/);
    expect(joined).toMatch(/cover image is required/);
    expect(joined).toMatch(/whole HK\$ amount of 0 or more/);
    expect(joined).toMatch(/between 1 and 10 lessons/);
  });

  it("video_course with a PDF-only lesson fails the kind rule", () => {
    const errors = validateCourseForSubmit({
      ...base,
      lessons: [videoLesson({ hasVideo: false, hasPdf: true })],
    });
    expect(errors.join(" ")).toMatch(/Lesson 1 needs a video/);
  });
});
