import { describe, expect, it } from "vitest";

import { monthTuitionEstimate, type HubLesson } from "../../src/features/cases/calendar-hub";
import {
  canMarkTuitionUnpaid,
  lessonNetHkd,
  type EarningsCaseInput,
} from "../../src/features/cases/earnings";
import { ACTIVE_STUDENT_WINDOW_DAYS } from "../../src/features/cases/sor";
import { EXPERIENCE, unpaidAllowed } from "../../src/features/tutors/experience";
import { AUTO_VERIFY_HOURS } from "../../src/features/hours/hours";

const now = new Date("2026-11-15T04:00:00Z");

const baseCase = (over: Partial<EarningsCaseInput> = {}): EarningsCaseInput =>
  ({
    caseId: "c1",
    caseCode: "MM-C1",
    studentLabel: "Amy",
    hourlyRateHkd: 400,
    studentCount: 1,
    packageType: null,
    tier: "primary",
    splitMode: "standard",
    feeRuleId: null,
    lessons: [1, 2, 3].map((n) => ({
      id: `L${n}`,
      sequence: n,
      startsAt: `2026-11-0${n}T10:00:00Z`,
      durationMin: 60,
      status: "done",
    })),
    sessionLogs: [],
    ...over,
  }) as EarningsCaseInput;

describe("#828 AC-A3 unpaid tuition only where the tutor nets money", () => {
  it("Lesson 1 nets $0 and cannot be marked unpaid; later lessons can", () => {
    const c = baseCase();
    expect(lessonNetHkd(c, "lesson", "L1", now)).toBe(0);
    expect(canMarkTuitionUnpaid(lessonNetHkd(c, "lesson", "L1", now))).toBe(false);
    expect(canMarkTuitionUnpaid(lessonNetHkd(c, "lesson", "L2", now))).toBe(true);
    expect(canMarkTuitionUnpaid(lessonNetHkd(c, "lesson", "L3", now))).toBe(true);
  });

  it("a case with no rate, or an unknown row, is never markable", () => {
    expect(
      canMarkTuitionUnpaid(lessonNetHkd(baseCase({ hourlyRateHkd: null }), "lesson", "L3", now)),
    ).toBe(false);
    expect(canMarkTuitionUnpaid(lessonNetHkd(baseCase(), "lesson", "nope", now))).toBe(false);
  });
});

describe("#828 AC-A3/A-A5 the log path shares the same rules", () => {
  it("unpaid is refused whenever the tutor nets nothing", () => {
    expect(unpaidAllowed(0)).toBe(false);
    expect(unpaidAllowed(-1)).toBe(false);
    expect(unpaidAllowed(Number.NaN)).toBe(false);
    expect(unpaidAllowed(400)).toBe(true);
  });

  it("the session-log auto-verify clock is the shared 24h, not a second 72h literal", () => {
    expect(EXPERIENCE.autoVerifyHours).toBe(AUTO_VERIFY_HOURS);
    expect(EXPERIENCE.autoVerifyHours).toBe(24);
  });
});

describe("#828 AC-C4 one Present window", () => {
  it("active-student window and the experience Present window are both 45 days", () => {
    expect(ACTIVE_STUDENT_WINDOW_DAYS).toBe(45);
    expect(EXPERIENCE.presentWindowDays).toBe(ACTIVE_STUDENT_WINDOW_DAYS);
  });
});

describe("#828 AC-C3 parent month tuition estimate", () => {
  const lesson = (over: Partial<HubLesson>): HubLesson => ({
    id: "x",
    caseId: "c1",
    caseCode: "MM-C1",
    startsAt: "2026-11-20T10:00:00Z",
    durationMin: 90,
    status: "confirmed",
    counterpart: "Tutor",
    confirmedByTutor: true,
    confirmedByParent: false,
    lessonValueHkd: 400,
    ...over,
  });
  it("sums this month's scheduled lessons and unpaid done tuition, skipping rate-less cases", () => {
    const est = monthTuitionEstimate(
      [
        lesson({ id: "a" }), // 600
        lesson({ id: "b", startsAt: "2026-12-02T10:00:00Z" }), // next month: excluded
        lesson({
          id: "c",
          status: "done",
          startsAt: "2026-10-20T10:00:00Z",
          tuitionUnpaid: true,
          durationMin: 60,
        }), // 400
        lesson({ id: "d", status: "done", startsAt: "2026-11-03T10:00:00Z" }), // paid: excluded
        lesson({ id: "e", caseId: "c2", lessonValueHkd: null }), // no rate
      ],
      now,
    );
    expect(est).toEqual({ hkd: 1000, casesMissingRate: 1 });
  });
});
