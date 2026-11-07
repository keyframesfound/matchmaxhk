import { describe, expect, it } from "vitest";

import {
  joinAvailParam,
  matchCaseAvailability,
  matchTutorAvailability,
  parseAvailBands,
  parseAvailDays,
} from "@/features/tutors/availability-filter";

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
