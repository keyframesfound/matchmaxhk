import { describe, expect, it } from "vitest";

import { describeCohortSessions } from "../../src/features/cases/group-cohorts";
import {
  emptyHourlyOpenHours,
  type HourlyOpenHours,
} from "../../src/features/tutors/availability-grid-model";

/** Stand-in translator: day keys resolve to their short English label. */
const t = (key: string) => key.replace("profile.grid_day_", "");

function grid(partial: Partial<Record<keyof HourlyOpenHours, number[]>>): HourlyOpenHours {
  return { ...emptyHourlyOpenHours(), ...partial } as HourlyOpenHours;
}

describe("describeCohortSessions (#768 cohort display)", () => {
  it("returns an empty string for an empty grid", () => {
    expect(describeCohortSessions(emptyHourlyOpenHours(), t)).toBe("");
  });

  it("renders a single hour as one hour-long range", () => {
    expect(describeCohortSessions(grid({ mon: [17] }), t)).toBe("mon 17:00 – 18:00");
  });

  it("merges contiguous hours into one range", () => {
    expect(describeCohortSessions(grid({ mon: [17, 18] }), t)).toBe("mon 17:00 – 19:00");
    expect(describeCohortSessions(grid({ mon: [17, 18, 19, 20] }), t)).toBe("mon 17:00 – 21:00");
  });

  it("keeps a gap as two ranges on the same day", () => {
    expect(describeCohortSessions(grid({ mon: [10, 17, 18] }), t)).toBe(
      "mon 10:00 – 11:00 · mon 17:00 – 19:00",
    );
  });

  it("dedupes and sorts unsorted input", () => {
    expect(describeCohortSessions(grid({ wed: [18, 17, 17] }), t)).toBe("wed 17:00 – 19:00");
  });

  it("orders days mon..sun and separates them without a trailing dot", () => {
    const out = describeCohortSessions(grid({ sat: [9], mon: [17], wed: [17] }), t);
    expect(out).toBe("mon 17:00 – 18:00 · wed 17:00 – 18:00 · sat 09:00 – 10:00");
    expect(out.endsWith("·")).toBe(false);
  });

  it("renders the last hour of the grid correctly", () => {
    expect(describeCohortSessions(grid({ fri: [23] }), t)).toBe("fri 23:00 – 24:00");
  });
});
