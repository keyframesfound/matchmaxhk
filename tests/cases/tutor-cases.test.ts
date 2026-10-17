import { describe, expect, it } from "vitest";

import {
  countActiveStudents,
  firstNameOf,
  groupWeekByDay,
  lessonActionsFor,
  validateWindows,
} from "../../src/features/cases/tutor/week-model";
import { canMarkDone, hktFromParts } from "../../src/features/cases/sor";

describe("tutor week model (#201/#204)", () => {
  it("student first name only (privacy rule)", () => {
    expect(firstNameOf("Chan Tai Man")).toBe("Chan");
    expect(firstNameOf("  Mary  ")).toBe("Mary");
    expect(firstNameOf(null)).toBe("Student");
    expect(firstNameOf("")).toBe("Student");
  });

  it("validates windows: weekday range, minutes, start<end", () => {
    expect(validateWindows([{ weekday: 0, start_minute: 960, end_minute: 1200 }])).toEqual([]);
    expect(validateWindows([{ weekday: 7, start_minute: 0, end_minute: 60 }])).toHaveLength(1);
    expect(validateWindows([{ weekday: 0, start_minute: 1200, end_minute: 960 }])).toHaveLength(1);
    expect(validateWindows([{ weekday: 0, start_minute: -5, end_minute: 60 }])).toHaveLength(1);
    expect(validateWindows([{ weekday: 0, start_minute: 0, end_minute: 1441 }])).toHaveLength(1);
  });

  it("groups lessons and slots by HKT day, sorted within each day", () => {
    // Monday 2026-10-19, 16:00 and 18:00 HKT lessons; a 17:00 slot.
    const l1 = hktFromParts("2026-10-19", 18 * 60);
    const l2 = hktFromParts("2026-10-19", 16 * 60);
    const slot = { startsAt: hktFromParts("2026-10-19", 17 * 60), durationMin: 60, station: null };
    const nextWeek = hktFromParts("2026-10-26", 16 * 60);

    const days = groupWeekByDay(
      [
        { id: "a", starts_at: l1.toISOString(), duration_min: 60, status: "confirmed" },
        { id: "b", starts_at: l2.toISOString(), duration_min: 60, status: "done" },
        { id: "c", starts_at: nextWeek.toISOString(), duration_min: 60, status: "planned" },
      ],
      [slot],
      hktFromParts("2026-10-19", 12 * 60),
      14,
    );

    const monday = days.find((d) => d.dateKey === "2026-10-19");
    expect(monday?.lessons.map((l) => l.id)).toEqual(["b", "a"]); // sorted by time
    expect(monday?.openSlots).toHaveLength(1);
    const nextMonday = days.find((d) => d.dateKey === "2026-10-26");
    expect(nextMonday?.lessons).toHaveLength(1);
    expect(days.every((d) => d.dateKey <= "2026-11-02")).toBe(true); // horizon respected
  });

  it("counts active students: done within 30d or future live lesson", () => {
    const now = new Date("2026-10-17T00:00:00Z");
    const active = [
      [{ status: "done", starts_at: new Date(now.getTime() - 5 * 86400000).toISOString() }],
    ];
    const inactive = [
      [{ status: "done", starts_at: new Date(now.getTime() - 40 * 86400000).toISOString() }],
    ];
    const future = [
      [{ status: "confirmed", starts_at: new Date(now.getTime() + 2 * 86400000).toISOString() }],
    ];
    expect(countActiveStudents([active[0], future[0]], now)).toBe(2);
    expect(countActiveStudents([inactive[0]], now)).toBe(0);
  });

  it("lesson actions mirror the server gates", () => {
    const start = hktFromParts("2026-10-19", 16 * 60);
    // 10 min before start: inside the mark-done window (opens 15 min before).
    const now = new Date(start.getTime() - 10 * 60000);
    const planned = { starts_at: start.toISOString(), status: "planned" };
    const a = lessonActionsFor(planned, now, canMarkDone);
    expect(a).toEqual({ confirm: true, decline: true, done: true, cancel: true });

    const done = { starts_at: start.toISOString(), status: "done" };
    expect(lessonActionsFor(done, now, canMarkDone)).toEqual({
      confirm: false,
      decline: false,
      done: false,
      cancel: false,
    });

    // done window closed: >15min before start
    const early = new Date(start.getTime() - 30 * 60000);
    expect(lessonActionsFor(planned, early, canMarkDone).done).toBe(false);
  });

  it("hides confirm/decline once a slot request is past the 12h expiry (#375 QA)", () => {
    const start = hktFromParts("2026-10-19", 16 * 60);
    const now = new Date(start.getTime() - 10 * 60000);
    const fresh = {
      starts_at: start.toISOString(),
      status: "planned",
      created_at: new Date(now.getTime() - 60 * 60000).toISOString(),
    };
    expect(lessonActionsFor(fresh, now, canMarkDone).confirm).toBe(true);
    expect(lessonActionsFor(fresh, now, canMarkDone).decline).toBe(true);

    const stale = {
      starts_at: start.toISOString(),
      status: "planned",
      created_at: new Date(now.getTime() - 13 * 60 * 60000).toISOString(),
    };
    const a = lessonActionsFor(stale, now, canMarkDone);
    expect(a.confirm).toBe(false);
    expect(a.decline).toBe(false);

    // Legacy rows without created_at keep the old behavior.
    const legacy = { starts_at: start.toISOString(), status: "planned" };
    expect(lessonActionsFor(legacy, now, canMarkDone).confirm).toBe(true);
  });
});
