import { describe, expect, it } from "vitest";

import {
  INTRO_WINDOW_DAYS,
  isPastOwnershipWindow,
  outOfWindowWarning,
  ownershipBannerLabel,
  ownershipSnapshot,
  tierFromRetained,
  windowStartFrom,
  type PriorCase,
} from "../../src/features/cases/ownership-window";

const DAY = 24 * 60 * 60 * 1000;
const L1 = "2026-05-01T02:00:00.000Z";
const l1Plus = (days: number) => new Date(Date.parse(L1) + days * DAY);

function prior(firstPaidL1At: string | null, retained: boolean, caseId = "c"): PriorCase {
  return { caseId, firstPaidL1At, retained };
}

describe("windowStartFrom", () => {
  it("is the earliest completed paid L1", () => {
    expect(
      windowStartFrom([
        prior("2026-06-01T00:00:00.000Z", true),
        prior(L1, false),
        prior(null, false),
      ]),
    ).toBe(L1);
  });

  it("is null when no L1 ever completed (pre-L1 rejects open nothing)", () => {
    expect(windowStartFrom([prior(null, false), prior(null, false)])).toBeNull();
    expect(windowStartFrom([])).toBeNull();
  });
});

describe("tierFromRetained", () => {
  it("centre: first case is tier 1, then 2, 3, 4+", () => {
    expect(tierFromRetained("centre", 0)).toBe(1);
    expect(tierFromRetained("centre", 1)).toBe(2);
    expect(tierFromRetained("centre", 2)).toBe(3);
    expect(tierFromRetained("centre", 3)).toBe(4);
    expect(tierFromRetained("centre", 9)).toBe(4);
  });

  it("parent: first case is the primary match, siblings climb after it", () => {
    expect(tierFromRetained("parent", 0)).toBe("primary");
    expect(tierFromRetained("parent", 1)).toBe(1);
    expect(tierFromRetained("parent", 2)).toBe(2);
    expect(tierFromRetained("parent", 5)).toBe(4);
  });
});

describe("ownershipSnapshot", () => {
  it("not started before any paid L1", () => {
    const s = ownershipSnapshot({ kind: "centre", priorCases: [], asOf: new Date(L1) });
    expect(s.state).toBe("not_started");
    expect(s.tier).toBe(1);
    expect(s.daysLeft).toBeNull();
  });

  it("inside the window counts days left and retained cases only", () => {
    const s = ownershipSnapshot({
      kind: "centre",
      priorCases: [prior(L1, true, "a"), prior(l1Plus(10).toISOString(), false, "b")],
      asOf: l1Plus(135),
    });
    expect(s.state).toBe("inside");
    expect(s.daysLeft).toBe(45);
    expect(s.retainedCount).toBe(1);
    expect(s.tier).toBe(2);
  });

  it("Retained-Only: a dropped case does not advance the tier", () => {
    const s = ownershipSnapshot({
      kind: "centre",
      priorCases: [prior(L1, false)],
      asOf: l1Plus(30),
    });
    expect(s.tier).toBe(1);
  });

  it("day 181 closes the window", () => {
    const s = ownershipSnapshot({
      kind: "centre",
      priorCases: [prior(L1, true)],
      asOf: l1Plus(181),
    });
    expect(s.state).toBe("closed");
    expect(s.daysLeft).toBe(0);
  });

  it("day 180 is still inside", () => {
    const s = ownershipSnapshot({
      kind: "centre",
      priorCases: [prior(L1, true)],
      asOf: l1Plus(INTRO_WINDOW_DAYS),
    });
    expect(s.state).toBe("inside");
  });
});

describe("dispatch filter + copy", () => {
  it("isPastOwnershipWindow flags tutors past 180 days", () => {
    expect(isPastOwnershipWindow(L1, l1Plus(181))).toBe(true);
    expect(isPastOwnershipWindow(L1, l1Plus(100))).toBe(false);
    expect(isPastOwnershipWindow(null, l1Plus(500))).toBe(false);
  });

  it("outOfWindowWarning uses the #508 hard-warning text with an HKT date", () => {
    expect(outOfWindowWarning("2026-10-28T20:00:00.000Z")).toBe(
      "Out of Window: this tutor passed the 6-month mark with this centre on 2026-10-29. Route a new tutor to earn a fee, or advise centre to contact them directly.",
    );
  });

  it("banner labels match the #508 §5 examples", () => {
    const inside = ownershipSnapshot({
      kind: "centre",
      priorCases: [prior(L1, true)],
      asOf: l1Plus(135),
    });
    expect(ownershipBannerLabel("centre", inside)).toBe(
      "B2B match: 2nd student · 45 days left in intro window",
    );
    const closed = ownershipSnapshot({
      kind: "parent",
      priorCases: [prior(L1, true)],
      asOf: l1Plus(200),
    });
    expect(ownershipBannerLabel("parent", closed)).toBe("Past intro window: fee $0, tutor-owned");
  });
});
