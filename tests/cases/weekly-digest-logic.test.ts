import { describe, expect, it } from "vitest";

import {
  DIGEST_FOCUS_MAX,
  DIGEST_RECAP_MAX,
  DIGEST_TZ_OFFSET_MINUTES,
  buildDigestCopy,
  composeWeeklyDigest,
  digestWindow,
  hasDigestActivity,
  type ComposeWeeklyDigestInput,
  type DigestHomeworkRow,
  type DigestLabels,
  type DigestLessonRow,
  type DigestMistakeRow,
  type WeeklyDigest,
} from "../../src/features/cases/weekly-digest-logic";
import type {
  DrawerLogRow,
  DrawerTopic,
} from "../../src/features/cases/super-drawer/super-drawer-logic";

/**
 * Issue #796 §2.6 (was #742). The reference week is Mon 16 Nov 2026 00:00 HKT
 * → Sun 22 Nov 2026 19:59:59.999 HKT, pinned to UTC instants so the assertions
 * never consult the host timezone.
 */
const WEEK_START = "2026-11-15T16:00:00.000Z";
const WEEK_END = "2026-11-22T11:59:59.999Z";
const NEXT_WEEK_START = "2026-11-22T16:00:00.000Z";
const NEXT_WEEK_END = "2026-11-29T11:59:59.999Z";
/** Sunday 12:00 HKT — inside the window. */
const TEST_NOW = new Date("2026-11-22T04:00:00.000Z");

function lesson(over: Partial<DigestLessonRow> = {}): DigestLessonRow {
  return {
    status: "done",
    confirmed_by_parent_at: null,
    confirmed_by_tutor_at: null,
    starts_at: null,
    duration_min: 60,
    ...over,
  };
}

function log(createdAt: string, over: Partial<DrawerLogRow> = {}): DrawerLogRow {
  return {
    id: `log-${createdAt}`,
    case_id: "case-1",
    lesson_id: `lesson-${createdAt}`,
    logged_by: "tutor-1",
    recap_status: "complete",
    topics: [],
    pulse: {},
    recap: null,
    next_lesson_at: null,
    created_at: createdAt,
    updated_at: createdAt,
    ...over,
  };
}

function homework(submittedAt: string | null): DigestHomeworkRow {
  return { submitted_at: submittedAt };
}

function mastered(masteredAt: string | null, status = "mastered"): DigestMistakeRow {
  return { status, mastered_at: masteredAt };
}

function compose(over: Partial<ComposeWeeklyDigestInput> = {}): WeeklyDigest | null {
  return composeWeeklyDigest({
    now: TEST_NOW,
    lessons: [],
    logs: [],
    homework: [],
    mistakes: [],
    ...over,
  });
}

describe("digestWindow — Monday 00:00 HKT to Sunday 19:59:59.999 HKT", () => {
  it("pins the HKT offset to UTC+8 with no DST", () => {
    expect(DIGEST_TZ_OFFSET_MINUTES).toBe(480);
  });

  it("keeps Sunday 19:59:59.999 HKT in the week", () => {
    expect(digestWindow(new Date(WEEK_END))).toEqual({
      startIso: WEEK_START,
      endIso: WEEK_END,
    });
    expect(digestWindow(new Date("2026-11-22T11:59:59.998Z"))).toEqual({
      startIso: WEEK_START,
      endIso: WEEK_END,
    });
  });

  it("cuts Sunday 20:00 HKT over to the next week", () => {
    expect(digestWindow(new Date("2026-11-22T12:00:00.000Z"))).toEqual({
      startIso: NEXT_WEEK_START,
      endIso: NEXT_WEEK_END,
    });
  });

  it("starts the week at Monday 00:00 HKT exactly", () => {
    // 2026-11-15T16:00Z is Mon 16 Nov 2026 00:00 HKT.
    expect(digestWindow(new Date("2026-11-15T16:00:00.000Z"))).toEqual({
      startIso: WEEK_START,
      endIso: WEEK_END,
    });
  });

  it("resolves any mid-week instant to the same Monday", () => {
    // Wed 18 Nov 2026 10:00 HKT.
    expect(digestWindow(new Date("2026-11-18T02:00:00.000Z"))).toEqual({
      startIso: WEEK_START,
      endIso: WEEK_END,
    });
    // Sunday 11:59 HKT is still the same week's Sunday.
    expect(digestWindow(new Date("2026-11-22T03:59:59.999Z"))).toEqual({
      startIso: WEEK_START,
      endIso: WEEK_END,
    });
  });

  it("treats Monday 00:00 HKT as the next week after Sunday 20:00", () => {
    expect(digestWindow(new Date("2026-11-23T00:00:00.000Z")).startIso).toBe(
      "2026-11-22T16:00:00.000Z",
    );
  });
});

