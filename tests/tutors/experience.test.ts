// Issue #387 — Tutor Verified Experience Log pure rules.
import { describe, expect, it } from "vitest";

import {
  canLogOnCase,
  computeExperienceTotals,
  disputeHoursLeft,
  experienceRange,
  formatExperienceHours,
  isExperienceVisible,
  isWithinPresentWindow,
  validateSessionLogInput,
  type ExperienceSession,
} from "../../src/features/tutors/experience";

const TODAY = "2026-10-23";
const NOW = new Date("2026-10-23T06:00:00Z"); // 14:00 HKT

function session(startsAt: string, durationMin: number): ExperienceSession {
  return { startsAt: new Date(startsAt), durationMin };
}

describe("validateSessionLogInput — anti-abuse guardrails", () => {
  it("accepts a normal backdated session within the window", () => {
    expect(
      validateSessionLogInput({ logDate: "2026-10-16", startMinute: 1080, durationMin: 60 }, TODAY),
    ).toBeNull();
    expect(
      validateSessionLogInput({ logDate: TODAY, startMinute: 0, durationMin: 30 }, TODAY),
    ).toBeNull();
  });

  it("rejects future dates (no future dates/times)", () => {
    expect(
      validateSessionLogInput({ logDate: "2026-10-24", startMinute: 1080, durationMin: 60 }, TODAY),
    ).toBe("FUTURE_DATE");
  });

  it("enforces the 7-day backdating window", () => {
    expect(
      validateSessionLogInput({ logDate: "2026-10-15", startMinute: 1080, durationMin: 60 }, TODAY),
    ).toBe("TOO_OLD");
    expect(
      validateSessionLogInput({ logDate: "2026-10-16", startMinute: 1080, durationMin: 60 }, TODAY),
    ).toBeNull();
  });

  it("enforces 0.5h–4.0h in 0.5h steps", () => {
    expect(
      validateSessionLogInput({ logDate: TODAY, startMinute: 1080, durationMin: 240 }, TODAY),
    ).toBeNull();
    expect(
      validateSessionLogInput({ logDate: TODAY, startMinute: 1080, durationMin: 300 }, TODAY),
    ).toBe("BAD_DURATION");
    expect(
      validateSessionLogInput({ logDate: TODAY, startMinute: 1080, durationMin: 45 }, TODAY),
    ).toBe("BAD_DURATION");
    expect(
      validateSessionLogInput({ logDate: TODAY, startMinute: 1080, durationMin: 0 }, TODAY),
    ).toBe("BAD_DURATION");
  });

  it("rejects a session that crosses midnight and bad input shapes", () => {
    expect(
      validateSessionLogInput({ logDate: TODAY, startMinute: 1410, durationMin: 60 }, TODAY),
    ).toBe("BAD_START");
    expect(
      validateSessionLogInput({ logDate: TODAY, startMinute: 1440, durationMin: 60 }, TODAY),
    ).toBe("BAD_START");
    expect(
      validateSessionLogInput({ logDate: "23-10-2026", startMinute: 600, durationMin: 60 }, TODAY),
    ).toBe("BAD_DATE");
    expect(
      validateSessionLogInput({ logDate: TODAY, startMinute: 10.5, durationMin: 60 }, TODAY),
    ).toBe("BAD_START");
  });
});

describe("canLogOnCase — fee gate + 2-dispute lock", () => {
  it("requires the admin fee to be settled (paid OR waived, #425 precedent)", () => {
    expect(canLogOnCase({ feeStatuses: [], disputedCount: 0 })).toBe("FEE_NOT_PAID");
    expect(canLogOnCase({ feeStatuses: ["not_due", "invoiced"], disputedCount: 0 })).toBe(
      "FEE_NOT_PAID",
    );
    expect(canLogOnCase({ feeStatuses: ["paid"], disputedCount: 0 })).toBeNull();
    // A waived fee is an obligation met — the case stays loggable.
    expect(canLogOnCase({ feeStatuses: ["waived"], disputedCount: 0 })).toBeNull();
    expect(canLogOnCase({ feeStatuses: ["invoiced", "waived"], disputedCount: 0 })).toBeNull();
  });

  it("locks logging after 2 disputed logs on the case", () => {
    expect(canLogOnCase({ feeStatuses: ["paid"], disputedCount: 1 })).toBeNull();
    expect(canLogOnCase({ feeStatuses: ["paid"], disputedCount: 2 })).toBe("DISPUTE_LOCK");
    expect(canLogOnCase({ feeStatuses: ["paid"], disputedCount: 5 })).toBe("DISPUTE_LOCK");
  });
});

