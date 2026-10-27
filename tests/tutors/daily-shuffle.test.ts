import { describe, expect, it } from "vitest";

import { dailyTieBreakSort, dailyTieKey, hktDate } from "../../src/features/tutors/daily-shuffle";

/**
 * Issue #485 Phase B — daily tie shuffle primitives as pure functions.
 * Contract: the HKT date flips at Hong Kong local midnight (UTC+8), never
 * the runtime's UTC date; the tie key is deterministic per (id, day) and
 * changes across days; the sort re-orders ONLY exact rank ties (never
 * different engagement tiers), ascending hash, no input mutation.
 */

describe("hktDate (#485 Phase B)", () => {
  it("returns the Asia/Hong_Kong calendar date, not the UTC date", () => {
    // 2026-10-27 15:59 UTC == 23:59 HKT same day; 16:00 UTC == 00:00 HKT
    // next day. A UTC-date implementation gets both wrong.
    expect(hktDate(new Date("2026-10-27T15:59:00Z"))).toBe("2026-10-27");
    expect(hktDate(new Date("2026-10-27T16:00:00Z"))).toBe("2026-10-28");
  });

  it("formats as ISO YYYY-MM-DD for a mid-day instant", () => {
    expect(hktDate(new Date("2026-10-27T03:45:00Z"))).toBe("2026-10-27");
  });

  it("rolls over the year on the UTC+8 boundary", () => {
    expect(hktDate(new Date("2026-12-31T16:30:00Z"))).toBe("2027-01-01");
  });
});

describe("dailyTieKey (#485 Phase B)", () => {
  it("is deterministic for the same id + day", () => {
    expect(dailyTieKey("MM-T135", "2026-10-27")).toBe(dailyTieKey("MM-T135", "2026-10-27"));
  });

  it("changes when the HKT day changes", () => {
    expect(dailyTieKey("MM-T135", "2026-10-27")).not.toBe(dailyTieKey("MM-T135", "2026-10-28"));
  });

  it("differs between tutors on the same day", () => {
    expect(dailyTieKey("MM-T135", "2026-10-27")).not.toBe(dailyTieKey("MM-T136", "2026-10-27"));
  });

  it("stays inside the uint32 range", () => {
    const key = dailyTieKey("MM-T126", "2026-10-27");
    expect(key).toBeGreaterThanOrEqual(0);
    expect(key).toBeLessThanOrEqual(0xffffffff);
  });

  it("does not collide across (id, day) boundary ambiguity", () => {
    // The "#" separator keeps ("ab", "c") and ("a", "bc") distinct inputs.
    expect(dailyTieKey("ab", "c")).not.toBe(dailyTieKey("a", "bc"));
  });
});

describe("dailyTieBreakSort (#485 Phase B)", () => {
  const day = "2026-10-27";
  const byScoreDesc = (a: { score: number }, b: { score: number }) => b.score - a.score;
  const make = (scores: number[], ids: string[]) =>
    scores.map((score, i) => ({ score, id: ids[i] }));

  it("preserves primary rank order — never scrambles different tiers", () => {
    const items = make([30, 20, 10], ["a", "b", "c"]);
    const sorted = dailyTieBreakSort(items, byScoreDesc, (x) => x.id, day);
    expect(sorted.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks exact ties by the daily hash ascending, deterministically", () => {
    const build = () => make([10, 10, 10], ["t1", "t2", "t3"]);
    const sorted = dailyTieBreakSort(build(), byScoreDesc, (x) => x.id, day);
    const keys = sorted.map((x) => dailyTieKey(x.id, day));
    expect([...keys].sort((a, b) => a - b)).toEqual(keys);
    // Same date → identical order on reload.
    expect(dailyTieBreakSort(build(), byScoreDesc, (x) => x.id, day)).toEqual(sorted);
  });

  it("rotates a tie group when the day changes, keeping its members", () => {
    const build = () => make([10, 10, 10, 10], ["t1", "t2", "t3", "t4"]);
    const orderA = dailyTieBreakSort(build(), byScoreDesc, (x) => x.id, "2026-10-27").map(
      (x) => x.id,
    );
    const orderB = dailyTieBreakSort(build(), byScoreDesc, (x) => x.id, "2026-10-28").map(
      (x) => x.id,
    );
    expect(orderB).not.toEqual(orderA);
    expect([...orderB].sort()).toEqual([...orderA].sort());
  });

  it("shuffles a fully unranked list (curriculum-rail mode, primary () => 0)", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const items = ids.map((id) => ({ id }));
    const sorted = dailyTieBreakSort(
      items,
      () => 0,
      (x) => x.id,
      day,
    );
    const expected = [...ids].sort((a, b) => dailyTieKey(a, day) - dailyTieKey(b, day));
    expect(sorted.map((x) => x.id)).toEqual(expected);
  });

  it("keeps ties ordered by hash even when they sit next to different ranks", () => {
    // Two distinct tiers, two members per tier: within each tier the hash
    // decides, across tiers the score still dominates.
    const items = make([20, 10, 20, 10], ["hi1", "lo1", "hi2", "lo2"]);
    const sorted = dailyTieBreakSort(items, byScoreDesc, (x) => x.id, day);
    expect(sorted.slice(0, 2).every((x) => x.score === 20)).toBe(true);
    expect(sorted.slice(2).every((x) => x.score === 10)).toBe(true);
    expect(sorted.slice(0, 2).map((x) => dailyTieKey(x.id, day))).toEqual(
      [...sorted.slice(0, 2)].map((x) => dailyTieKey(x.id, day)).sort((a, b) => a - b),
    );
  });

  it("does not mutate the input array", () => {
    const items = make([10, 10], ["x", "y"]);
    const before = items.map((x) => x.id);
    dailyTieBreakSort(items, byScoreDesc, (x) => x.id, day);
    expect(items.map((x) => x.id)).toEqual(before);
  });
});
