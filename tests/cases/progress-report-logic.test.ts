import { describe, expect, it } from "vitest";

import {
  REPORT_FOCUS_MAX,
  buildProgressReport,
  scrubReportText,
  type BuildProgressReportInput,
  type ProgressLessonRow,
} from "../../src/features/cases/progress-report-logic";
import type {
  DrawerLogRow,
  DrawerTopic,
} from "../../src/features/cases/super-drawer/super-drawer-logic";

/**
 * Issue #796 §2.6 (was #742), AC-742-3 — the Progress Report is the printable
 * all-time snapshot for the case parent / student owner. These tests pin the
 * data contract: verified-only counting, one-decimal hours, verified-only
 * period, weak-first focus, the null-on-nothing rule, and the hard rule that
 * no uuid, email or phone can appear anywhere in the payload.
 */

const NOW = new Date("2026-11-22T04:00:00.000Z");

const CASE_UUID = "11111111-2222-4333-8444-555555555555";
const STUDENT_UUID = "66666666-7777-4888-9999-aaaaaaaaaaaa";
const TUTOR_UUID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_PATTERN = /(?:\+?852[\s-]?)?[2-9]\d{3}[\s-]?\d{4}\b/;

function lesson(over: Partial<ProgressLessonRow> = {}): ProgressLessonRow {
  return {
    status: "done",
    confirmed_by_parent_at: null,
    confirmed_by_tutor_at: null,
    starts_at: "2026-11-10T09:00:00.000Z",
    duration_min: 60,
    ...over,
  };
}

