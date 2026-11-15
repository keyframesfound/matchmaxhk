import { describe, expect, it } from "vitest";

import {
  dateRangeWeekdays,
  isAvailabilityActive,
  isFlexibleSchedule,
  joinAvailParam,
  matchCaseAvailability,
  matchTutorAvailability,
  parseAvailBands,
  parseAvailDate,
  parseAvailDays,
  parseAvailMode,
} from "../../src/features/tutors/availability-filter";

const grid = (overrides: Record<string, string[]>) => ({
  mon: ["u", "u", "u", "u", "u", "u"],
  tue: ["u", "u", "u", "u", "u", "u"],
  ...overrides,
});

describe("#605 availability filter", () => {
  it("parses known days and bands only, in canonical order", () => {
    expect(parseAvailDays("sun,mon,xyz")).toEqual(["mon", "sun"]);
    expect(parseAvailBands("evening||morning")).toEqual(["morning", "evening"]);
    expect(parseAvailDays(3)).toEqual([]);
    expect(joinAvailParam([])).toBeUndefined();
    expect(joinAvailParam(["tue", "wed"])).toBe("tue,wed");
  });

  it("matches when no pick is active", () => {
    expect(matchTutorAvailability(null, { days: [], bands: [] })).toBe("match");
  });

  it("keeps tutors without a grid as unset (shown, ranked last)", () => {
    expect(matchTutorAvailability(null, { days: ["tue"], bands: ["evening"] })).toBe("unset");
    expect(matchTutorAvailability(grid({}), { days: ["tue"], bands: [] })).toBe("unset");
  });

  it("matches an overlapping free or partial cell", () => {
    const tueEvening = grid({ tue: ["u", "u", "u", "u", "p", "u"] });
    expect(matchTutorAvailability(tueEvening, { days: ["tue"], bands: ["evening"] })).toBe("match");
    expect(matchTutorAvailability(tueEvening, { days: [], bands: ["evening"] })).toBe("match");
    expect(matchTutorAvailability(tueEvening, { days: ["tue"], bands: [] })).toBe("match");
  });

  it("drops a set grid with no overlap", () => {
    const monMorning = grid({ mon: ["a", "u", "u", "u", "u", "u"] });
    expect(matchTutorAvailability(monMorning, { days: ["tue"], bands: ["evening"] })).toBe("miss");
    expect(matchTutorAvailability(monMorning, { days: ["mon"], bands: ["evening"] })).toBe("miss");
  });
});

describe("#605 case availability", () => {
  const pick = { days: ["tue" as const], bands: ["evening" as const] };
  it("flexible cases always match", () => {
    expect(matchCaseAvailability("flexible", [], pick)).toBe("match");
  });
  it("legacy cases without a mode are unset", () => {
    expect(matchCaseAvailability(null, [], pick)).toBe("unset");
  });
  it("specific cases need an overlapping slot", () => {
    expect(matchCaseAvailability("specific", [{ day: "tue", period: "evening" }], pick)).toBe(
      "match",
    );
    expect(matchCaseAvailability("specific", [{ day: "mon", period: "evening" }], pick)).toBe(
      "miss",
    );
    expect(
      matchCaseAvailability("specific", [{ day: "mon", period: "evening" }], {
        days: [],
        bands: ["evening"],
      }),
    ).toBe("match");
  });
});

describe("#771 §2.2 schedule mode + date range", () => {
  const tueEvening = { tue: ["u", "u", "u", "u", "a", "u"] };

  it("parses only the locked schedule modes", () => {
    expect(parseAvailMode("specific")).toBe("specific");
    expect(parseAvailMode("Flexible")).toBe("flexible");
    expect(parseAvailMode("any")).toBeUndefined();
    expect(parseAvailMode(null)).toBeUndefined();
  });

  it("parses strict ISO dates and drops impossible ones", () => {
    expect(parseAvailDate("2026-11-17")).toBe("2026-11-17");
    expect(parseAvailDate("2026-02-31")).toBeUndefined();
    expect(parseAvailDate("17/11/2026")).toBeUndefined();
    expect(parseAvailDate(20261117)).toBeUndefined();
  });

  it("expands a date range to the weekdays it covers", () => {
    expect(dateRangeWeekdays("2026-11-17", "2026-11-17")).toEqual(["tue"]);
    expect(dateRangeWeekdays("2026-11-16", "2026-11-22")).toEqual([
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ]);
    // Inverted or half-filled ranges are ignored, never a hide.
    expect(dateRangeWeekdays("2026-11-22", "2026-11-16")).toEqual([]);
    expect(dateRangeWeekdays("2026-11-16", undefined)).toEqual([]);
  });

  it("keeps a flexible / unset tutor findable under a slot filter (AC11)", () => {
    const slotPick = { days: ["tue" as const], bands: ["evening" as const] };
    expect(isFlexibleSchedule(null)).toBe(true);
    expect(isFlexibleSchedule(grid({}))).toBe(true);
    expect(isFlexibleSchedule(grid(tueEvening))).toBe(false);
    // Empty grid = "no fixed slots": shown, ranked last, never hidden.
    expect(matchTutorAvailability(null, slotPick)).toBe("unset");
    expect(matchTutorAvailability(grid({}), slotPick)).toBe("unset");
  });

  it("never narrows when the parent is flexible", () => {
    const pick = { days: ["tue" as const], bands: ["evening" as const], mode: "flexible" as const };
    expect(isAvailabilityActive(pick)).toBe(false);
    expect(matchTutorAvailability(grid({ mon: ["a", "u", "u", "u", "u", "u"] }), pick)).toBe(
      "match",
    );
  });

  it("narrows by the weekdays inside an HKT date range", () => {
    const tuesday = {
      days: [],
      bands: ["evening" as const],
      dateFrom: "2026-11-17",
      dateTo: "2026-11-17",
    };
    const thursday = {
      days: [],
      bands: ["evening" as const],
      dateFrom: "2026-11-19",
      dateTo: "2026-11-19",
    };
    expect(matchTutorAvailability(grid(tueEvening), tuesday)).toBe("match");
    expect(matchTutorAvailability(grid(tueEvening), thursday)).toBe("miss");
  });

  it("treats a day pick that misses the range as soft, not a hide", () => {
    const pick = {
      days: ["mon" as const],
      bands: [],
      mode: "specific" as const,
      dateFrom: "2026-11-17",
      dateTo: "2026-11-17",
    };
    expect(matchTutorAvailability(grid(tueEvening), pick)).toBe("unset");
  });

  it("counts mode and dates as active picks", () => {
    expect(isAvailabilityActive({ days: [], bands: [] })).toBe(false);
    expect(
      isAvailabilityActive({ days: [], bands: [], dateFrom: "2026-11-17", dateTo: "2026-11-17" }),
    ).toBe(true);
    expect(isAvailabilityActive({ days: [], bands: [], mode: "specific" })).toBe(false);
  });
});
