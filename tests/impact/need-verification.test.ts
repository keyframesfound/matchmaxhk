import { describe, expect, it } from "vitest";

import {
  VERIFICATION_MONTHS,
  badgeKeyFor,
  blocksNewRequest,
  isVerifiedNeed,
  needState,
  verifiedUntilFrom,
  type VerificationRow,
} from "../../src/features/impact/need-verification";

/** Issue #794 §2.3: two-tier pro-bono need verification. */
const NOW = new Date("2026-11-22T12:00:00.000Z");
const FUTURE = "2027-06-01T00:00:00.000Z";
const PAST = "2026-01-01T00:00:00.000Z";

function row(over: Partial<NonNullable<VerificationRow>> = {}): VerificationRow {
  return { status: "verified", verified_until: FUTURE, ...over };
}

describe("needState", () => {
  it("is self-declared until anything is submitted", () => {
    expect(needState(null, NOW)).toBe("self_declared");
    expect(isVerifiedNeed(null, NOW)).toBe(false);
  });

  it("reports pending while the desk is reviewing", () => {
    expect(needState(row({ status: "pending", verified_until: null }), NOW)).toBe("pending");
  });

  it("reports verified only while the 12-month pass is live", () => {
    expect(needState(row(), NOW)).toBe("verified");
    expect(isVerifiedNeed(row(), NOW)).toBe(true);
  });

  it("treats a lapsed pass as expired, never as verified", () => {
    expect(needState(row({ verified_until: PAST }), NOW)).toBe("expired");
    expect(isVerifiedNeed(row({ verified_until: PAST }), NOW)).toBe(false);
  });

  it("treats a verified row with no expiry as unusable", () => {
    expect(needState(row({ verified_until: null }), NOW)).toBe("expired");
  });

  it("keeps a rejection distinct from self-declared so the copy can say why", () => {
    expect(needState(row({ status: "rejected", verified_until: null }), NOW)).toBe("rejected");
  });

  it("treats an explicit expired row as expired", () => {
    expect(needState(row({ status: "expired", verified_until: PAST }), NOW)).toBe("expired");
  });
});

describe("badgeKeyFor", () => {
  it("gives the tutor one of three private badges, never a student-facing one", () => {
    expect(badgeKeyFor("verified")).toBe("need_verification.badge_verified");
    expect(badgeKeyFor("pending")).toBe("need_verification.badge_pending");
    for (const state of ["self_declared", "rejected", "expired"] as const) {
      expect(badgeKeyFor(state)).toBe("need_verification.badge_self_declared");
    }
  });
});

describe("verifiedUntilFrom", () => {
  it("adds twelve months", () => {
    const until = new Date(verifiedUntilFrom(new Date("2026-11-22T00:00:00.000Z")));
    expect(VERIFICATION_MONTHS).toBe(12);
    expect(until.getUTCFullYear()).toBe(2027);
    expect(until.getUTCMonth()).toBe(10);
  });
});

describe("blocksNewRequest", () => {
  it("lets a self-declared or expired family ask again, but not a live pass", () => {
    expect(blocksNewRequest("pending")).toBe(true);
    expect(blocksNewRequest("verified")).toBe(true);
    expect(blocksNewRequest("self_declared")).toBe(false);
    expect(blocksNewRequest("expired")).toBe(false);
    expect(blocksNewRequest("rejected")).toBe(false);
  });
});
