import { describe, expect, it } from "vitest";

import { isLearnerParty } from "../../src/features/cases/case-schedule";

/** Issue #796 AC-733-4: parent of record and student owner both reach the case. */
const PARENT = "11111111-1111-4111-8111-111111111111";
const STUDENT = "22222222-2222-4222-8222-222222222222";
const TUTOR = "33333333-3333-4333-8333-333333333333";

describe("isLearnerParty", () => {
  it("matches the parent of record", () => {
    expect(isLearnerParty({ userId: PARENT, parentId: PARENT, studentOwnerId: STUDENT })).toBe(
      true,
    );
  });

  it("matches the student account that owns the student profile", () => {
    expect(isLearnerParty({ userId: STUDENT, parentId: PARENT, studentOwnerId: STUDENT })).toBe(
      true,
    );
  });

  it("matches a student owner when the case has no parent of record", () => {
    expect(isLearnerParty({ userId: STUDENT, parentId: null, studentOwnerId: STUDENT })).toBe(true);
  });

  it("is false when both ids are null", () => {
    expect(isLearnerParty({ userId: PARENT, parentId: null, studentOwnerId: null })).toBe(false);
  });

  it("never matches a tutor id", () => {
    expect(isLearnerParty({ userId: TUTOR, parentId: PARENT, studentOwnerId: STUDENT })).toBe(
      false,
    );
  });

  it("treats empty ids as no match, even when the user id is empty", () => {
    expect(isLearnerParty({ userId: "", parentId: "", studentOwnerId: "" })).toBe(false);
    expect(isLearnerParty({ userId: "", parentId: PARENT, studentOwnerId: null })).toBe(false);
    expect(isLearnerParty({ userId: PARENT, parentId: "", studentOwnerId: "" })).toBe(false);
  });

  it("is false for a user who is neither the parent nor the student owner", () => {
    expect(
      isLearnerParty({
        userId: "44444444-4444-4444-8444-444444444444",
        parentId: PARENT,
        studentOwnerId: STUDENT,
      }),
    ).toBe(false);
  });
});
