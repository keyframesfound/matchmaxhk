import { describe, expect, it } from "vitest";

import { buildActiveFilterChips } from "@/features/tutors/active-filter-chips";

const t = (key: string, options?: Record<string, unknown>) =>
  key === "explore_search.list_sep"
    ? ", "
    : options?.value !== undefined
      ? `${key}(${String(options.value)})`
      : key;

describe("#605 active filter ribbon chips", () => {
  it("is empty with no constraints", () => {
    expect(buildActiveFilterChips({}, t)).toEqual([]);
  });

  it("gives each subject its own chip that removes only that subject", () => {
    const chips = buildActiveFilterChips(
      { category: "DSE", subject: "Chemistry", subjects_extra: "Biology||Physics" },
      t,
    );
    const bio = chips.find((chip) => chip.key === "subject:Biology");
    expect(bio?.label).toBe("DSE: Biology");
    expect(bio?.patch).toEqual({ subject: "Chemistry", subjects_extra: "Physics" });
    const chem = chips.find((chip) => chip.key === "subject:Chemistry");
    expect(chem?.patch).toEqual({ subject: "Biology", subjects_extra: "Physics" });
  });

  it("splits status picks and clears the station with in-person mode", () => {
    const chips = buildActiveFilterChips(
      {
        status: "part_time",
        statuses_extra: "full_time",
        mode: "in_person",
        station: "Kowloon Tong",
      },
      t,
    );
    expect(chips.map((chip) => chip.key)).toEqual(["status:part_time", "status:full_time", "mode"]);
    expect(chips[0].patch).toEqual({ status: "full_time", statuses_extra: undefined });
    expect(chips[2].label).toBe("search_ui.mode_in_person: Kowloon Tong");
    expect(chips[2].patch).toEqual({ mode: undefined, station: undefined });
  });

  it("summarises availability and price in one chip each", () => {
    const chips = buildActiveFilterChips(
      { avail_days: "tue,thu", avail_bands: "evening", min_price: 200, max_price: 400 },
      t,
    );
    expect(chips.find((chip) => chip.key === "price")?.label).toBe("$200–$400");
    expect(chips.find((chip) => chip.key === "availability")?.label).toBe(
      "explore_search.avail_chip(explore_search.day_tue, explore_search.day_thu · explore_search.band_evening)",
    );
  });
});
