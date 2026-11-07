import { describe, expect, it } from "vitest";

import {
  ALL_SLOT_KEYS,
  activeOpenKeys,
  buildFitSchedule,
  compareFit,
  findClashes,
  fitPercent,
  parentOpenKeys,
  parentTutorFit,
  rankCasesByFit,
  slotKeyOf,
  tutorCaseFit,
  tutorOpenKeys,
  type FitSource,
} from "../../src/features/cases/schedule-fit";

// Thu 5 Nov 2026 10:00 HKT.
const NOW = new Date("2026-11-05T02:00:00.000Z");
// Tue 10 Nov 2026 16:00 HKT.
const TUE_4PM = "2026-11-10T08:00:00.000Z";

const empty: FitSource = {
  lessons: [],
  proposed: [],
  blockedDates: [],
  openWindows: [],
  tutorGrid: null,
};
const lesson = (over: Partial<FitSource["lessons"][number]> = {}) => ({
  caseId: "c1",
  startsAt: TUE_4PM,
  durationMin: 120,
  status: "confirmed",
  subject: "IB Chemistry",
  role: "parent" as const,
  ...over,
});
const noPick = { days: [], bands: [] };
const gridWith = (cells: Record<string, number[]>) =>
  Object.fromEntries(
    Object.entries(cells).map(([day, rows]) => [
      day,
      [0, 1, 2, 3, 4, 5].map((r) => (rows.includes(r) ? "a" : "u")),
    ]),
  );

describe("slotKeyOf", () => {
  it("uses HKT, not UTC, across midnight", () => {
    expect(slotKeyOf("2026-11-09T16:30:00.000Z")).toBe("tue-morning");
    expect(slotKeyOf(TUE_4PM)).toBe("tue-afternoon");
  });
});

describe("fitPercent", () => {
  it("rounds and refuses a fake score with no base", () => {
    expect(fitPercent(1, 3)).toBe(33);
    expect(fitPercent(0, 0)).toBeNull();
  });
});

describe("buildFitSchedule", () => {
  it("keeps only this role's live lessons inside the look-ahead", () => {
    const s = buildFitSchedule(
      {
        ...empty,
        lessons: [
          lesson(),
          lesson({ role: "tutor" }),
          lesson({ status: "cancelled" }),
          lesson({ startsAt: "2026-11-01T08:00:00.000Z" }),
          lesson({ startsAt: "2027-01-05T08:00:00.000Z" }),
        ],
      },
      "parent",
      NOW,
    );
    expect(s.occupied.map((o) => o.key)).toEqual(["tue-afternoon"]);
  });

  it("flexible proposals hold no slot", () => {
    const s = buildFitSchedule(
      {
        ...empty,
        proposed: [
          {
            caseId: "p1",
            subject: "Maths",
            role: "parent",
            scheduleMode: "flexible",
            slots: [{ day: "mon", period: "morning" }],
          },
          {
            caseId: "p2",
            subject: "Physics",
            role: "parent",
            scheduleMode: "specific",
            slots: [{ day: "wed", period: "evening" }],
          },
        ],
      },
      "parent",
      NOW,
    );
    expect(s.proposed).toEqual([{ caseId: "p2", key: "wed-evening", title: "Physics" }]);
  });

  it("blocks a blackout in the coming week only, and only for tutors", () => {
    const source = { ...empty, blockedDates: ["2026-11-09", "2027-02-01", "2026-10-01"] };
    const tutor = buildFitSchedule(source, "tutor", NOW);
    expect([...tutor.blocked].sort()).toEqual(["mon-afternoon", "mon-evening", "mon-morning"]);
    expect(buildFitSchedule(source, "parent", NOW).blocked.size).toBe(0);
  });
});

describe("open windows", () => {
  it("parent cold start has nothing to sync", () => {
    expect(parentOpenKeys(buildFitSchedule(empty, "parent", NOW))).toBeNull();
  });

  it("parent default excludes occupied but keeps proposed open", () => {
    const s = buildFitSchedule(
      {
        ...empty,
        lessons: [lesson()],
        proposed: [
          {
            caseId: "p",
            subject: null,
            role: "parent",
            scheduleMode: "specific",
            slots: [{ day: "wed", period: "evening" }],
          },
        ],
      },
      "parent",
      NOW,
    );
    const open = parentOpenKeys(s)!;
    expect(open.has("tue-afternoon")).toBe(false);
    expect(open.has("wed-evening")).toBe(true);
    expect(open.size).toBe(ALL_SLOT_KEYS.length - 1);
  });

  it("tutor prefers teaching windows (0 = Monday) over the grid", () => {
    const source: FitSource = {
      ...empty,
      openWindows: [{ weekday: 0, startMinute: 17 * 60, endMinute: 19 * 60 }],
      tutorGrid: gridWith({ sun: [0] }),
    };
    const open = tutorOpenKeys(buildFitSchedule(source, "tutor", NOW), source)!;
    expect([...open].sort()).toEqual(["mon-afternoon", "mon-evening"]);
  });

  it("tutor falls back to the grid, minus occupied; no data at all is null", () => {
    const source: FitSource = {
      ...empty,
      lessons: [lesson({ role: "tutor" })],
      tutorGrid: gridWith({ tue: [2, 3], thu: [4] }),
    };
    const open = tutorOpenKeys(buildFitSchedule(source, "tutor", NOW), source)!;
    expect([...open]).toEqual(["thu-evening"]);
    expect(tutorOpenKeys(buildFitSchedule(empty, "tutor", NOW), empty)).toBeNull();
  });

  it("a manual pick narrows the base, and wins when they share nothing", () => {
    const base = new Set(["mon-morning", "tue-morning"]);
    expect([...activeOpenKeys(base, { days: ["mon"], bands: ["morning"] })!]).toEqual([
      "mon-morning",
    ]);
    expect([...activeOpenKeys(base, { days: ["sun"], bands: ["evening"] })!]).toEqual([
      "sun-evening",
    ]);
    expect(activeOpenKeys(null, noPick)).toBeNull();
    expect(activeOpenKeys(null, { days: ["mon"], bands: [] })!.size).toBe(3);
  });
});

