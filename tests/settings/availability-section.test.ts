import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  availabilityCapacityDraft,
  availabilityStartDraft,
} from "../../src/features/settings/sections/availability-section";

/**
 * Settings hydration guards. Saving the start-date form invalidates the same
 * query the capacity form reads (and the router's staleTime lets a focus refetch
 * do it too), so each group may only re-hydrate while it is not dirty. The draft
 * mappers are the pure half of that; the guard wiring is asserted from source.
 */

const emptyRow = {
  start_immediately: null,
  earliest_start_date: null,
  remaining_student_slots: null,
  is_accepting_students: null,
  preferred_time_windows: null,
};

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("availabilityStartDraft", () => {
  it("treats a null start_immediately as 'immediately' and a null date as blank", () => {
    expect(availabilityStartDraft(emptyRow)).toEqual({
      startImmediately: true,
      startDate: "",
    });
  });

  it("keeps an explicit pre-booking date", () => {
    expect(
      availabilityStartDraft({
        ...emptyRow,
        start_immediately: false,
        earliest_start_date: "2026-12-01",
      }),
    ).toEqual({ startImmediately: false, startDate: "2026-12-01" });
  });
});

describe("availabilityCapacityDraft", () => {
  it("defaults to accepting with two open slots on a pre-migration row", () => {
    expect(availabilityCapacityDraft(emptyRow)).toEqual({
      acceptingStudents: true,
      openSlots: 2,
      timeWindows: [],
    });
  });

  it("keeps a saved zero slot count instead of falling back to 2", () => {
    expect(
      availabilityCapacityDraft({
        ...emptyRow,
        remaining_student_slots: 0,
        is_accepting_students: false,
      }),
    ).toMatchObject({ acceptingStudents: false, openSlots: 0 });
  });

  it("drops time windows the picker no longer offers", () => {
    expect(
      availabilityCapacityDraft({
        ...emptyRow,
        preferred_time_windows: ["weekday_evening", "not_a_window"],
      }).timeWindows,
    ).toEqual(["weekday_evening"]);
  });
});

describe("hydration guard wiring", () => {
  it("skips re-hydrating the start-date group while it is dirty", () => {
    const section = source("../../src/features/settings/sections/availability-section.tsx");
    expect(section).toContain("if (!row || dirty) return;");
  });

  it("skips re-hydrating the capacity group while it is dirty", () => {
    const section = source("../../src/features/settings/sections/availability-section.tsx");
    expect(section).toContain("if (!row || capacityDirty) return;");
  });

  it("re-syncs the mounted cohort dialog whenever it opens", () => {
    const section = source("../../src/features/settings/sections/group-classes-section.tsx");
    expect(section).toContain("if (open) setForm(initial);");
  });
});
