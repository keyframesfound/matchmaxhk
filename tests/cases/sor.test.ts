import { describe, expect, it } from "vitest";

import {
  ACTIVE_STUDENT_WINDOW_DAYS,
  assertTransition,
  cancelActionFor,
  canMarkDone,
  computeFeeAmountHkd,
  conflictsWithLesson,
  feeDueAtFrom,
  FEE_MULTIPLIER,
  hktDateKey,
  hktFromParts,
  hktMinuteOfDay,
  IllegalTransitionError,
  isActiveStudentCase,
  isFeeOpen,
  isLegalTransition,
  isReminderDue,
  reminderDueAt,
  isUnconfirmedRequestExpired,
} from "../../src/features/cases/sor";

describe("SoR status machine (#201)", () => {
  it("allows every transition from the issue's list", () => {
    const legal: [string, string][] = [
      ["draft", "introduced"],
      ["draft", "closed"],
      ["introduced", "lesson_1_scheduled"],
      ["lesson_1_scheduled", "lesson_1_done"],
      ["lesson_1_done", "lesson_2_scheduled"],
      ["lesson_1_done", "fee_invoiced"],
      ["lesson_1_done", "closed"],
      ["lesson_2_scheduled", "lesson_2_done"],
      ["lesson_2_done", "fee_invoiced"],
      ["fee_invoiced", "fee_paid"],
      ["fee_invoiced", "waived"],
      ["fee_paid", "active"],
      ["fee_paid", "closed"], // #503 bilateral End Case
      ["active", "replaced"],
      ["active", "closed"],
      ["waived", "closed"],
    ];
    for (const [from, to] of legal) {
      expect(isLegalTransition(from as never, to as never), `${from}->${to}`).toBe(true);
    }
  });

  it("rejects illegal jumps, including skips and backwards moves", () => {
    expect(isLegalTransition("draft", "fee_invoiced")).toBe(false);
    expect(isLegalTransition("introduced", "fee_paid")).toBe(false);
    expect(isLegalTransition("active", "draft")).toBe(false);
    expect(isLegalTransition("replaced", "closed")).toBe(false);
    expect(isLegalTransition("closed", "active")).toBe(false);
  });

  it("assertTransition throws IllegalTransitionError", () => {
    expect(() => assertTransition("draft", "active")).toThrow(IllegalTransitionError);
    expect(() => assertTransition("lesson_2_done", "fee_invoiced")).not.toThrow();
  });
});

describe("admin fee math (#201)", () => {
  it("computes 1.5 × rate at invoice time", () => {
    expect(computeFeeAmountHkd(500)).toBe(750);
    expect(computeFeeAmountHkd(480, FEE_MULTIPLIER)).toBe(720);
    expect(computeFeeAmountHkd(333.33)).toBe(500); // 499.995 → 2dp
  });

  it("custom one-lesson invoice uses multiplier 1", () => {
    expect(computeFeeAmountHkd(500, 1)).toBe(500);
  });

  it("guards non-positive rates and multipliers", () => {
    expect(computeFeeAmountHkd(0)).toBe(0);
    expect(computeFeeAmountHkd(500, 0)).toBe(0);
    expect(computeFeeAmountHkd(-5)).toBe(0);
  });

  it("fee due in 3 days from invoice", () => {
    const invoiced = new Date("2026-10-17T09:00:00Z");
    expect(feeDueAtFrom(invoiced).getTime()).toBe(invoiced.getTime() + 3 * 86400000);
  });

  it("only not_due/invoiced/paid are open", () => {
    expect(isFeeOpen("not_due")).toBe(true);
    expect(isFeeOpen("invoiced")).toBe(true);
    expect(isFeeOpen("paid")).toBe(true);
    expect(isFeeOpen("waived")).toBe(false);
    expect(isFeeOpen("refunded")).toBe(false);
  });
});