describe("hasDigestActivity — a quiet week has no digest", () => {
  it("is false with no lesson, homework, mistake or recap", () => {
    expect(
      hasDigestActivity({
        lessonsThisWeek: 0,
        homeworkCompleted: 0,
        mistakesMastered: 0,
        recaps: [],
      }),
    ).toBe(false);
  });

  it("is true on homework alone, or a recap alone", () => {
    expect(
      hasDigestActivity({
        lessonsThisWeek: 0,
        homeworkCompleted: 1,
        mistakesMastered: 0,
        recaps: [],
      }),
    ).toBe(true);
    expect(
      hasDigestActivity({
        lessonsThisWeek: 0,
        homeworkCompleted: 0,
        mistakesMastered: 0,
        recaps: ["Covered fractions."],
      }),
    ).toBe(true);
  });
});

describe("composeWeeklyDigest — quiet week", () => {
  it("returns null when every row is outside the window", () => {
    expect(
      compose({
        lessons: [lesson({ starts_at: "2026-11-09T02:00:00.000Z" })],
        logs: [log("2026-11-09T03:00:00.000Z", { recap: "Last week." })],
        homework: [homework("2026-11-09T03:00:00.000Z")],
        mistakes: [mastered("2026-11-09T03:00:00.000Z")],
      }),
    ).toBeNull();
  });

  it("returns null when in-window rows carry no activity (unsubmitted homework)", () => {
    expect(
      compose({
        homework: [homework(null)],
        // A log with no recap is not digest activity.
        logs: [log("2026-11-18T03:00:00.000Z", { recap: "   " })],
      }),
    ).toBeNull();
  });
});

describe("composeWeeklyDigest — verified lessons and hours", () => {
  it("counts only lessons the shared verified predicate accepts", () => {
    const digest = compose({
      lessons: [
        lesson({ starts_at: "2026-11-17T02:00:00.000Z", duration_min: 60 }),
        lesson({
          status: "confirmed",
          starts_at: "2026-11-18T02:00:00.000Z",
          confirmed_by_parent_at: "2026-11-18T01:00:00.000Z",
          confirmed_by_tutor_at: "2026-11-18T01:30:00.000Z",
          duration_min: 60,
        }),
        // Unilateral confirm, planned and cancelled never count.
        lesson({
          status: "confirmed",
          starts_at: "2026-11-19T02:00:00.000Z",
          confirmed_by_parent_at: "2026-11-19T01:00:00.000Z",
        }),
        lesson({ status: "planned", starts_at: "2026-11-20T02:00:00.000Z" }),
        lesson({ status: "cancelled", starts_at: "2026-11-21T02:00:00.000Z" }),
      ],
    });
    expect(digest?.lessonsThisWeek).toBe(2);
    expect(digest?.hoursThisWeek).toBe(2);
  });

  it("rounds hours to one decimal and sums the total across all verified lessons", () => {
    const digest = compose({
      lessons: [
        // 100 min in the window → 1.666… → 1.7
        lesson({ starts_at: "2026-11-17T02:00:00.000Z", duration_min: 100 }),
        // Out of window but verified → total only.
        lesson({ starts_at: "2026-11-10T02:00:00.000Z", duration_min: 65 }),
        // Non-verified duration never reaches either number.
        lesson({ status: "planned", starts_at: "2026-11-18T02:00:00.000Z", duration_min: 480 }),
      ],
    });
    expect(digest?.hoursThisWeek).toBe(1.7);
    expect(digest?.hoursTotal).toBe(2.8);
  });

  it("keeps the window edges inclusive and excludes the Sunday 20:00 cut", () => {
    const digest = compose({
      lessons: [
        lesson({ starts_at: WEEK_START, duration_min: 30 }),
        lesson({ starts_at: WEEK_END, duration_min: 30 }),
        lesson({ starts_at: "2026-11-22T12:00:00.000Z", duration_min: 30 }),
      ],
    });
    expect(digest?.lessonsThisWeek).toBe(2);
    expect(digest?.hoursThisWeek).toBe(1);
  });
});

