import { describe, expect, it } from "vitest";

import {
  DESK_REPORT_REASONS,
  completedLessonCount,
  directionPublishesPublicly,
  evaluateRatingWindow,
  latestCompletedLessonAt,
  privateReportOnly,
} from "../../src/features/cases/rating-window";

const DAY = 86_400_000;
const NOW = new Date("2026-11-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

describe("rating edit window (#794 §2.1)", () => {
  it("no eligible lesson → closed, private desk report only", () => {
    const w = evaluateRatingWindow({
      now: NOW,
      caseEndedAt: null,
      lastSavedAt: null,
      eligibleLessonsNow: 0,
      eligibleLessonsAtSave: null,
    });
    expect(w.canWrite).toBe(false);
    expect(w.canPublish).toBe(false);
    expect(w.reason).toBe("no_eligible_lesson");
    expect(w.freezeAt).toBeNull();
    expect(privateReportOnly(0)).toBe(true);
  });

  it("first write after one completed lesson is open", () => {
    const w = evaluateRatingWindow({
      now: NOW,
      caseEndedAt: null,
      lastSavedAt: null,
      eligibleLessonsNow: 1,
      eligibleLessonsAtSave: null,
    });
    expect(w.canWrite).toBe(true);
    expect(w.canPublish).toBe(true);
    expect(w.reason).toBe("open_first");
    expect(w.freezeAt).toBeNull();
  });

  it("14 days after a save is still editable; day 15 is frozen", () => {
    const inside = evaluateRatingWindow({
      now: NOW,
      caseEndedAt: null,
      lastSavedAt: daysAgo(13),
      eligibleLessonsNow: 1,
      eligibleLessonsAtSave: 1,
    });
    expect(inside.canWrite).toBe(true);
    expect(inside.reason).toBe("open_edit_window");
    expect(inside.daysLeft).toBe(1);

    const outside = evaluateRatingWindow({
      now: NOW,
      caseEndedAt: null,
      lastSavedAt: daysAgo(15),
      eligibleLessonsNow: 1,
      eligibleLessonsAtSave: 1,
    });
    expect(outside.canWrite).toBe(false);
    expect(outside.reason).toBe("frozen_edit_window");
    expect(outside.daysLeft).toBe(0);
    expect(outside.freezeAt).not.toBeNull();
  });

  it("a NEW completed lesson reopens a frozen review (stay current)", () => {
    const w = evaluateRatingWindow({
      now: NOW,
      caseEndedAt: null,
      lastSavedAt: daysAgo(40),
      eligibleLessonsNow: 2,
      eligibleLessonsAtSave: 1,
    });
    expect(w.canWrite).toBe(true);
    expect(w.reason).toBe("open_new_lesson");
    // The new deadline only starts at the next save.
    expect(w.freezeAt).toBeNull();
  });

  it("after the case ends both parties have 14 days, then it freezes", () => {
    const endedRecently = evaluateRatingWindow({
      now: NOW,
      caseEndedAt: daysAgo(10),
      lastSavedAt: daysAgo(60),
      eligibleLessonsNow: 3,
      eligibleLessonsAtSave: 1,
    });
    expect(endedRecently.canWrite).toBe(true);
    expect(endedRecently.reason).toBe("open_case_end_window");
    expect(endedRecently.daysLeft).toBe(4);

    const endedLongAgo = evaluateRatingWindow({
      now: NOW,
      caseEndedAt: daysAgo(20),
      lastSavedAt: null,
      eligibleLessonsNow: 3,
      eligibleLessonsAtSave: null,
    });
    expect(endedLongAgo.canWrite).toBe(false);
    expect(endedLongAgo.reason).toBe("frozen_case_ended");

    // Never left a review and the case had no completed lesson → still closed.
    const noLessonEnded = evaluateRatingWindow({
      now: NOW,
      caseEndedAt: daysAgo(2),
      lastSavedAt: null,
      eligibleLessonsNow: 0,
      eligibleLessonsAtSave: null,
    });
    expect(noLessonEnded.canWrite).toBe(false);
    expect(noLessonEnded.reason).toBe("no_eligible_lesson");
  });

  it("a new save restarts the 14-day clock", () => {
    const w = evaluateRatingWindow({
      now: NOW,
      caseEndedAt: null,
      lastSavedAt: daysAgo(0),
      eligibleLessonsNow: 2,
      eligibleLessonsAtSave: 2,
    });
    expect(w.daysLeft).toBe(14);
    expect(new Date(w.freezeAt ?? 0).getTime()).toBe(NOW.getTime() + 14 * DAY);
  });
});

describe("completed-lesson counting (#794 §2.1)", () => {
  it("counts Mark-done lessons and bilaterally confirmed ones only", () => {
    expect(
      completedLessonCount([
        { status: "done", confirmed_by_parent_at: null, confirmed_by_tutor_at: null },
        {
          status: "confirmed",
          confirmed_by_parent_at: "t",
          confirmed_by_tutor_at: "t",
        },
        { status: "planned", confirmed_by_parent_at: null, confirmed_by_tutor_at: null },
        { status: "cancelled", confirmed_by_parent_at: "t", confirmed_by_tutor_at: "t" },
      ]),
    ).toBe(2);
  });

  it("picks the latest completed lesson start", () => {
    expect(
      latestCompletedLessonAt([
        {
          status: "done",
          confirmed_by_parent_at: null,
          confirmed_by_tutor_at: null,
          starts_at: "2026-11-01T10:00:00Z",
        },
        {
          status: "done",
          confirmed_by_parent_at: null,
          confirmed_by_tutor_at: null,
          starts_at: "2026-11-08T10:00:00Z",
        },
        {
          status: "planned",
          confirmed_by_parent_at: null,
          confirmed_by_tutor_at: null,
          starts_at: "2026-11-30T10:00:00Z",
        },
      ]),
    ).toBe("2026-11-08T10:00:00.000Z");
    expect(latestCompletedLessonAt([])).toBeNull();
  });
});

describe("privacy + desk report (#794 §2.1)", () => {
  it("only parent→tutor publishes publicly", () => {
    expect(directionPublishesPublicly("parent_to_tutor")).toBe(true);
    expect(directionPublishesPublicly("tutor_to_parent")).toBe(false);
  });

  it("locks the four desk-report reasons", () => {
    expect([...DESK_REPORT_REASONS]).toEqual([
      "no_show",
      "rude_unsafe",
      "never_confirmed",
      "other",
    ]);
  });
});
