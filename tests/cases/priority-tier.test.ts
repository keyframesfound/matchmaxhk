import { describe, expect, it } from "vitest";

import {
  DESK_ACTIVE_TIERS,
  DESK_HOLD_TIERS,
  PRIORITY_TIERS,
  deskBucketForTier,
  isValidPriorityTier,
  normalizePriorityTier,
  tiersForDesk,
} from "../../src/features/cases/priority-tier";

/**
 * Issue #438 — manual P1–P4 triage desk, pure tier → desk-bucket logic.
 * CEO lock: Active Desk = UNASSIGNED + P1 + P2, Hold/Review = P3 + P4,
 * priority is set by a human dropdown only.
 */
describe("priority tier vocabulary", () => {
  it("exposes exactly the DB CHECK vocabulary", () => {
    expect(PRIORITY_TIERS).toEqual(["UNASSIGNED", "P1", "P2", "P3", "P4"]);
  });

  it("accepts only exact stored values — the DB CHECK is case-sensitive", () => {
    expect(isValidPriorityTier("P1")).toBe(true);
    expect(isValidPriorityTier("UNASSIGNED")).toBe(true);
    expect(isValidPriorityTier("p1")).toBe(false);
    expect(isValidPriorityTier("P5")).toBe(false);
    expect(isValidPriorityTier("")).toBe(false);
    expect(isValidPriorityTier(null)).toBe(false);
    expect(isValidPriorityTier(undefined)).toBe(false);
    expect(isValidPriorityTier(1)).toBe(false);
  });
});

describe("normalizePriorityTier", () => {
  it("passes valid tiers through untouched", () => {
    for (const tier of PRIORITY_TIERS) {
      expect(normalizePriorityTier(tier)).toBe(tier);
    }
  });

  it("lands junk and pre-migration rows on UNASSIGNED (desk default)", () => {
    expect(normalizePriorityTier(null)).toBe("UNASSIGNED");
    expect(normalizePriorityTier(undefined)).toBe("UNASSIGNED");
    expect(normalizePriorityTier("")).toBe("UNASSIGNED");
    expect(normalizePriorityTier("p2")).toBe("UNASSIGNED");
    expect(normalizePriorityTier("HOLD")).toBe("UNASSIGNED");
    expect(normalizePriorityTier(42)).toBe("UNASSIGNED");
  });
});

describe("deskBucketForTier — tier → active|hold bucket", () => {
  it("Active Desk = UNASSIGNED + P1 + P2", () => {
    expect(DESK_ACTIVE_TIERS).toEqual(["UNASSIGNED", "P1", "P2"]);
    expect(deskBucketForTier("UNASSIGNED")).toBe("active");
    expect(deskBucketForTier("P1")).toBe("active");
    expect(deskBucketForTier("P2")).toBe("active");
  });

  it("Hold/Review = P3 + P4 only", () => {
    expect(DESK_HOLD_TIERS).toEqual(["P3", "P4"]);
    expect(deskBucketForTier("P3")).toBe("hold");
    expect(deskBucketForTier("P4")).toBe("hold");
  });

  it("Active Desk EXCLUDES P3 and P4", () => {
    expect(DESK_ACTIVE_TIERS).not.toContain("P3");
    expect(DESK_ACTIVE_TIERS).not.toContain("P4");
  });

  it("junk/pre-migration rows stay on Active, never vanish", () => {
    expect(deskBucketForTier(null)).toBe("active");
    expect(deskBucketForTier(undefined)).toBe("active");
    expect(deskBucketForTier("junk")).toBe("active");
  });

  it("tiersForDesk returns the dropdown slice per bucket", () => {
    expect(tiersForDesk("active")).toEqual(["UNASSIGNED", "P1", "P2"]);
    expect(tiersForDesk("hold")).toEqual(["P3", "P4"]);
  });
});
