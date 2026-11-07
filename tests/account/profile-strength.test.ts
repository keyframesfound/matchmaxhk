import { describe, expect, it } from "vitest";

import { availabilityFreshness } from "../../src/features/cases/availability-freshness";
import { courseworkPreCheck } from "../../src/features/cases/coursework-precheck";
import { profileStrength } from "../../src/features/account/profile-strength";

describe("#673 availability freshness", () => {
  it("is stale after 14 days and deducts 15 strength points", () => {
    const now = new Date("2026-11-07T00:00:00Z");
    expect(availabilityFreshness("2026-11-06T00:00:00Z", now)).toMatchObject({
      stale: false,
      strengthDeduction: 0,
    });
    expect(availabilityFreshness("2026-10-20T00:00:00Z", now)).toMatchObject({
      stale: true,
      strengthDeduction: 15,
    });
    expect(availabilityFreshness(null, now)).toMatchObject({
      stale: false,
      neverConfirmed: true,
      strengthDeduction: 0,
    });
  });
});

describe("#673 unified Profile Strength", () => {
  const full = {
    role: "tutor" as const,
    hasDisplayName: true,
    hasBio: true,
    subjectsCount: 3,
    hasPhoto: true,
    isPublished: true,
    hasRates: true,
    hasAvailability: true,
    hasWeeklyWindows: true,
  };

  it("reaches 100 when every signal is present", () => {
    expect(profileStrength(full)).toMatchObject({ score: 100, nba: null });
  });

  it("is deterministic and names ONE next-best-action by weight", () => {
    const a = profileStrength({ ...full, subjectsCount: 0, isPublished: false });
    const b = profileStrength({ ...full, subjectsCount: 0, isPublished: false });
    expect(a).toEqual(b);
    expect(a.score).toBe(100 - 20 - 10);
    expect(a.nba?.id).toBe("subjects");
  });

  it("a stale availability grid owns the NBA and caps the score", () => {
    const out = profileStrength({ ...full, freshnessDeduction: 15 });
    expect(out.score).toBe(85);
    expect(out.nba?.id).toBe("availability");
  });
});

describe("#673 coursework integrity pre-check", () => {
  it("fires on TOK / EE / IA / SBA and one-off wording", () => {
    expect(
      courseworkPreCheck({ subjects: ["IB History"], specificComponent: "TOK essay", notes: null }),
    ).toMatchObject({ required: true, trigger: "coursework" });
    expect(
      courseworkPreCheck({ subjects: [], notes: "need a one-off review before finals" }),
    ).toMatchObject({ required: true, trigger: "one_off" });
    expect(courseworkPreCheck({ subjects: ["Chemistry"], notes: "weekly lessons" })).toMatchObject({
      required: false,
      trigger: null,
    });
  });
});
