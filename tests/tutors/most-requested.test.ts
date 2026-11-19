import { describe, expect, it } from "vitest";

import { dailyTieKey } from "../../src/features/tutors/daily-shuffle";
import {
  buildMostRequestedTutorIds,
  emptyRankedEngagement,
  mostRequestedCandidateIds,
} from "../../src/features/tutors/most-requested";
import type { TutorPublicStats } from "../../src/features/tutors/most-requested-stats";
import type { Tutor } from "../../src/features/tutors/queries";

/**
 * Issue #768 Part 2 §3.C/§5 — the home "Most Requested Tutors This Week" rail
 * is a deterministic 50/50 blend: a velocity half (14-day requests/saves,
 * open availability only) and a completeness half (finished profile, zero
 * active cases), rotated by the HKT calendar day. Everything below is pure;
 * the RPC fallback path is asserted as `null` so the caller keeps the pre-#768
 * ranking instead of rendering an empty rail.
 */

// Both days are chosen so the six-id fixture below actually hashes into two
// different orders (2026-10-27 and 2026-10-28 do not).
const DAY_A = "2026-10-27";
const DAY_B = "2026-11-01";

// One available slot is enough to clear the "open availability" check;
// parseAvailabilityGrid treats the omitted days as unavailable.
const OPEN = { mon: ["a", "u", "u", "u", "u", "u"] };
const CLOSED = { mon: ["u", "u", "u", "u", "u", "u"] };

// Mirrors the admin completeness predicate (photo + subject + highlight + rate).
// #768 CEO lock: both halves also require at least one Open hour on the grid.
const COMPLETE = {
  photo_url: "https://cdn.example/photo.jpg",
  subjects: ["Mathematics"],
  card_highlights: ["IB 45"],
  hourly_rate: 600,
  availability_grid: OPEN,
};

const tutor = (id: string, overrides: Partial<Tutor> = {}): Tutor =>
  ({
    id,
    photo_url: null,
    headline: null,
    subjects: [],
    card_highlights: [],
    hourly_rate: 0,
    availability_grid: CLOSED,
    ...overrides,
  }) as unknown as Tutor;

const stats = (
  tutor_id: string,
  overrides: Partial<Omit<TutorPublicStats, "tutor_id">> = {},
): TutorPublicStats => ({
  tutor_id,
  active_cases: 0,
  engagement_count: 0,
  requests_14d: 0,
  saves_14d: 0,
  ...overrides,
});

const orderByDayKey = (ids: readonly string[], day: string): string[] =>
  [...ids].sort((a, b) => dailyTieKey(a, day) - dailyTieKey(b, day) || a.localeCompare(b));