describe("composeWeeklyDigest — recaps", () => {
  it("keeps the newest three non-empty recaps, trimmed and newest first", () => {
    const digest = compose({
      logs: [
        log("2026-11-16T03:00:00.000Z", { recap: "  Oldest recap.  " }),
        log("2026-11-17T03:00:00.000Z", { recap: "Second recap." }),
        log("2026-11-18T03:00:00.000Z", { recap: "   " }),
        log("2026-11-19T03:00:00.000Z", { recap: "Third recap." }),
        log("2026-11-20T03:00:00.000Z", { recap: "Fourth recap." }),
        log("2026-11-21T03:00:00.000Z", { recap: "" }),
        log("2026-11-15T15:59:59.999Z", { recap: "Previous week, dropped." }),
      ],
    });
    expect(digest?.recaps).toEqual(["Fourth recap.", "Third recap.", "Second recap."]);
    expect(digest?.recaps.length).toBe(DIGEST_RECAP_MAX);
  });
});

describe("composeWeeklyDigest — homework, mistakes, next lesson", () => {
  it("counts submitted homework and mastered mistakes inside the window only", () => {
    const digest = compose({
      homework: [
        homework("2026-11-17T10:00:00.000Z"),
        homework("2026-11-22T12:00:00.000Z"),
        homework(null),
      ],
      mistakes: [
        mastered("2026-11-18T10:00:00.000Z"),
        mastered("2026-11-18T11:00:00.000Z", "unresolved"),
        mastered("2026-11-30T10:00:00.000Z"),
      ],
    });
    expect(digest?.homeworkCompleted).toBe(1);
    expect(digest?.mistakesMastered).toBe(1);
  });

  it("picks the earliest upcoming planned or confirmed lesson and its newest tag", () => {
    const digest = compose({
      lessons: [
        lesson({ status: "planned", starts_at: "2026-11-16T02:00:00.000Z" }),
        lesson({ status: "planned", starts_at: "2026-11-24T02:00:00.000Z" }),
        lesson({ status: "confirmed", starts_at: "2026-11-23T02:00:00.000Z" }),
        lesson({ status: "cancelled", starts_at: "2026-11-23T01:00:00.000Z" }),
      ],
      logs: [
        log("2026-11-21T03:00:00.000Z", { recap: "Week recap." }),
        log("2026-11-20T03:00:00.000Z", {
          topics: [{ tag: "Algebra", mastery: "practicing" }],
        }),
      ],
    });
    expect(digest?.nextLesson).toEqual({
      startsAt: "2026-11-23T02:00:00.000Z",
      tag: "Algebra",
    });
  });

  it("has no next lesson when nothing is still ahead", () => {
    const digest = compose({
      lessons: [lesson({ status: "planned", starts_at: "2026-11-16T02:00:00.000Z" })],
      homework: [homework("2026-11-17T10:00:00.000Z")],
    });
    expect(digest?.nextLesson).toBeNull();
  });
});

describe("composeWeeklyDigest — mastery snapshot and focus", () => {
  it("mirrors the heatmap split and puts weak tags before weak-by-mistakes", () => {
    const digest = compose({
      logs: [
        log("2026-11-18T03:00:00.000Z", {
          topics: [
            { tag: "Algebra", mastery: "weak" },
            { tag: "Kinematics", mastery: "mastered" },
            { tag: "Optics", mastery: "practicing" },
          ] as DrawerTopic[],
        }),
      ],
      homework: [homework("2026-11-18T10:00:00.000Z")],
      unresolvedMistakesByTopic: { kinematics: 3 },
    });
    expect(digest?.mastery).toEqual({ mastered: 0, practicing: 1, weak: 2 });
    expect(digest?.focus).toEqual(["Algebra", "Kinematics"]);
  });

  it(`caps focus at ${DIGEST_FOCUS_MAX} tags`, () => {
    const tags = ["Alpha", "Beta", "Delta", "Epsilon", "Gamma", "Zeta"];
    const digest = compose({
      logs: [
        log("2026-11-18T03:00:00.000Z", {
          topics: tags.map((tag) => ({ tag, mastery: "weak" })) as DrawerTopic[],
        }),
      ],
      homework: [homework("2026-11-18T10:00:00.000Z")],
    });
    expect(digest?.focus).toEqual(["Alpha", "Beta", "Delta", "Epsilon", "Gamma"]);
    expect(digest?.focus.length).toBe(DIGEST_FOCUS_MAX);
  });
});

