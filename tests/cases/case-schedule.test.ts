import { describe, expect, it } from "vitest";

import {
  buildWeeklySeries,
  caseCodeFromParam,
  caseTabFromParam,
  chipsByHktDay,
  hktClock,
  nextLessonFor,
  nextLiveStart,
  orderForShift,
  overlappedPrefSlots,
  partitionSeriesClashes,
  scheduleUpdatedCaseIds,
  seriesPrefill,
  shiftedStart,
  targetsForEdit,
  type ScheduleLesson,
} from "../../src/features/cases/case-schedule";

/** Issue #636: thin schedule sync. All wall-clock assertions are HKT. */
const NOW = new Date("2026-11-07T04:00:00Z"); // Sat 7 Nov 12:00 HKT

function lesson(over: Partial<ScheduleLesson> = {}): ScheduleLesson {
  return {
    id: "l1",
    caseId: "c1",
    startsAt: "2026-11-10T09:00:00Z", // Tue 17:00 HKT
    durationMin: 60,
    status: "planned",
    seriesId: null,
    ...over,
  };
}

describe("buildWeeklySeries", () => {
  it("fills the same weekday and HKT time for each week", () => {
    const starts = buildWeeklySeries({
      firstDateKey: "2026-11-10",
      weekdays: [1],
      minuteOfDay: 17 * 60,
      weeks: 3,
      now: NOW,
    });
    expect(starts).toEqual([
      "2026-11-10T09:00:00.000Z",
      "2026-11-17T09:00:00.000Z",
      "2026-11-24T09:00:00.000Z",
    ]);
  });

  it("orders two lessons a week and skips days before the first date", () => {
    const starts = buildWeeklySeries({
      firstDateKey: "2026-11-11", // Wed
      weekdays: [1, 4], // Tue, Fri
      minuteOfDay: 10 * 60,
      weeks: 2,
      now: NOW,
    });
    expect(starts).toEqual([
      "2026-11-13T02:00:00.000Z", // Fri wk1
      "2026-11-17T02:00:00.000Z", // Tue wk2
      "2026-11-20T02:00:00.000Z", // Fri wk2
    ]);
  });

  it("drops past instants and anything beyond the 90-day limit", () => {
    const starts = buildWeeklySeries({
      firstDateKey: "2026-11-03", // Tue, already past
      weekdays: [1],
      minuteOfDay: 17 * 60,
      weeks: 20,
      now: NOW,
    });
    expect(starts[0]).toBe("2026-11-10T09:00:00.000Z");
    const limit = NOW.getTime() + 90 * 24 * 60 * 60 * 1000;
    expect(starts.every((s) => Date.parse(s) <= limit)).toBe(true);
  });

  it("returns nothing without a weekday", () => {
    expect(
      buildWeeklySeries({
        firstDateKey: "2026-11-10",
        weekdays: [],
        minuteOfDay: 600,
        weeks: 2,
        now: NOW,
      }),
    ).toEqual([]);
  });
});

describe("partitionSeriesClashes", () => {
  it("keeps free weeks and lists clashes instead of failing the series", () => {
    const { free, clashes } = partitionSeriesClashes(
      ["2026-11-10T09:00:00.000Z", "2026-11-17T09:00:00.000Z"],
      60,
      true,
      [{ starts_at: "2026-11-17T09:30:00.000Z", duration_min: 60, mode: "online" }],
    );
    expect(free).toEqual(["2026-11-10T09:00:00.000Z"]);
    expect(clashes).toEqual(["2026-11-17T09:00:00.000Z"]);
  });

  it("treats a series' own lessons as clashes between each other", () => {
    const { free, clashes } = partitionSeriesClashes(
      ["2026-11-10T09:00:00.000Z", "2026-11-10T09:30:00.000Z"],
      60,
      true,
      [],
    );
    expect(free).toEqual(["2026-11-10T09:00:00.000Z"]);
    expect(clashes).toEqual(["2026-11-10T09:30:00.000Z"]);
  });
});

describe("seriesPrefill", () => {
  it("copies weekday and time from the latest live lesson", () => {
    expect(
      seriesPrefill(
        [lesson({ startsAt: "2026-11-03T09:00:00Z", status: "done", durationMin: 90 })],
        NOW,
      ),
    ).toEqual({ firstDateKey: "2026-11-10", weekday: 1, minuteOfDay: 17 * 60, durationMin: 90 });
  });

  it("returns null when no lesson gives a pattern", () => {
    expect(seriesPrefill([lesson({ status: "cancelled" })], NOW)).toBeNull();
  });
});