describe("the locked formulas", () => {
  it("parent: overlap / parent active units; unset grid is unscored", () => {
    const active = new Set(["mon-morning", "tue-morning", "wed-morning", "thu-morning"]);
    expect(parentTutorFit(active, gridWith({ mon: [0], tue: [1], fri: [0] }))).toBe(50);
    expect(parentTutorFit(active, gridWith({ sun: [5] }))).toBe(0);
    expect(parentTutorFit(active, null)).toBeNull();
    expect(parentTutorFit(new Set(), gridWith({ mon: [0] }))).toBeNull();
    expect(parentTutorFit(null, gridWith({ mon: [0] }))).toBeNull();
  });

  it("tutor: overlap / case units; flexible or no slots is a full match", () => {
    const open = new Set(["thu-afternoon"]);
    const slots = [
      { day: "thu", period: "afternoon" },
      { day: "thu", period: "evening" },
    ];
    expect(tutorCaseFit(open, { scheduleMode: "specific", scheduleSlots: slots })).toBe(50);
    expect(tutorCaseFit(open, { scheduleMode: "flexible", scheduleSlots: slots })).toBe(100);
    expect(tutorCaseFit(open, { scheduleMode: null, scheduleSlots: [] })).toBe(100);
    expect(tutorCaseFit(open, { scheduleMode: "specific", scheduleSlots: [slots[1]] })).toBe(0);
  });

  it("ranks 100, partial, zero, then unscored", () => {
    expect([0, null, 100, 50].sort(compareFit)).toEqual([100, 50, 0, null]);
  });
});

describe("findClashes", () => {
  const source: FitSource = {
    ...empty,
    lessons: [
      lesson(),
      lesson({ startsAt: "2026-11-17T08:00:00.000Z" }),
      lesson({ caseId: "c2", startsAt: "2026-11-11T11:00:00.000Z", subject: null }),
    ],
    proposed: [
      {
        caseId: "me",
        subject: "Maths",
        role: "parent",
        scheduleMode: "specific",
        slots: [{ day: "fri", period: "evening" }],
      },
      {
        caseId: "other",
        subject: "Physics",
        role: "parent",
        scheduleMode: "specific",
        slots: [{ day: "fri", period: "evening" }],
      },
    ],
  };
  const schedule = buildFitSchedule(source, "parent", NOW);

  it("names the case, with real lesson times, and collapses a series", () => {
    expect(findClashes([{ day: "tue", period: "afternoon" }], schedule)).toEqual([
      {
        state: "occupied",
        day: "tue",
        period: "afternoon",
        clock: "16:00–18:00",
        title: "IB Chemistry",
      },
    ]);
  });

  it("keeps a null title so the UI can fall back to generic copy", () => {
    expect(findClashes([{ day: "wed", period: "evening" }], schedule)[0]?.title).toBeNull();
  });

  it("reports proposals by band and ignores the case being applied to", () => {
    expect(findClashes([{ day: "fri", period: "evening" }], schedule, "me")).toEqual([
      { state: "proposed", day: "fri", period: "evening", clock: null, title: "Physics" },
    ]);
  });

  it("reports blocked slots and nothing for a free slot", () => {
    const blocked = buildFitSchedule({ ...empty, blockedDates: ["2026-11-09"] }, "tutor", NOW);
    expect(findClashes([{ day: "mon", period: "morning" }], blocked)[0]?.state).toBe("blocked");
    expect(findClashes([{ day: "sun", period: "morning" }], schedule)).toEqual([]);
  });
});

describe("rankCasesByFit", () => {
  const slots = (...keys: string[]) =>
    keys.map((k) => {
      const [day, period] = k.split("-");
      return { day, period };
    });
  const full = { id: "full", scheduleMode: "specific", scheduleSlots: slots("mon-morning") };
  const half = {
    id: "half",
    scheduleMode: "specific",
    scheduleSlots: slots("mon-morning", "tue-morning"),
  };
  const none = { id: "none", scheduleMode: "specific", scheduleSlots: slots("sun-evening") };
  const flexible = { id: "flex", scheduleMode: "flexible", scheduleSlots: [] };
  const open = new Set(["mon-morning"]);

  it("hides zero-fit cases when matched and ranks best first", () => {
    const r = rankCasesByFit([none, half, flexible, full], open, true);
    expect(r.items.map((i) => i.id)).toEqual(["flex", "full", "half"]);
    expect(r.zeroFit).toBe(false);
    expect(r.scores.get("none")).toBe(0);
  });

  it("show all keeps conflicting cases, last", () => {
    const r = rankCasesByFit([none, half, full], open, false);
    expect(r.items.map((i) => i.id)).toEqual(["full", "half", "none"]);
  });

  it("never empties the board: zero fits expand with the notice", () => {
    const r = rankCasesByFit([none], open, true);
    expect(r.items.map((i) => i.id)).toEqual(["none"]);
    expect(r.zeroFit).toBe(true);
    expect(rankCasesByFit([], open, true).zeroFit).toBe(false);
  });

  it("no schedule data leaves the board untouched", () => {
    const r = rankCasesByFit([none, full], null, true);
    expect(r.items.map((i) => i.id)).toEqual(["none", "full"]);
    expect(r.scores.size).toBe(0);
  });
});