describe("lesson timing rules (#201/#204)", () => {
  const start = new Date("2026-10-20T10:00:00Z");

  it("mark-done window is 15 min before → 7 days after", () => {
    expect(canMarkDone(start, new Date(start.getTime() - 16 * 60000))).toBe(false);
    expect(canMarkDone(start, new Date(start.getTime() - 14 * 60000))).toBe(true);
    expect(canMarkDone(start, new Date(start.getTime() + 7 * 86400000))).toBe(true);
    expect(canMarkDone(start, new Date(start.getTime() + 8 * 86400000))).toBe(false);
  });

  it("cancel rule: >12h before → cancelled, inside → late_cancel", () => {
    expect(cancelActionFor(start, new Date(start.getTime() - 13 * 3600000))).toBe("cancelled");
    expect(cancelActionFor(start, new Date(start.getTime() - 11 * 3600000))).toBe("late_cancel");
  });

  it("F2F pair inside 30 minutes conflicts; online does not", () => {
    const a = { startsAt: start, durationMin: 60, mode: "f2f" as const };
    // Blocked zone around a extends 30 min past its end: [0, 90].
    const insideBuffer = {
      startsAt: new Date(start.getTime() + 45 * 60000),
      durationMin: 60,
      mode: "f2f" as const,
    };
    const backToBack = {
      startsAt: new Date(start.getTime() + 60 * 60000),
      durationMin: 60,
      mode: "f2f" as const,
    };
    const beyondBuffer = {
      startsAt: new Date(start.getTime() + 95 * 60000),
      durationMin: 60,
      mode: "f2f" as const,
    };
    const online = { ...backToBack, mode: "online" as const };
    expect(conflictsWithLesson(insideBuffer, a)).toBe(true);
    expect(conflictsWithLesson(backToBack, a)).toBe(true); // needs the 30-min gap
    expect(conflictsWithLesson(beyondBuffer, a)).toBe(false);
    expect(conflictsWithLesson(online, a)).toBe(false); // online has no buffer
  });

  it("buffer exemption skips the buffer but not the overlap", () => {
    const a = { startsAt: start, durationMin: 60, mode: "f2f" as const };
    // Back-to-back: inside the buffer normally, allowed when exempt.
    const backToBack = {
      startsAt: new Date(start.getTime() + 60 * 60000),
      durationMin: 60,
      mode: "f2f" as const,
      bufferExempt: true,
    };
    expect(conflictsWithLesson(backToBack, a)).toBe(false);
    // True overlap is still rejected even with the exemption.
    const overlap = {
      startsAt: new Date(start.getTime() + 30 * 60000),
      durationMin: 60,
      mode: "f2f" as const,
      bufferExempt: true,
    };
    expect(conflictsWithLesson(overlap, a)).toBe(true);
  });

  it("active student: done lesson within 30 days or future confirmed lesson", () => {
    const now = new Date("2026-10-17T00:00:00Z");
    const recentDone = {
      startsAt: new Date(now.getTime() - (ACTIVE_STUDENT_WINDOW_DAYS - 1) * 86400000),
      status: "done" as const,
    };
    const oldDone = {
      startsAt: new Date(now.getTime() - (ACTIVE_STUDENT_WINDOW_DAYS + 1) * 86400000),
      status: "done" as const,
    };
    const futureConfirmed = {
      startsAt: new Date(now.getTime() + 3 * 86400000),
      status: "confirmed" as const,
    };
    const cancelled = {
      startsAt: new Date(now.getTime() + 3 * 86400000),
      status: "cancelled" as const,
    };
    expect(isActiveStudentCase([recentDone], now)).toBe(true);
    expect(isActiveStudentCase([oldDone], now)).toBe(false);
    expect(isActiveStudentCase([futureConfirmed], now)).toBe(true);
    expect(isActiveStudentCase([cancelled], now)).toBe(false);
  });
});

describe("HKT helpers (#204)", () => {
  it("minute-of-day and date key use UTC+8", () => {
    // 2026-10-20T10:00:00Z = 18:00 HKT
    expect(hktMinuteOfDay(new Date("2026-10-20T10:00:00Z"))).toBe(18 * 60);
    expect(hktDateKey(new Date("2026-10-20T17:00:00Z"))).toBe("2026-10-21"); // 01:00 HKT next day
  });

  it("hktFromParts round-trips through hktMinuteOfDay", () => {
    const d = hktFromParts("2026-10-21", 16 * 60);
    expect(hktDateKey(d)).toBe("2026-10-21");
    expect(hktMinuteOfDay(d)).toBe(16 * 60);
  });

  it("reminder is due from previous day 18:00 HKT until start", () => {
    // Lesson at 2026-10-21 16:00 HKT = 08:00Z.
    const lesson = hktFromParts("2026-10-21", 16 * 60);
    const dueAt = reminderDueAt(lesson);
    expect(hktDateKey(dueAt)).toBe("2026-10-20");
    expect(hktMinuteOfDay(dueAt)).toBe(18 * 60);
    expect(isReminderDue(lesson, new Date(dueAt.getTime() - 1))).toBe(false);
    expect(isReminderDue(lesson, dueAt)).toBe(true);
    expect(isReminderDue(lesson, new Date(lesson.getTime() - 1))).toBe(true);
    expect(isReminderDue(lesson, new Date(lesson.getTime() + 1))).toBe(false);
  });
});

describe("isUnconfirmedRequestExpired (#204 12h rule)", () => {
  const created = "2026-10-15T00:00:00Z";
  const later = new Date("2026-10-15T13:00:00Z"); // 13h after the request

  it("expires a planned request the tutor never confirmed", () => {
    expect(
      isUnconfirmedRequestExpired(
        { status: "planned", created_at: created, confirmed_by_tutor_at: null },
        later,
      ),
    ).toBe(true);
  });

  it("keeps a planned lesson the tutor already confirmed (waiting on the parent)", () => {
    expect(
      isUnconfirmedRequestExpired(
        { status: "planned", created_at: created, confirmed_by_tutor_at: created },
        later,
      ),
    ).toBe(false);
  });

  it("ignores lessons that are no longer planned or still inside 12h", () => {
    const row = { status: "confirmed", created_at: created, confirmed_by_tutor_at: null };
    expect(isUnconfirmedRequestExpired(row, later)).toBe(false);
    expect(
      isUnconfirmedRequestExpired({ ...row, status: "planned" }, new Date("2026-10-15T06:00:00Z")),
    ).toBe(false);
  });
});
