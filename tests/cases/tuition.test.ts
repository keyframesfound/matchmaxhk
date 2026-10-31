import { describe, expect, it } from "vitest";

import { tuitionEditError, voidLessonError } from "../../src/features/cases/tuition";

/**
 * Issue #461 Phase A 3b — who may mark tuition paid/unpaid, and when staff
 * may soft-void a lesson.
 */
describe("tuitionEditError", () => {
  it("lets the tutor track tuition on a done lesson they teach", () => {
    expect(tuitionEditError({ source: "lesson", status: "done", isMine: true })).toBeNull();
  });

  it("lets the tutor track tuition on a pending or verified session log", () => {
    expect(tuitionEditError({ source: "session_log", status: "pending", isMine: true })).toBeNull();
    expect(
      tuitionEditError({ source: "session_log", status: "verified", isMine: true }),
    ).toBeNull();
  });

  it("refuses someone else's lesson", () => {
    expect(tuitionEditError({ source: "lesson", status: "done", isMine: false })).toBe(
      "NOT_YOUR_LESSON",
    );
  });

  it("refuses lessons that were not taught", () => {
    expect(tuitionEditError({ source: "lesson", status: "planned", isMine: true })).toBe(
      "LESSON_NOT_TAUGHT",
    );
    expect(tuitionEditError({ source: "lesson", status: "voided", isMine: true })).toBe(
      "LESSON_NOT_TAUGHT",
    );
    expect(tuitionEditError({ source: "session_log", status: "disputed", isMine: true })).toBe(
      "LESSON_NOT_TAUGHT",
    );
  });
});

describe("voidLessonError", () => {
  const ok = { status: "done", hasManagedHold: false, reason: "Logged on the wrong case" };

  it("allows a staff void with a reason", () => {
    expect(voidLessonError(ok)).toBeNull();
  });

  it("needs a 3–500 character reason", () => {
    expect(voidLessonError({ ...ok, reason: " x " })).toBe("VOID_REASON_REQUIRED");
    expect(voidLessonError({ ...ok, reason: "x".repeat(501) })).toBe("VOID_REASON_REQUIRED");
  });

  it("refuses an already voided lesson", () => {
    expect(voidLessonError({ ...ok, status: "voided" })).toBe("ALREADY_VOIDED");
  });

  it("leaves Managed lessons to the credit ledger", () => {
    expect(voidLessonError({ ...ok, hasManagedHold: true })).toBe("MANAGED_LEDGER_LESSON");
  });
});
