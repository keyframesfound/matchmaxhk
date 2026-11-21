import { describe, expect, it } from "vitest";

import {
  FRESHNESS_REVIEW_DAYS,
  needsFreshnessReview,
} from "../../src/features/tutors/availability-freshness";

const NOW = new Date("2026-11-21T12:00:00+08:00");

describe("availability freshness nudge (#768 CEO lock)", () => {
  it("asks a tutor who has never reviewed the grid", () => {
    expect(needsFreshnessReview(null, NOW)).toBe(true);
    expect(needsFreshnessReview(undefined, NOW)).toBe(true);
    expect(needsFreshnessReview("", NOW)).toBe(true);
    expect(needsFreshnessReview("not-a-date", NOW)).toBe(true);
  });

  it("stays quiet inside the 14-day window", () => {
    expect(needsFreshnessReview("2026-11-20T12:00:00+08:00", NOW)).toBe(false);
    expect(needsFreshnessReview("2026-11-08T12:00:01+08:00", NOW)).toBe(false);
  });

  it("returns exactly on and after the window", () => {
    expect(FRESHNESS_REVIEW_DAYS).toBe(14);
    expect(needsFreshnessReview("2026-11-07T12:00:00+08:00", NOW)).toBe(true);
    expect(needsFreshnessReview("2026-10-01T12:00:00+08:00", NOW)).toBe(true);
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(needsFreshnessReview(new Date("2026-11-19T12:00:00+08:00"), NOW)).toBe(false);
  });
});