function log(topics: DrawerTopic[], createdAt = "2026-11-10T10:00:00.000Z"): DrawerLogRow {
  return {
    id: `log-${createdAt}-${topics.map((t) => t.tag).join("-")}`,
    case_id: CASE_UUID,
    lesson_id: `lesson-${createdAt}`,
    logged_by: TUTOR_UUID,
    recap_status: "complete",
    topics,
    pulse: {},
    recap: null,
    next_lesson_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function input(over: Partial<BuildProgressReportInput> = {}): BuildProgressReportInput {
  return {
    now: NOW,
    caseCode: "MM-1234",
    studentName: "Chloe",
    subject: "Physics",
    tutorName: "Mr Chan",
    lessons: [lesson()],
    logs: [log([{ tag: "Kinematics", mastery: "practicing" }])],
    ...over,
  };
}

describe("scrubReportText", () => {
  it("keeps an ordinary name untouched", () => {
    expect(scrubReportText("Chloe")).toBe("Chloe");
    expect(scrubReportText("  Mr  Chan ")).toBe("Mr Chan");
  });

  it("keeps null as null", () => {
    expect(scrubReportText(null)).toBeNull();
  });

  it("drops a uuid entirely and returns null when nothing remains", () => {
    expect(scrubReportText(CASE_UUID)).toBeNull();
    expect(scrubReportText(`Ava ${STUDENT_UUID}`)).toBe("Ava");
  });

  it("drops emails", () => {
    expect(scrubReportText("mail me at tutor.abc@example.com")).toBe("mail me at");
    expect(scrubReportText("tutor.abc@example.com")).toBeNull();
  });

  it("drops Hong Kong and separated phone numbers", () => {
    expect(scrubReportText("call 9123 4567")).toBe("call");
    expect(scrubReportText("+852 6123 4567")).toBeNull();
    expect(scrubReportText("phone 6123-4567 ok")).toBe("phone ok");
  });

  it("never leaves a uuid, email or phone behind", () => {
    const dirty = `Ava ${STUDENT_UUID} a@b.com 9123 4567 ${TUTOR_UUID}`;
    const clean = scrubReportText(dirty) ?? "";
    expect(clean).not.toMatch(UUID_PATTERN);
    expect(clean).not.toMatch(EMAIL_PATTERN);
    expect(clean).not.toMatch(PHONE_PATTERN);
  });
});

describe("buildProgressReport verified lessons and hours", () => {
  it("counts only completed lessons (done, or bilaterally confirmed)", () => {
    const report = buildProgressReport(
      input({
        lessons: [
          lesson({ status: "done" }),
          lesson({
            status: "confirmed",
            confirmed_by_parent_at: "2026-11-11T00:00:00.000Z",
            confirmed_by_tutor_at: "2026-11-11T00:00:00.000Z",
          }),
          lesson({ status: "planned" }),
          lesson({ status: "cancelled" }),
          lesson({ status: "no_show" }),
          lesson({ status: "late_cancel" }),
          // Half-confirmed never counts.
          lesson({
            status: "confirmed",
            confirmed_by_parent_at: "2026-11-11T00:00:00.000Z",
            confirmed_by_tutor_at: null,
          }),
        ],
      }),
    );

    expect(report).not.toBeNull();
    expect(report?.verifiedLessons).toBe(2);
  });

  it("rounds verified minutes to one decimal place", () => {
    const report = buildProgressReport(
      input({
        lessons: [
          lesson({ duration_min: 50 }),
          lesson({ duration_min: 25 }),
          lesson({ duration_min: null }),
          lesson({ status: "planned", duration_min: 600 }),
        ],
      }),
    );

    // 75 minutes = 1.25 h → 1.3, and always a 1dp figure.
    expect(report?.verifiedHours).toBe(1.3);
    expect(Number.isInteger((report?.verifiedHours ?? 0) * 10)).toBe(true);
  });

  it("ignores a negative or non-numeric duration", () => {
    const report = buildProgressReport(
      input({
        lessons: [lesson({ duration_min: 90 }), lesson({ duration_min: -30 })],
      }),
    );

    expect(report?.verifiedHours).toBe(1.5);
  });
});

describe("buildProgressReport period", () => {
  it("spans the earliest and latest verified lesson only", () => {
    const report = buildProgressReport(
      input({
        lessons: [
          lesson({ starts_at: "2026-11-10T09:00:00.000Z" }),
          lesson({ starts_at: "2026-11-20T09:00:00.000Z" }),
          // Wider than the verified range, but neither is completed.
          lesson({ status: "planned", starts_at: "2026-01-01T09:00:00.000Z" }),
          lesson({ status: "cancelled", starts_at: "2026-12-31T09:00:00.000Z" }),
        ],
      }),
    );

    expect(report?.periodStartIso).toBe("2026-11-10T09:00:00.000Z");
    expect(report?.periodEndIso).toBe("2026-11-20T09:00:00.000Z");
  });

  it("is null on both ends when nothing is verified", () => {
    const report = buildProgressReport(
      input({
        lessons: [lesson({ status: "planned" })],
      }),
    );

    expect(report?.periodStartIso).toBeNull();
    expect(report?.periodEndIso).toBeNull();
  });
});

describe("buildProgressReport mastery and focus", () => {
  it("counts the heatmap summary bands", () => {
    const report = buildProgressReport(
      input({
        logs: [
          log([
            { tag: "Algebra", mastery: "mastered" },
            { tag: "Geometry", mastery: "practicing" },
            { tag: "Calculus", mastery: "weak" },
          ]),
        ],
      }),
    );

    expect(report?.mastery).toEqual({ mastered: 1, practicing: 1, weak: 1 });
  });

  it("puts tutor-marked weak topics before mistake-forced weak ones", () => {
    const report = buildProgressReport(
      input({
        logs: [
          log([
            { tag: "Algebra", mastery: "weak" },
            { tag: "Geometry", mastery: "weak" },
            { tag: "Calculus", mastery: "practicing" },
          ]),
        ],
        unresolvedMistakesByTopic: { calculus: 3 },
      }),
    );

    expect(report?.focus).toEqual(["Algebra", "Geometry", "Calculus"]);
  });

  it("caps focus at five weak-first topics", () => {
    const report = buildProgressReport(
      input({
        logs: [
          log([
            { tag: "T1", mastery: "weak" },
            { tag: "T2", mastery: "weak" },
            { tag: "T3", mastery: "weak" },
            { tag: "T4", mastery: "weak" },
            { tag: "T5", mastery: "weak" },
            { tag: "T6", mastery: "weak" },
            { tag: "T7", mastery: "weak" },
          ]),
        ],
      }),
    );

    expect(report?.focus).toHaveLength(REPORT_FOCUS_MAX);
    expect(report?.focus).toEqual(["T1", "T2", "T3", "T4", "T5"]);
  });

  it("omits mastered and practicing topics from focus", () => {
    const report = buildProgressReport(
      input({
        logs: [
          log([
            { tag: "Algebra", mastery: "mastered" },
            { tag: "Geometry", mastery: "practicing" },
          ]),
        ],
      }),
    );

    expect(report?.focus).toEqual([]);
  });
});

describe("buildProgressReport null rule", () => {
  it("returns null when there is no verified lesson and no tagged log", () => {
    expect(
      buildProgressReport(
        input({
          lessons: [],
          logs: [],
          unresolvedMistakesByTopic: {},
        }),
      ),
    ).toBeNull();

    // Unverified lessons alone are still nothing verified.
    expect(
      buildProgressReport(
        input({
          lessons: [lesson({ status: "planned" }), lesson({ status: "no_show" })],
          logs: [],
        }),
      ),
    ).toBeNull();
  });

  it("still reports a tagged case with no verified lesson yet", () => {
    const report = buildProgressReport(
      input({
        lessons: [lesson({ status: "planned" })],
        logs: [log([{ tag: "Kinematics", mastery: "weak" }])],
      }),
    );

    expect(report).not.toBeNull();
    expect(report?.verifiedLessons).toBe(0);
    expect(report?.verifiedHours).toBe(0);
    expect(report?.focus).toEqual(["Kinematics"]);
  });

  it("still reports a verified case with no tags yet", () => {
    const report = buildProgressReport(input({ lessons: [lesson()], logs: [] }));

    expect(report).not.toBeNull();
    expect(report?.verifiedLessons).toBe(1);
    expect(report?.mastery).toEqual({ mastered: 0, practicing: 0, weak: 0 });
    expect(report?.focus).toEqual([]);
  });
});

describe("buildProgressReport identity", () => {
  it("scrubs the student and tutor names", () => {
    const report = buildProgressReport(
      input({
        studentName: `Ava ${STUDENT_UUID}`,
        tutorName: `Mr Chan ${TUTOR_UUID} chan@example.com 9123 4567`,
      }),
    );

    expect(report?.studentName).toBe("Ava");
    expect(report?.tutorName).toBe("Mr Chan");
  });

  it("keeps the public case code and the issued timestamp", () => {
    const report = buildProgressReport(input());

    expect(report?.caseCode).toBe("MM-1234");
    expect(report?.issuedAtIso).toBe(NOW.toISOString());
    expect(report?.subject).toBe("Physics");
  });

  it("leaks no uuid, email or phone anywhere in the serialized report", () => {
    const report = buildProgressReport(
      input({
        // A uuid that arrived where the public code should be.
        caseCode: CASE_UUID,
        studentName: `Ava ${STUDENT_UUID}`,
        subject: `Physics ${TUTOR_UUID}`,
        tutorName: `Tutor ${TUTOR_UUID} tutor@example.com 6123 4567`,
        logs: [
          log([
            { tag: `Kinematics ${CASE_UUID}`, mastery: "weak" },
            { tag: "Mole calculations 9123 4567", mastery: "practicing" },
          ]),
        ],
        lessons: [lesson(), lesson({ duration_min: 75, starts_at: "2026-11-20T09:00:00.000Z" })],
      }),
    );

    const serialized = JSON.stringify(report);
    expect(serialized).not.toMatch(UUID_PATTERN);
    expect(serialized).not.toMatch(EMAIL_PATTERN);
    expect(serialized).not.toMatch(PHONE_PATTERN);
    expect(serialized).not.toContain(CASE_UUID);
    expect(serialized).not.toContain(STUDENT_UUID);
    expect(serialized).not.toContain(TUTOR_UUID);
    expect(serialized).not.toContain("tutor@example.com");
    // The scrubbed-away code degrades to an empty string, never a uuid.
    expect(report?.caseCode).toBe("");
  });
});
