import { describe, expect, it } from "vitest";

import { nextLessonSequence, scheduleLessonError } from "../../src/features/cases/schedule-lesson";

/**
 * Issue #461 Phase A 3c — tutor "Schedule next lesson": one slot, no
 * recurrence, same double-book and buffer rules as the rest of SoR.
 */
const NOW = new Date("2026-10-15T04:00:00Z");

const base = {
  sorStatus: "active",
  startsAtIso: "2026-10-20T10:00:00Z",
  durationMin: 90,
  online: false,
  now: NOW,
  existing: [] as { starts_at: string; duration_min: number; mode?: string | null }[],
};

describe("scheduleLessonError", () => {
  it("accepts a future slot on an active case", () => {
    expect(scheduleLessonError(base)).toBeNull();
    expect(scheduleLessonError({ ...base, sorStatus: "fee_paid" })).toBeNull();
  });

  it("leaves lessons 1 and 2 to the desk", () => {
    expect(scheduleLessonError({ ...base, sorStatus: "lesson_1_done" })).toBe("CASE_NOT_ACTIVE");
    expect(scheduleLessonError({ ...base, sorStatus: null })).toBe("CASE_NOT_ACTIVE");
  });

  it("rejects past, unparseable and far-future times", () => {
    expect(scheduleLessonError({ ...base, startsAtIso: "2026-10-15T03:59:00Z" })).toBe("IN_PAST");
    expect(scheduleLessonError({ ...base, startsAtIso: "soon" })).toBe("BAD_TIME");
    expect(scheduleLessonError({ ...base, startsAtIso: "2027-02-01T10:00:00Z" })).toBe(
      "TOO_FAR_AHEAD",
    );
  });

  it("needs 15–480 minutes in 15-minute steps", () => {
    expect(scheduleLessonError({ ...base, durationMin: 10 })).toBe("BAD_DURATION");
    expect(scheduleLessonError({ ...base, durationMin: 485 })).toBe("BAD_DURATION");
    expect(scheduleLessonError({ ...base, durationMin: 50 })).toBe("BAD_DURATION");
  });

  it("refuses an overlap or a face-to-face slot inside the travel buffer", () => {
    const existing = [{ starts_at: "2026-10-20T08:00:00Z", duration_min: 105, mode: "in_person" }];
    // ends 09:45Z; the new lesson at 10:00Z is inside the 30-minute F2F buffer
    expect(scheduleLessonError({ ...base, existing })).toBe("SLOT_CONFLICT");
  });

  it("skips the travel buffer when both lessons are online", () => {
    const existing = [{ starts_at: "2026-10-20T08:00:00Z", duration_min: 105, mode: "online" }];
    expect(scheduleLessonError({ ...base, existing, online: true })).toBeNull();
  });
});

describe("nextLessonSequence", () => {
  it("is one past the highest sequence, cancelled or not", () => {
    expect(nextLessonSequence([])).toBe(1);
    expect(nextLessonSequence([{ sequence: 1 }, { sequence: 4 }, { sequence: 2 }])).toBe(5);
  });
});
