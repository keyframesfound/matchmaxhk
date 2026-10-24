import { describe, expect, it } from "vitest";

import {
  lessonPlaceLabel,
  pendingTutorConfirms,
  pickNextLesson,
  type HomeLesson,
} from "../../src/features/cases/tutor/tutor-home-model";
import { rankFee } from "../../src/features/cases/tutor.functions";

const HOUR = 60 * 60 * 1000;

function lesson(overrides: Partial<HomeLesson> = {}): HomeLesson {
  return {
    lessonId: "l1",
    caseId: "c1",
    caseCode: "MM-C001",
    sequence: 1,
    startsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
    durationMin: 60,
    status: "confirmed",
    createdAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    confirmedByTutorAt: new Date(Date.now() - 1 * HOUR).toISOString(),
    locationOrLink: null,
    studentFirstName: "Kelly",
    subject: "Mathematics",
    examSystem: "HKDSE",
    station: "Admiralty",
    lessonMode: "f2f",
    ...overrides,
  };
}

describe("pickNextLesson (#202)", () => {
  it("picks the earliest future live lesson", () => {
    const later = lesson({
      lessonId: "l2",
      startsAt: new Date(Date.now() + 48 * HOUR).toISOString(),
    });
    const earlier = lesson({
      lessonId: "l3",
      startsAt: new Date(Date.now() + 12 * HOUR).toISOString(),
    });
    expect(pickNextLesson([later, earlier], new Date())?.lessonId).toBe("l3");
  });

  it("never picks cancelled, done, no_show or late_cancel rows", () => {
    for (const status of ["cancelled", "done", "no_show", "late_cancel"]) {
      expect(pickNextLesson([lesson({ status })], new Date())).toBeNull();
    }
  });

  it("keeps an in-progress lesson (started but not yet ended) as the next one", () => {
    const ongoing = lesson({
      startsAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      durationMin: 60,
    });
    expect(pickNextLesson([ongoing], new Date())?.lessonId).toBe("l1");
  });

  it("drops lessons that already ended", () => {
    const over = lesson({
      startsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
      durationMin: 60,
    });
    expect(pickNextLesson([over], new Date())).toBeNull();
  });

  it("returns null with no lessons", () => {
    expect(pickNextLesson([], new Date())).toBeNull();
  });
});

describe("pendingTutorConfirms (#202)", () => {
  it("lists planned, unconfirmed, unexpired requests", () => {
    const pending = lesson({
      status: "planned",
      confirmedByTutorAt: null,
      createdAt: new Date(Date.now() - 1 * HOUR).toISOString(),
    });
    expect(pendingTutorConfirms([pending], new Date()).map((l) => l.lessonId)).toEqual(["l1"]);
  });

  it("excludes expired slot requests (12h window)", () => {
    const expired = lesson({
      status: "planned",
      confirmedByTutorAt: null,
      createdAt: new Date(Date.now() - 13 * HOUR).toISOString(),
    });
    expect(pendingTutorConfirms([expired], new Date())).toEqual([]);
  });

  it("excludes already-confirmed and non-planned rows", () => {
    const confirmed = lesson({});
    const doneRow = lesson({ lessonId: "l9", status: "done", confirmedByTutorAt: null });
    expect(pendingTutorConfirms([confirmed, doneRow], new Date())).toEqual([]);
  });

  it("excludes slots that already passed", () => {
    const past = lesson({
      status: "planned",
      confirmedByTutorAt: null,
      createdAt: new Date(Date.now() - 1 * HOUR).toISOString(),
      startsAt: new Date(Date.now() - 2 * HOUR).toISOString(),
      durationMin: 60,
    });
    expect(pendingTutorConfirms([past], new Date())).toEqual([]);
  });

  it("sorts by start time", () => {
    const later = lesson({
      lessonId: "l2",
      status: "planned",
      confirmedByTutorAt: null,
      startsAt: new Date(Date.now() + 48 * HOUR).toISOString(),
    });
    const earlier = lesson({
      lessonId: "l3",
      status: "planned",
      confirmedByTutorAt: null,
      startsAt: new Date(Date.now() + 12 * HOUR).toISOString(),
    });
    expect(pendingTutorConfirms([later, earlier], new Date()).map((l) => l.lessonId)).toEqual([
      "l3",
      "l2",
    ]);
  });
});

describe("lessonPlaceLabel (#202)", () => {
  it("online wins over station", () => {
    expect(lessonPlaceLabel({ lessonMode: "online", station: "Admiralty" })).toBe("online");
  });

  it("station when f2f with a district", () => {
    expect(lessonPlaceLabel({ lessonMode: "f2f", station: "Admiralty" })).toBe("station");
  });

  it("f2f fallback without a district", () => {
    expect(lessonPlaceLabel({ lessonMode: "f2f", station: null })).toBe("f2f");
  });
});

describe("rankFee (#202 waived visibility)", () => {
  it("ranks the live invoice above not_due, paid and waived", () => {
    expect(rankFee("invoiced")).toBeGreaterThan(rankFee("not_due"));
    expect(rankFee("not_due")).toBeGreaterThan(rankFee("paid"));
    expect(rankFee("paid")).toBeGreaterThan(rankFee("waived"));
  });

  it("a fresh invoice beats an older waived row on the same case", () => {
    // Waived rows may precede a later invoice; the live one must win.
    expect(rankFee("invoiced") > rankFee("waived")).toBe(true);
  });
});
