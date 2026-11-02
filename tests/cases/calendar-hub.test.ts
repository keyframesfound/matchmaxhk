import { describe, expect, it } from "vitest";

import {
  confirmState,
  hktMonthKey,
  summarizeCalendar,
  type HubLesson,
} from "@/features/cases/calendar-hub";

const base: Omit<HubLesson, "id" | "startsAt" | "status"> = {
  caseId: "c1",
  caseCode: "C-1",
  durationMin: 90,
  counterpart: "Anson",
  confirmedByTutor: true,
  confirmedByParent: false,
};
const lesson = (id: string, startsAt: string, status: string): HubLesson => ({
  ...base,
  id,
  startsAt,
  status,
});

describe("calendar hub (#461 amendment)", () => {
  const now = new Date("2026-11-02T04:00:00Z"); // 12:00 HKT

  it("uses Hong Kong month boundaries", () => {
    expect(hktMonthKey("2026-10-31T17:00:00Z")).toBe("2026-11"); // 01:00 HKT Nov 1
    expect(hktMonthKey("2026-10-31T15:00:00Z")).toBe("2026-10");
  });

  it("lists future live lessons in order and counts this month", () => {
    const s = summarizeCalendar(
      [
        lesson("b", "2026-11-10T10:00:00Z", "confirmed"),
        lesson("a", "2026-11-05T10:00:00Z", "planned"),
        lesson("x", "2026-11-06T10:00:00Z", "cancelled"),
        lesson("d", "2026-11-01T10:00:00Z", "done"),
      ],
      now,
    );
    expect(s.upcoming.map((l) => l.id)).toEqual(["a", "b"]);
    expect(s.thisMonthScheduled).toBe(3);
  });

  it("summarizes the previous three months of done lessons", () => {
    const s = summarizeCalendar(
      [
        lesson("o1", "2026-10-05T10:00:00Z", "done"),
        lesson("o2", "2026-10-12T10:00:00Z", "done"),
        lesson("s1", "2026-09-12T10:00:00Z", "cancelled"),
      ],
      now,
    );
    expect(s.history).toEqual([
      { month: "2026-10", lessons: 2, hours: 3 },
      { month: "2026-09", lessons: 0, hours: 0 },
      { month: "2026-08", lessons: 0, hours: 0 },
    ]);
  });

  it("reports dual-confirm state", () => {
    expect(confirmState({ confirmedByTutor: true, confirmedByParent: true })).toBe("both");
    expect(confirmState({ confirmedByTutor: false, confirmedByParent: true })).toBe("parent_only");
    expect(confirmState({ confirmedByTutor: false, confirmedByParent: false })).toBe("none");
  });
});