describe("computeExperienceTotals — counting rules", () => {
  it("counts each session row exactly once — a group session of 5 is ONE lesson", () => {
    // One row per SESSION: there is no student-count input anywhere.
    const totals = computeExperienceTotals([session("2026-09-02T10:00:00Z", 90)]);
    expect(totals.lessons).toBe(1);
    expect(totals.hours).toBe(1.5);
  });

  it("sums intro lessons + verified logs with their scheduled durations", () => {
    const totals = computeExperienceTotals([
      session("2026-08-10T10:00:00Z", 60), // intro lesson 1 (1.0h default)
      session("2026-08-17T10:00:00Z", 90), // intro lesson 2 (1.5h default)
      session("2026-10-01T10:00:00Z", 120),
    ]);
    expect(totals.lessons).toBe(3);
    expect(totals.hours).toBe(4.5);
    expect(totals.firstLessonAt?.toISOString()).toBe("2026-08-10T10:00:00.000Z");
    expect(totals.lastLessonAt?.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  it("is zero-shaped with no sessions (component hides)", () => {
    const totals = computeExperienceTotals([]);
    expect(totals).toEqual({ lessons: 0, hours: 0, firstLessonAt: null, lastLessonAt: null });
    expect(isExperienceVisible(totals)).toBe(false);
  });

  it("is visible from the first verified session", () => {
    expect(
      isExperienceVisible(computeExperienceTotals([session("2026-09-01T10:00:00Z", 60)])),
    ).toBe(true);
  });
});

describe("45-day Present window", () => {
  it("shows Present within 45 days of the last verified lesson", () => {
    const last = new Date("2026-09-20T10:00:00Z"); // 33 days before NOW
    expect(isWithinPresentWindow(last, NOW)).toBe(true);
    const totals = computeExperienceTotals([session("2026-09-20T10:00:00Z", 60)]);
    const range = experienceRange(totals, NOW);
    expect(range.isPresent).toBe(true);
    expect(range.endKey).toBe("2026-09");
  });

  it("falls back to the last lesson month after 45 days", () => {
    const last = new Date("2026-09-01T10:00:00Z"); // 52 days before NOW
    expect(isWithinPresentWindow(last, NOW)).toBe(false);
    const totals = computeExperienceTotals([session("2026-09-01T10:00:00Z", 60)]);
    const range = experienceRange(totals, NOW);
    expect(range.isPresent).toBe(false);
    expect(range.endKey).toBe("2026-09");
    expect(range.startKey).toBe("2026-09");
  });

  it("handles the exact 45-day boundary as Present", () => {
    const boundary = new Date(NOW.getTime() - 45 * 24 * 60 * 60 * 1000);
    expect(isWithinPresentWindow(boundary, NOW)).toBe(true);
    expect(isWithinPresentWindow(new Date(boundary.getTime() - 60_000), NOW)).toBe(false);
  });

  it("returns a null range for an empty history", () => {
    expect(experienceRange(computeExperienceTotals([]), NOW)).toEqual({
      startKey: null,
      endKey: null,
      isPresent: false,
    });
  });
});

describe("display helpers", () => {
  it("formats hours without float artifacts", () => {
    expect(formatExperienceHours(27)).toBe("27");
    expect(formatExperienceHours(27.5)).toBe("27.5");
    expect(formatExperienceHours(0.5 + 0.5 + 0.5)).toBe("1.5");
    expect(formatExperienceHours(1 / 3)).toBe("0.3");
  });

  it("counts down the dispute window (ceil, never negative)", () => {
    const created = new Date("2026-10-23T00:00:00Z");
    expect(disputeHoursLeft(created, created)).toBe(72);
    expect(disputeHoursLeft(created, new Date("2026-10-23T01:30:00Z"))).toBe(71);
    expect(disputeHoursLeft(created, new Date("2026-10-26T00:00:00Z"))).toBe(0);
    expect(disputeHoursLeft(created, new Date("2026-10-30T00:00:00Z"))).toBe(0);
  });
});
