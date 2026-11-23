import { describe, expect, it } from "vitest";

import {
  OVERFLOW_ACTIVE_CAP,
  OVERFLOW_CAP_MESSAGE,
  OVERFLOW_LANES,
  OVERFLOW_TAG,
  canPostOverflow,
  countsAsActiveOverflow,
  isOverflowLane,
  isReferralSlug,
  referralLink,
} from "../../src/features/cases/overflow-lane";

describe("#815 §2.11 overflow lane rules", () => {
  it("exposes the two lanes, the cap and the tag", () => {
    expect(OVERFLOW_LANES).toEqual(["centre_overflow", "parent_referral"]);
    expect(OVERFLOW_ACTIVE_CAP).toBe(3);
    expect(OVERFLOW_TAG).toBe("Overflow B2B");
  });

  describe("canPostOverflow", () => {
    it("allows posting below the cap", () => {
      expect(canPostOverflow(0)).toBe(true);
      expect(canPostOverflow(1)).toBe(true);
      expect(canPostOverflow(2)).toBe(true);
    });

    it("refuses posting at or above the cap", () => {
      expect(canPostOverflow(3)).toBe(false);
      expect(canPostOverflow(4)).toBe(false);
      expect(canPostOverflow(100)).toBe(false);
    });

    it("refuses a non-finite or negative count instead of treating it as empty", () => {
      expect(canPostOverflow(Number.NaN)).toBe(false);
      expect(canPostOverflow(Number.POSITIVE_INFINITY)).toBe(false);
      expect(canPostOverflow(Number.NEGATIVE_INFINITY)).toBe(false);
      expect(canPostOverflow(-1)).toBe(false);
      expect(canPostOverflow(1.5)).toBe(false);
    });

    it("treats the cap as exclusive at the boundary", () => {
      expect(canPostOverflow(OVERFLOW_ACTIVE_CAP - 1)).toBe(true);
      expect(canPostOverflow(OVERFLOW_ACTIVE_CAP)).toBe(false);
    });
  });

  describe("countsAsActiveOverflow", () => {
    it("does not count terminal statuses against the cap", () => {
      for (const status of ["matched", "closed", "rejected", "released"]) {
        expect(countsAsActiveOverflow(status)).toBe(false);
      }
    });

    it("counts in-flight statuses against the cap", () => {
      for (const status of ["new", "contacted", "compliance_hold"]) {
        expect(countsAsActiveOverflow(status)).toBe(true);
      }
    });

    it("counts an unknown status conservatively", () => {
      expect(countsAsActiveOverflow("")).toBe(true);
      expect(countsAsActiveOverflow("some_future_status")).toBe(true);
    });
  });

  describe("isOverflowLane", () => {
    it("accepts the two lanes", () => {
      expect(isOverflowLane("centre_overflow")).toBe(true);
      expect(isOverflowLane("parent_referral")).toBe(true);
    });

    it("rejects anything else", () => {
      expect(isOverflowLane("b2c")).toBe(false);
      expect(isOverflowLane("Centre_Overflow")).toBe(false);
      expect(isOverflowLane("")).toBe(false);
      expect(isOverflowLane(null)).toBe(false);
      expect(isOverflowLane(undefined)).toBe(false);
      expect(isOverflowLane(0)).toBe(false);
      expect(isOverflowLane(["centre_overflow"])).toBe(false);
    });
  });

  describe("isReferralSlug", () => {
    it("accepts a lowercase hyphenated slug and a short one", () => {
      expect(isReferralSlug("beacon-centre")).toBe(true);
      expect(isReferralSlug("a1")).toBe(true);
      expect(isReferralSlug("a")).toBe(true);
    });

    it("rejects malformed slugs", () => {
      expect(isReferralSlug("Beacon-Centre")).toBe(false);
      expect(isReferralSlug("-beacon")).toBe(false);
      expect(isReferralSlug("beacon centre")).toBe(false);
      expect(isReferralSlug("")).toBe(false);
      expect(isReferralSlug("a".repeat(100))).toBe(false);
      expect(isReferralSlug(null)).toBe(false);
      expect(isReferralSlug(42)).toBe(false);
    });

    it("rejects a slug one character past the 80-char limit", () => {
      expect(isReferralSlug("a".repeat(80))).toBe(true);
      expect(isReferralSlug("a".repeat(81))).toBe(false);
    });

    it("rejects a trailing hyphen", () => {
      expect(isReferralSlug("beacon-")).toBe(false);
      expect(isReferralSlug("beacon-centre")).toBe(true);
    });
  });

  describe("referralLink", () => {
    it("builds the lane B public entry point for a plain slug", () => {
      expect(referralLink("a1")).toBe("/case-request?org=a1");
    });

    it("builds the lane B public entry point for a hyphenated slug", () => {
      expect(referralLink("beacon-centre")).toBe("/case-request?org=beacon-centre");
    });

    it("url-encodes anything that is not already slug-safe", () => {
      expect(referralLink("beacon centre&x=1")).toBe("/case-request?org=beacon%20centre%26x%3D1");
    });
  });

  describe("OVERFLOW_CAP_MESSAGE", () => {
    it("is a non-empty sentence naming the cap", () => {
      expect(typeof OVERFLOW_CAP_MESSAGE).toBe("string");
      expect(OVERFLOW_CAP_MESSAGE.length).toBeGreaterThan(0);
      expect(OVERFLOW_CAP_MESSAGE.trim()).toBe(OVERFLOW_CAP_MESSAGE);
      expect(OVERFLOW_CAP_MESSAGE).toContain(String(OVERFLOW_ACTIVE_CAP));
    });
  });
});
