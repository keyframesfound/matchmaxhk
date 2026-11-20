import { describe, expect, it } from "vitest";

import {
  INTRO_BLOCK_MESSAGES,
  isStrikeCategory,
  strikeLadder,
} from "../../src/features/trust/strike-ladder";

const now = new Date("2026-11-20T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("#782 AC-703-3 strike ladder (CEO 2026-11-20)", () => {
  it("1 strike is a warning only", () => {
    expect(strikeLadder([daysAgo(1)], now)).toMatchObject({
      level: 1,
      matchPaused: false,
      needsFreezeReview: false,
    });
  });

  it("2 strikes pause new matches for 14 days from the 2nd strike", () => {
    const paused = strikeLadder([daysAgo(20), daysAgo(3)], now);
    expect(paused).toMatchObject({ level: 2, matchPaused: true, needsFreezeReview: false });
    expect(paused.pausedUntil).toBe(
      new Date(Date.parse(daysAgo(3)) + 14 * 86_400_000).toISOString(),
    );
    expect(strikeLadder([daysAgo(30), daysAgo(15)], now).matchPaused).toBe(false);
  });

  it("3 strikes stay paused and ask staff for a Freeze decision (never automatic)", () => {
    expect(strikeLadder([daysAgo(90), daysAgo(60), daysAgo(40)], now)).toMatchObject({
      level: 3,
      matchPaused: true,
      pausedUntil: null,
      needsFreezeReview: true,
    });
  });

  it("only no-reply, no-show and bad behaviour count", () => {
    for (const c of ["unresponsive", "no_show", "hostile", "boundary"]) {
      expect(isStrikeCategory(c)).toBe(true);
    }
    expect(isStrikeCategory("safety_concern")).toBe(false);
    expect(isStrikeCategory("other")).toBe(false);
  });

  it("tells staff to get the Safety Declaration first (bilingual)", () => {
    expect(INTRO_BLOCK_MESSAGES.SAFETY_ATTESTATION_REQUIRED).toContain("需先完成安全聲明");
  });
});
