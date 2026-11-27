import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  STRONG_MATCH_SCORE,
  WHY_LABELS,
  WHY_TOKENS,
  isStrongMatch,
  pinAvailability,
  sortPinnedFirst,
  strongMatchCount,
  whyLabels,
} from "../../src/features/cases/shortlist";

describe("#816 §2.7 shortlist why labels", () => {
  it("labels every token the SQL can emit, and never echoes the token", () => {
    for (const token of WHY_TOKENS) {
      const label = WHY_LABELS[token];
      expect(label, token).toBeTruthy();
      expect(label, token).not.toBe(token);
    }
  });

  it("keeps WHY_LABELS in sync with the migration's token list", () => {
    const sql = readFileSync(
      new URL(
        "../../supabase/migrations/20261127130000_issue_816_shortlist_why.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const start = sql.indexOf("ARRAY_REMOVE(ARRAY[");
    const end = sql.indexOf("], NULL)::text[] AS why");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const emitted = [...sql.slice(start, end).matchAll(/THEN '([a-z_]+)' END/g)].map(
      (match) => match[1],
    );
    expect(emitted).toEqual([...WHY_TOKENS]);
    expect(Object.keys(WHY_LABELS).sort()).toEqual([...WHY_TOKENS].sort());
  });

  it("maps tokens in order and drops unknown ones instead of rendering them raw", () => {
    expect(whyLabels(["subject", "rate_full", "mode"])).toEqual([
      "Same subject",
      "Rate fit",
      "Mode fit",
    ]);
    expect(whyLabels(["subject", "not_a_real_token", "easy_desk"])).toEqual([
      "Same subject",
      "Easy desk",
    ]);
    expect(whyLabels([])).toEqual([]);
    expect(whyLabels(null)).toEqual([]);
    expect(whyLabels(undefined)).toEqual([]);
  });
});

describe("#816 §2.7 strong-match counting", () => {
  it("treats 40 as the bar", () => {
    expect(isStrongMatch(STRONG_MATCH_SCORE)).toBe(true);
    expect(isStrongMatch(STRONG_MATCH_SCORE - 0.1)).toBe(false);
    expect(isStrongMatch(Number.NaN)).toBe(false);
  });

  it("counts rows at or above 40 and ignores the rest", () => {
    const rows = [{ score: 87.5 }, { score: 40 }, { score: 39.9 }, { score: 0 }, { score: -20 }];
    expect(strongMatchCount(rows)).toBe(2);
    expect(strongMatchCount([])).toBe(0);
  });
});

describe("#816 §2.7 deploy-order pin availability", () => {
  it("hides the controls and reports no pin when the column is not deployed", () => {
    expect(pinAvailability({ pinnedTutorId: null, available: false })).toEqual({
      pinnedTutorId: null,
      showControls: false,
    });
    // Even a stale id must not render or be actionable when the read was unavailable.
    expect(pinAvailability({ pinnedTutorId: "t1", available: false })).toEqual({
      pinnedTutorId: null,
      showControls: false,
    });
    expect(pinAvailability(null)).toEqual({ pinnedTutorId: null, showControls: false });
    expect(pinAvailability(undefined)).toEqual({ pinnedTutorId: null, showControls: false });
  });

  it("shows the controls and the pin once the column exists", () => {
    expect(pinAvailability({ pinnedTutorId: "t1", available: true })).toEqual({
      pinnedTutorId: "t1",
      showControls: true,
    });
    expect(pinAvailability({ pinnedTutorId: null, available: true })).toEqual({
      pinnedTutorId: null,
      showControls: true,
    });
  });
});

describe("#816 §2.7 pinned-first ordering", () => {
  const rows = [
    { id: "a", score: 90 },
    { id: "b", score: 80 },
    { id: "c", score: 70 },
  ];

  it("moves the pinned row first and keeps the rest in RPC order", () => {
    expect(sortPinnedFirst(rows, "c").map((row) => row.id)).toEqual(["c", "a", "b"]);
    expect(sortPinnedFirst(rows, "b").map((row) => row.id)).toEqual(["b", "a", "c"]);
  });

  it("leaves the order alone when there is no pin or the pin is absent", () => {
    expect(sortPinnedFirst(rows, null).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(sortPinnedFirst(rows, undefined).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(sortPinnedFirst(rows, "outside-top-8").map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input", () => {
    const input = [...rows];
    sortPinnedFirst(input, "c");
    expect(input.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});