describe("targetsForEdit", () => {
  const rows = [
    lesson({ id: "a", seriesId: "s1", startsAt: "2026-11-10T09:00:00Z" }),
    lesson({ id: "b", seriesId: "s1", startsAt: "2026-11-17T09:00:00Z", status: "confirmed" }),
    lesson({ id: "c", seriesId: "s1", startsAt: "2026-10-27T09:00:00Z", status: "done" }),
    lesson({ id: "d", seriesId: "s1", startsAt: "2026-11-03T09:00:00Z" }), // past
    lesson({ id: "e", seriesId: null, startsAt: "2026-11-24T09:00:00Z" }),
    lesson({ id: "f", caseId: "other", seriesId: "s1", startsAt: "2026-12-01T09:00:00Z" }),
  ];

  it("one and selected take only live future lessons on this case", () => {
    expect(targetsForEdit(rows, "c1", ["a"], "one", NOW).map((l) => l.id)).toEqual(["a"]);
    expect(
      targetsForEdit(rows, "c1", ["a", "b", "c", "d", "f"], "selected", NOW).map((l) => l.id),
    ).toEqual(["a", "b"]);
  });

  it("one refuses more than a single id", () => {
    expect(targetsForEdit(rows, "c1", ["a", "b"], "one", NOW)).toEqual([]);
  });

  it("series expands from any member and never touches history", () => {
    expect(targetsForEdit(rows, "c1", ["b"], "series", NOW).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("series on a lesson outside any series is just that lesson", () => {
    expect(targetsForEdit(rows, "c1", ["e"], "series", NOW).map((l) => l.id)).toEqual(["e"]);
  });
});

describe("shiftedStart / orderForShift", () => {
  it("moves the day and sets the HKT time", () => {
    expect(shiftedStart("2026-11-10T09:00:00Z", { dayDelta: 2, minuteOfDay: 10 * 60 })).toBe(
      "2026-11-12T02:00:00.000Z",
    );
  });

  it("keeps the wall clock when no time is given", () => {
    expect(shiftedStart("2026-11-10T09:00:00Z", { dayDelta: -1 })).toBe("2026-11-09T09:00:00.000Z");
  });

  it("uses the HKT day across UTC midnight", () => {
    // 00:30 HKT Tue is 16:30Z Mon; setting 23:00 must stay on the HKT Tuesday.
    expect(shiftedStart("2026-11-09T16:30:00Z", { dayDelta: 0, minuteOfDay: 23 * 60 })).toBe(
      "2026-11-10T15:00:00.000Z",
    );
  });

  it("writes later lessons first when moving later, so a series cannot hit itself", () => {
    const rows = [
      lesson({ id: "a", startsAt: "2026-11-10T09:00:00Z" }),
      lesson({ id: "b", startsAt: "2026-11-17T09:00:00Z" }),
    ];
    expect(orderForShift(rows, 7).map((l) => l.id)).toEqual(["b", "a"]);
    expect(orderForShift(rows, -7).map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("nextLessonFor", () => {
  it("picks the earliest live future lesson of the case", () => {
    const next = nextLessonFor(
      [
        lesson({ id: "late", startsAt: "2026-11-17T09:00:00Z" }),
        lesson({ id: "soon", startsAt: "2026-11-10T09:00:00Z" }),
        lesson({ id: "gone", startsAt: "2026-11-08T09:00:00Z", status: "cancelled" }),
        lesson({ id: "other", caseId: "c2", startsAt: "2026-11-08T09:00:00Z" }),
      ],
      "c1",
      NOW,
    );
    expect(next?.id).toBe("soon");
  });

  it("is null for a flexible case with nothing booked", () => {
    expect(nextLessonFor([], "c1", NOW)).toBeNull();
  });
});

describe("nextLiveStart", () => {
  it("reads raw rows and skips past or cancelled lessons", () => {
    expect(
      nextLiveStart(
        [
          { starts_at: "2026-11-01T09:00:00Z", status: "planned" },
          { starts_at: "2026-11-08T09:00:00Z", status: "cancelled" },
          { starts_at: "2026-11-17T09:00:00Z", status: "confirmed" },
          { starts_at: "2026-11-10T09:00:00Z", status: "planned" },
        ],
        NOW,
      ),
    ).toBe("2026-11-10T09:00:00Z");
    expect(nextLiveStart([], NOW)).toBeNull();
  });
});

describe("chipsByHktDay", () => {
  it("groups by HKT day, keeps only occupied lessons, sorted", () => {
    const map = chipsByHktDay([
      lesson({ id: "b", startsAt: "2026-11-10T11:00:00Z" }),
      lesson({ id: "a", startsAt: "2026-11-10T09:00:00Z", status: "confirmed" }),
      lesson({ id: "x", startsAt: "2026-11-10T01:00:00Z", status: "cancelled" }),
      lesson({ id: "z", startsAt: "2026-11-10T16:30:00Z" }), // 00:30 HKT on the 11th
    ]);
    expect(map.get("2026-11-10")?.map((l) => l.id)).toEqual(["a", "b"]);
    expect(map.get("2026-11-11")?.map((l) => l.id)).toEqual(["z"]);
  });
});

describe("hktClock", () => {
  it("prints Hong Kong time", () => {
    expect(hktClock("2026-11-10T09:00:00Z")).toBe("17:00");
    expect(hktClock("2026-11-09T16:30:00Z")).toBe("00:30");
  });
});

describe("caseCodeFromParam", () => {
  it("accepts the case code with or without a leading hash", () => {
    expect(caseCodeFromParam("MM-2048")).toBe("MM-2048");
    expect(caseCodeFromParam("#MM-2048")).toBe("MM-2048");
    expect(caseCodeFromParam("CR-0004")).toBe("CR-0004");
  });

  it("rejects anything else", () => {
    expect(caseCodeFromParam(undefined)).toBeNull();
    expect(caseCodeFromParam("")).toBeNull();
    expect(caseCodeFromParam("<script>")).toBeNull();
    expect(caseCodeFromParam(42)).toBeNull();
  });
});

describe("caseTabFromParam", () => {
  it("opens homework only when asked and falls back to overview", () => {
    expect(caseTabFromParam("homework")).toBe("homework");
    expect(caseTabFromParam("schedule")).toBe("schedule");
    expect(caseTabFromParam("nope")).toBe("overview");
    expect(caseTabFromParam(undefined)).toBe("overview");
  });
});

describe("Schedule Updated (proposed slots vs occupied lessons)", () => {
  const evening = { day: "tue", period: "evening" } as const;

  it("matches a preferred slot on the lesson's HKT weekday and period", () => {
    expect(overlappedPrefSlots([evening], [lesson({ startsAt: "2026-11-10T10:00:00Z" })])).toEqual([
      evening,
    ]);
    expect(overlappedPrefSlots([evening], [lesson({ startsAt: "2026-11-10T01:00:00Z" })])).toEqual(
      [],
    );
  });

  it("ignores cancelled lessons, so the warning clears once a slot is released", () => {
    expect(
      overlappedPrefSlots(
        [evening],
        [lesson({ startsAt: "2026-11-10T10:00:00Z", status: "cancelled" })],
      ),
    ).toEqual([]);
  });

  it("tags pending cases that shared a now-occupied slot; flexible never tags", () => {
    const ids = scheduleUpdatedCaseIds(
      [
        { caseId: "shared", scheduleMode: "specific", slots: [evening] },
        { caseId: "flex", scheduleMode: "flexible", slots: [evening] },
        { caseId: "free", scheduleMode: "specific", slots: [{ day: "mon", period: "morning" }] },
      ],
      [lesson({ startsAt: "2026-11-10T10:00:00Z" })],
    );
    expect(ids).toEqual(["shared"]);
  });

  it("tags a pending case when another proposal on its slot was released", () => {
    expect(
      scheduleUpdatedCaseIds(
        [{ caseId: "shared", scheduleMode: "specific", slots: [evening] }],
        [],
        [evening],
      ),
    ).toEqual(["shared"]);
  });

  it("survives malformed slot data", () => {
    expect(
      scheduleUpdatedCaseIds(
        [{ caseId: "bad", scheduleMode: "specific", slots: "nope" as unknown as [] }],
        [lesson()],
      ),
    ).toEqual([]);
  });
});
