import { describe, expect, it } from "vitest";

import {
  DEFAULT_PULSE,
  DRAWER_DURATION_MAX,
  DRAWER_DURATION_MIN,
  clampDurationMin,
  defaultDurationMin,
  fanoutJobsFor,
  nextLessonDefaultIso,
  recapStatusFor,
  stepDurationMin,
  suggestedTopics,
  syncValidationError,
} from "../../src/features/cases/super-drawer/super-drawer-logic";

/** Issue #767: Super-Drawer pure rules — defaults, Wave-1 minimum, fan-out. */

describe("duration defaults", () => {
  it("defaults to the case weekly length clamped to the drawer range", () => {
    expect(defaultDurationMin(90)).toBe(90);
    expect(defaultDurationMin(60)).toBe(60);
    expect(defaultDurationMin(null)).toBe(60);
    expect(defaultDurationMin(0)).toBe(60);
    expect(defaultDurationMin(100)).toBe(90); // rounds to the 0.5h step
    expect(defaultDurationMin(600)).toBe(DRAWER_DURATION_MAX); // DB check 480
    expect(defaultDurationMin(10)).toBe(DRAWER_DURATION_MIN); // DB check 15 floor → drawer 30
  });

  it("steps by 0.5h inside the clamp", () => {
    expect(stepDurationMin(90, 1)).toBe(120);
    expect(stepDurationMin(90, -1)).toBe(60);
    expect(stepDurationMin(DRAWER_DURATION_MAX, 1)).toBe(DRAWER_DURATION_MAX);
    expect(stepDurationMin(DRAWER_DURATION_MIN, -1)).toBe(DRAWER_DURATION_MIN);
    expect(clampDurationMin(47)).toBe(60);
  });
});

describe("smart defaults", () => {
  it("defaults the pulse to the positive states", () => {
    expect(DEFAULT_PULSE).toEqual({
      punctuality: "on_time",
      focus: "attentive",
      prepHw: "prepared",
    });
  });

  it("defaults the next lesson to +7 days, same time", () => {
    const now = new Date("2026-11-14T09:30:00Z");
    expect(nextLessonDefaultIso(now)).toBe("2026-11-21T09:30:00.000Z");
  });
});

describe("Wave-1 minimum (recap status + sync validation)", () => {
  it("Full Sync with >=1 tag is complete; hours-only and 0 tags are incomplete", () => {
    expect(recapStatusFor("full", 1)).toBe("complete");
    expect(recapStatusFor("full", 3)).toBe("complete");
    expect(recapStatusFor("full", 0)).toBe("incomplete");
    expect(recapStatusFor("hours_only", 0)).toBe("incomplete");
  });

  it("full sync requires >=1 tag; hours-only never blocks", () => {
    expect(syncValidationError("full", 0)).toBe("TAG_REQUIRED");
    expect(syncValidationError("full", 1)).toBeNull();
    expect(syncValidationError("hours_only", 0)).toBeNull();
  });
});

describe("silent fan-out contract", () => {
  it("full sync with >=1 tag enqueues heatmap + notes + digest", () => {
    expect(fanoutJobsFor("full", 1)).toEqual([
      "heatmap_cell",
      "notes_recommendations",
      "weekly_digest",
    ]);
  });

  it("hours-only enqueues the minimal digest signal only (heatmap stays empty until tags)", () => {
    expect(fanoutJobsFor("hours_only", 0)).toEqual(["weekly_digest"]);
    expect(fanoutJobsFor("full", 0)).toEqual(["weekly_digest"]);
  });
});

describe("context-aware topic chips", () => {
  const prior = [
    { tag: "Elasticity", mastery: "practicing" as const },
    { tag: "MarketStructure", mastery: "weak" as const },
    { tag: "Inflation", mastery: null },
    { tag: "FiscalPolicy", mastery: "weak" as const },
  ];

  it("prioritises weak, then practicing, then recent, then the subject default", () => {
    const out = suggestedTopics(prior, "Economics");
    expect(out.map((t) => t.tag)).toEqual([
      "MarketStructure",
      "FiscalPolicy",
      "Elasticity",
      "Inflation",
    ]);
    expect(out[0].mastery).toBe("weak");
  });

  it("falls back to the subject chip when there is no history", () => {
    expect(suggestedTopics([], "DSE Econ").map((t) => t.tag)).toEqual(["DSE Econ"]);
    expect(suggestedTopics([], null)).toEqual([]);
  });

  it("dedupes case-insensitively and never exceeds max", () => {
    const out = suggestedTopics(
      [
        { tag: "Elasticity", mastery: null },
        { tag: "elasticity", mastery: null },
        { tag: "#MarketStructure", mastery: "weak" as const },
        { tag: "Inflation", mastery: null },
        { tag: "FiscalPolicy", mastery: null },
      ],
      "Economics",
      3,
    );
    expect(out.map((t) => t.tag)).toEqual(["MarketStructure", "Elasticity", "Inflation"]);
  });

  it("strips display '#' chrome from tags", () => {
    const out = suggestedTopics([{ tag: "#Tags", mastery: null }], null, 5);
    expect(out[0].tag).toBe("Tags");
  });
});