describe("buildDigestCopy — bilingual WhatsApp block", () => {
  const en: DigestLabels = {
    header: "MatchMax weekly update",
    case: "Case {{code}}",
    lessons: "Verified lessons: {{n}}",
    hoursWeek: "Hours this week: {{h}}",
    hoursTotal: "Total verified hours: {{h}}",
    recap: "From your tutor",
    homework: "Homework completed: {{n}}",
    mistakes: "Mistakes mastered: {{n}}",
    next: "Next lesson: {{when}}",
    mastery: "Mastered {{mastered}} · Practising {{practicing}} · Weak {{weak}}",
    focus: "Focus areas",
  };
  const zh: DigestLabels = {
    header: "MatchMax 每週學習摘要",
    case: "個案 {{code}}",
    lessons: "已核實課堂：{{n}}",
    hoursWeek: "本週時數：{{h}}",
    hoursTotal: "累計核實時數：{{h}}",
    recap: "導師小結",
    homework: "已完成功課：{{n}}",
    mistakes: "已掌握錯題：{{n}}",
    next: "下一堂：{{when}}",
    mastery: "掌握 {{mastered}} · 練習中 {{practicing}} · 較弱 {{weak}}",
    focus: "重點範圍",
  };

  const digest: WeeklyDigest = {
    startIso: WEEK_START,
    endIso: WEEK_END,
    lessonsThisWeek: 2,
    hoursThisWeek: 1.5,
    hoursTotal: 12.5,
    recaps: ["Fractions are solid now. Call 9123 4567 or 123e4567-e89b-12d3-a456-426614174000."],
    homeworkCompleted: 3,
    mistakesMastered: 1,
    nextLesson: { startsAt: "2026-11-23T10:00:00.000Z", tag: "Algebra" },
    mastery: { mastered: 4, practicing: 2, weak: 1 },
    focus: ["Algebra"],
  };

  const copy = buildDigestCopy({
    digest,
    caseCode: "MM-7FQ2KD",
    link: "https://matchmax.hk/case/MM-7FQ2KD",
    en,
    zh,
    formatWhen: (iso, zone) =>
      zone === "en" ? `Mon 23 Nov, 6:00 pm (${iso})` : `11月23日（一）18:00（${iso}）`,
  });

  it("carries both languages, the case code and the link", () => {
    expect(copy).toContain("MatchMax weekly update");
    expect(copy).toContain("MatchMax 每週學習摘要");
    expect(copy).toContain("MM-7FQ2KD");
    expect(copy).toContain("https://matchmax.hk/case/MM-7FQ2KD");
  });

  it("interpolates the digest facts into the labels", () => {
    expect(copy).toContain("Verified lessons: 2");
    expect(copy).toContain("Hours this week: 1.5");
    expect(copy).toContain("Total verified hours: 12.5");
    expect(copy).toContain("Homework completed: 3");
    expect(copy).toContain("Mistakes mastered: 1");
    expect(copy).toContain("Mastered 4 · Practising 2 · Weak 1");
    expect(copy).toContain("已核實課堂：2");
    expect(copy).toContain("掌握 4 · 練習中 2 · 較弱 1");
  });

  it("renders the next lesson per language and keeps the recap bullets", () => {
    expect(copy).toContain("Next lesson: Mon 23 Nov, 6:00 pm");
    expect(copy).toContain("下一堂：11月23日（一）18:00");
    expect(copy).toContain("• Fractions are solid now.");
    expect(copy).toContain("• Algebra");
  });

  it("never carries a uuid, an email or a phone number", () => {
    expect(copy).not.toContain("123e4567-e89b-12d3-a456-426614174000");
    expect(copy).not.toContain("9123 4567");
    expect(copy).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i);
  });

  it("puts English before the Chinese block", () => {
    expect(copy.indexOf("MatchMax weekly update")).toBeLessThan(
      copy.indexOf("MatchMax 每週學習摘要"),
    );
  });
});
