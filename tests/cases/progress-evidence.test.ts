import { describe, expect, it } from "vitest";

import {
  EDGE_WINDOW_DAYS,
  evaluateProgressCard,
  isValidScaleValue,
  meetsTenureFloor,
  PROGRESS_DISCLAIMER,
  PUBLIC_EXAM_WINDOW_DAYS,
  sortPublicCards,
  deltaLabel,
  type CardCandidate,
} from "../../src/features/cases/progress-evidence";

const tenure = { completedLessons: 6, daysSinceFirstLesson: 90, verifiedHours: 9 };

const base: CardCandidate = {
  checkpoints: [
    { type: "school_quiz", scale: "dse", value: "4", month: "2026-02" },
    { type: "mock", scale: "dse", value: "5*", month: "2026-06" },
  ],
  verification: "parent_attested",
  anonymousShareConsent: true,
  tenure,
  firstLessonAt: "2026-01-15",
  lastLessonAt: "2026-07-01",
};

describe("#794 §2.6 progress card rules", () => {
  it("publishes a verified two-checkpoint card on one scale", () => {
    expect(evaluateProgressCard(base)).toEqual({ publishable: true });
  });

  it("keeps a single datapoint private", () => {
    const verdict = evaluateProgressCard({
      ...base,
      checkpoints: [{ type: "mock", scale: "dse", value: "5", month: "2026-06" }],
    });
    expect(verdict).toEqual({ publishable: false, reasons: ["too_few_checkpoints"] });
  });

  it("rejects mixed scales on one card (AC-730-5)", () => {
    const verdict = evaluateProgressCard({
      ...base,
      checkpoints: [
        { type: "mock", scale: "dse", value: "4", month: "2026-02" },
        { type: "mock", scale: "ibdp", value: "6", month: "2026-06" },
      ],
    });
    expect(verdict).toEqual({ publishable: false, reasons: ["mixed_scales"] });
  });

  it("never publishes Predicted -> Predicted only", () => {
    const verdict = evaluateProgressCard({
      ...base,
      checkpoints: [
        { type: "predicted", scale: "alevel", value: "B", month: "2026-03" },
        { type: "predicted", scale: "alevel", value: "A", month: "2026-06" },
      ],
    });
    expect(verdict).toEqual({ publishable: false, reasons: ["predicted_only"] });
  });

  it("keeps a tutor-only claim private", () => {
    const verdict = evaluateProgressCard({ ...base, verification: "tutor_unconfirmed" });
    expect(verdict).toEqual({ publishable: false, reasons: ["unverified"] });
  });

  it("requires anonymous share consent", () => {
    const verdict = evaluateProgressCard({ ...base, anonymousShareConsent: false });
    expect(verdict).toEqual({ publishable: false, reasons: ["no_consent"] });
  });

  it("honours the 4-lesson / 30-day / 6-hour floor", () => {
    expect(
      meetsTenureFloor({ completedLessons: 4, daysSinceFirstLesson: 0, verifiedHours: 0 }),
    ).toBe(true);
    expect(
      meetsTenureFloor({ completedLessons: 0, daysSinceFirstLesson: 30, verifiedHours: 0 }),
    ).toBe(true);
    expect(
      meetsTenureFloor({ completedLessons: 0, daysSinceFirstLesson: 0, verifiedHours: 6 }),
    ).toBe(true);
    expect(
      meetsTenureFloor({ completedLessons: 3, daysSinceFirstLesson: 29, verifiedHours: 5.5 }),
    ).toBe(false);
  });

  it("allows a public exam up to 120 days after the last lesson, and no further", () => {
    const inside = evaluateProgressCard({
      ...base,
      lastLessonAt: "2026-06-01",
      checkpoints: [
        { type: "mock", scale: "dse", value: "4", month: "2026-02" },
        { type: "public_exam", scale: "dse", value: "5**", month: "2026-09" },
      ],
    });
    expect(inside).toEqual({ publishable: true });

    const outside = evaluateProgressCard({
      ...base,
      lastLessonAt: "2026-01-01",
      checkpoints: [
        { type: "mock", scale: "dse", value: "4", month: "2026-02" },
        { type: "public_exam", scale: "dse", value: "5**", month: "2026-09" },
      ],
    });
    expect(outside.publishable).toBe(false);
    expect(PUBLIC_EXAM_WINDOW_DAYS).toBe(120);
  });

  it("bounds a non-exam latest point to 60 days past the last lesson", () => {
    const verdict = evaluateProgressCard({
      ...base,
      lastLessonAt: "2026-03-01",
      checkpoints: [
        { type: "mock", scale: "dse", value: "4", month: "2026-02" },
        { type: "term_exam", scale: "dse", value: "5", month: "2026-06" },
      ],
    });
    expect(verdict).toEqual({ publishable: false, reasons: ["outside_windows"] });
    expect(EDGE_WINDOW_DAYS).toBe(60);
  });

  it("validates values per scale", () => {
    expect(isValidScaleValue("dse", "5**")).toBe(true);
    expect(isValidScaleValue("dse", "5***")).toBe(false);
    expect(isValidScaleValue("ibdp", "7")).toBe(true);
    expect(isValidScaleValue("ibdp", "8")).toBe(false);
    expect(isValidScaleValue("alevel", "A*")).toBe(true);
    expect(isValidScaleValue("percent", "82")).toBe(true);
    expect(isValidScaleValue("percent", "140")).toBe(false);
  });

  it("orders cards by most recent verified assessment, not biggest jump", () => {
    const olderBigJump = {
      checkpoints: [
        { type: "mock" as const, scale: "dse" as const, value: "1", month: "2025-06" },
        { type: "mock" as const, scale: "dse" as const, value: "5**", month: "2025-09" },
      ],
      lastLessonAt: "2025-10-01",
    };
    const newerSmallJump = {
      checkpoints: [
        { type: "mock" as const, scale: "dse" as const, value: "4", month: "2026-04" },
        { type: "mock" as const, scale: "dse" as const, value: "5", month: "2026-05" },
      ],
      lastLessonAt: "2026-05-20",
    };
    expect(sortPublicCards([olderBigJump, newerSmallJump])[0]).toBe(newerSmallJump);
  });

  it("labels a delta in the native scale and carries the non-guarantee disclaimer", () => {
    expect(
      deltaLabel(
        { type: "mock", scale: "dse", value: "4", month: "2026-02" },
        { type: "mock", scale: "dse", value: "5*", month: "2026-06" },
      ),
    ).toBe("4 → 5*");
    expect(PROGRESS_DISCLAIMER).toContain("no grade is guaranteed");
    expect(PROGRESS_DISCLAIMER).toContain("不保證達標");
  });
});