describe("buildMostRequestedTutorIds", () => {
  it("splits an even rail 50/50 with the velocity half first", () => {
    const tutors = [
      tutor("v1", { availability_grid: OPEN }),
      tutor("v2", { availability_grid: OPEN }),
      tutor("v3", { availability_grid: OPEN }),
      tutor("v4", { availability_grid: OPEN }),
      tutor("c1", COMPLETE),
      tutor("c2", COMPLETE),
      tutor("c3", COMPLETE),
      tutor("c4", COMPLETE),
    ];
    const rows = [
      stats("v1", { requests_14d: 4 }),
      stats("v2", { requests_14d: 3 }),
      stats("v3", { requests_14d: 2 }),
      stats("v4", { requests_14d: 1 }),
      stats("c1"),
      stats("c2"),
      stats("c3"),
      stats("c4"),
    ];

    const ids = buildMostRequestedTutorIds({ tutors, stats: rows, railLength: 8, day: DAY_A });

    expect(ids).toEqual([
      "v1",
      "v2",
      "v3",
      "v4",
      ...orderByDayKey(["c1", "c2", "c3", "c4"], DAY_A),
    ]);
  });

  it("gives the odd card to the velocity half", () => {
    const tutors = [
      tutor("v1", { availability_grid: OPEN }),
      tutor("v2", { availability_grid: OPEN }),
      tutor("v3", { availability_grid: OPEN }),
      tutor("v4", { availability_grid: OPEN }),
      tutor("c1", COMPLETE),
      tutor("c2", COMPLETE),
      tutor("c3", COMPLETE),
    ];
    const rows = [
      stats("v1", { requests_14d: 4 }),
      stats("v2", { requests_14d: 3 }),
      stats("v3", { requests_14d: 2 }),
      stats("v4", { requests_14d: 1 }),
      stats("c1"),
      stats("c2"),
      stats("c3"),
    ];

    const ids = buildMostRequestedTutorIds({ tutors, stats: rows, railLength: 7, day: DAY_A });

    expect(ids).toEqual(["v1", "v2", "v3", "v4", ...orderByDayKey(["c1", "c2", "c3"], DAY_A)]);
  });

  it("weights requests 3x saves when ranking the velocity half", () => {
    const tutors = [
      tutor("req2", { availability_grid: OPEN }),
      tutor("req1", { availability_grid: OPEN }),
      tutor("save2", { availability_grid: OPEN }),
    ];
    const rows = [
      stats("req2", { requests_14d: 2 }), // 6
      stats("req1", { requests_14d: 1 }), // 3
      stats("save2", { saves_14d: 2 }), // 2
    ];

    const ids = buildMostRequestedTutorIds({ tutors, stats: rows, railLength: 6, day: DAY_A });

    expect(ids).toEqual(["req2", "req1", "save2"]);
  });

  it("excludes tutors with no open availability from the velocity half", () => {
    const tutors = [
      tutor("hot-but-closed", { availability_grid: CLOSED }),
      tutor("open", { availability_grid: OPEN }),
    ];
    const rows = [
      stats("hot-but-closed", { requests_14d: 14, saves_14d: 9 }),
      stats("open", { requests_14d: 1 }),
    ];

    const ids = buildMostRequestedTutorIds({ tutors, stats: rows, railLength: 2, day: DAY_A });

    expect(ids).toEqual(["open"]);
  });

  it("only admits complete profiles with zero active cases to the completeness half", () => {
    const tutors = [
      // Fills the single velocity slot so the completeness slot is observable.
      tutor("v1", { availability_grid: OPEN }),
      tutor("complete-zero", COMPLETE),
      tutor("complete-busy", COMPLETE),
      tutor("no-photo", { ...COMPLETE, photo_url: null }),
      tutor("no-rate", { ...COMPLETE, hourly_rate: 0 }),
    ];
    const rows = [
      stats("v1", { requests_14d: 5 }),
      stats("complete-zero"),
      stats("complete-busy", { active_cases: 1 }),
      stats("no-photo"),
      stats("no-rate"),
    ];

    const ids = buildMostRequestedTutorIds({ tutors, stats: rows, railLength: 2, day: DAY_A });

    expect(ids).toEqual(["v1", "complete-zero"]);
  });

  it("never fabricates numbers for tutors missing from the stats rows", () => {
    const tutors = [
      tutor("known", { availability_grid: OPEN }),
      tutor("ghost", { availability_grid: OPEN }),
    ];
    const rows = [stats("known", { requests_14d: 1 })];

    const ids = buildMostRequestedTutorIds({ tutors, stats: rows, railLength: 4, day: DAY_A });

    expect(ids).toEqual(["known"]);
    expect(ids).not.toContain("ghost");
  });

  it("lists a tutor qualifying for both halves exactly once", () => {
    const tutors = [
      tutor("dual", { ...COMPLETE, availability_grid: OPEN }),
      tutor("v2", { availability_grid: OPEN }),
      tutor("v3", { availability_grid: OPEN }),
      tutor("c2", COMPLETE),
      tutor("c3", COMPLETE),
    ];
    const rows = [
      stats("dual", { requests_14d: 5 }),
      stats("v2", { requests_14d: 4 }),
      stats("v3", { requests_14d: 3 }),
      stats("c2"),
      stats("c3"),
    ];

    const ids = buildMostRequestedTutorIds({ tutors, stats: rows, railLength: 4, day: DAY_A });

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === "dual")).toHaveLength(1);
  });

  it("returns null so the caller keeps the old ranking when stats are unavailable", () => {
    const tutors = [tutor("v1", { availability_grid: OPEN })];

    expect(buildMostRequestedTutorIds({ tutors, stats: [], railLength: 8, day: DAY_A })).toBeNull();
  });

  it("returns null for a zero-length rail instead of an empty selection", () => {
    const tutors = [tutor("v1", { availability_grid: OPEN })];

    expect(
      buildMostRequestedTutorIds({ tutors, stats: [stats("v1")], railLength: 0, day: DAY_A }),
    ).toBeNull();
  });

  it("rotates the completeness half at HKT midnight, not per reload", () => {
    const ids = ["c1", "c2", "c3", "c4", "c5", "c6"];
    const tutors = ids.map((id) => tutor(id, COMPLETE));
    const rows = ids.map((id) => stats(id));
    const input = { tutors, stats: rows, railLength: 6 };

    const first = buildMostRequestedTutorIds({ ...input, day: DAY_A });
    const again = buildMostRequestedTutorIds({ ...input, day: DAY_A });
    const nextDay = buildMostRequestedTutorIds({ ...input, day: DAY_B });

    expect(first).toEqual(orderByDayKey(ids, DAY_A));
    expect(again).toEqual(first);
    expect(nextDay).toEqual(orderByDayKey(ids, DAY_B));
    expect(nextDay).not.toEqual(first);
  });
});

describe("mostRequestedCandidateIds", () => {
  it("unions tutors and trending candidates, de-duplicated and sorted", () => {
    const tutors = [tutor("b"), tutor("a")];
    const candidates = [{ tutor_id: "c" }, { tutor_id: "a" }];

    expect(mostRequestedCandidateIds(tutors, candidates)).toEqual(["a", "b", "c"]);
  });
});

describe("emptyRankedEngagement", () => {
  it("zeroes every counter so no demand badge is claimed", () => {
    expect(emptyRankedEngagement("t1")).toEqual({
      tutor_id: "t1",
      inquiries_7d: 0,
      views_30d: 0,
      requests_30d: 0,
      saves_total: 0,
      saves_30d: 0,
      base_score: 0,
      popularity_score: 0,
    });
  });
});
