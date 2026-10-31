/**
 * Issue #459 §4.2 / §15.8: hours badges are pure recomputation from ledger
 * sums. Teaching: Rising >= 25h, Azure >= 100h. Learning: Verified MatchMax
 * Scholar >= 10h of the tutor's own verified learning.
 */
import { describe, expect, it } from "vitest";

import {
  AZURE_HOURS,
  RISING_HOURS,
  SCHOLAR_LEARNING_HOURS,
  isVerifiedScholar,
  teachingBadge,
} from "../../src/features/hours/hours";

describe("teachingBadge", () => {
  it("is empty below Rising", () => {
    expect(teachingBadge(0)).toBeNull();
    expect(teachingBadge(RISING_HOURS - 0.5)).toBeNull();
  });

  it("flips to Rising at 25h and Azure at 100h", () => {
    expect(teachingBadge(RISING_HOURS)).toBe("rising");
    expect(teachingBadge(AZURE_HOURS - 0.5)).toBe("rising");
    expect(teachingBadge(AZURE_HOURS)).toBe("azure");
  });
});

describe("isVerifiedScholar", () => {
  it("needs at least 10 verified learning hours", () => {
    expect(isVerifiedScholar(0)).toBe(false);
    expect(isVerifiedScholar(SCHOLAR_LEARNING_HOURS - 0.25)).toBe(false);
    expect(isVerifiedScholar(SCHOLAR_LEARNING_HOURS)).toBe(true);
  });
});
