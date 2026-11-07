import { describe, expect, it } from "vitest";

import {
  computeStrength,
  type TutorSignals,
} from "../src/features/profile-strength/profile-strength";

const done: TutorSignals = {
  kind: "tutor",
  hasWindows: true,
  hasSubjects: true,
  hasRate: true,
  hasPhoto: true,
  hasBlueTick: true,
  blueTickInReview: false,
  isPublished: true,
};

describe("computeStrength: one next-best-action, in the locked order", () => {
  it("availability beats everything else", () => {
    const r = computeStrength({
      ...done,
      hasWindows: false,
      hasSubjects: false,
      hasBlueTick: false,
      isPublished: false,
    });
    expect(r.next).toBe("availability");
  });

  it("then subjects and rate, then Blue Tick, then publish", () => {
    expect(computeStrength({ ...done, hasRate: false, hasBlueTick: false }).next).toBe(
      "subjects_rate",
    );
    expect(computeStrength({ ...done, hasBlueTick: false, isPublished: false }).next).toBe(
      "blue_tick",
    );
    expect(computeStrength({ ...done, isPublished: false }).next).toBe("publish");
  });

  it("is complete with no action at 100%", () => {
    expect(computeStrength(done)).toEqual({ pct: 100, next: null, blueTick: "verified" });
  });

  it("shows review progress without nagging for the credential again", () => {
    const r = computeStrength({ ...done, hasBlueTick: false, blueTickInReview: true });
    expect(r.blueTick).toBe("in_review");
    expect(r.next).toBeNull();
    expect(r.pct).toBeLessThan(100);
  });
});

describe("computeStrength: parents", () => {
  it("walks case, briefing, then preferred times", () => {
    const base = { kind: "parent" as const, hasBriefing: false, hasPreferredTimes: false };
    expect(computeStrength({ ...base, hasCase: false }).next).toBe("post_case");
    expect(computeStrength({ ...base, hasCase: true }).next).toBe("briefing");
    expect(computeStrength({ ...base, hasCase: true, hasBriefing: true }).next).toBe(
      "preferred_times",
    );
    expect(computeStrength({ ...base, hasCase: true }).blueTick).toBeNull();
    expect(computeStrength({ ...base, hasCase: true }).pct).toBe(33);
  });
});
