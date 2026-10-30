import { describe, expect, it } from "vitest";

import {
  DEFAULT_NEW_TUTOR_FIRST_LESSON_CAP,
  canRevealParentContact,
  checkFirstLessonCap,
  hmacPhone,
  isBlacklistReason,
  isCaseRiskFlagType,
  maskName,
  maskPhone,
  parentContactView,
  resolveFirstLessonCap,
  verifiedHoursFromMinutes,
  type RevealInput,
} from "../../src/features/trust/trust";

const baseReveal: RevealInput = {
  isMatchedTutor: true,
  caseClosed: false,
  openFlagTypes: [],
  introFeeSettled: false,
  tutorVerifiedHours: 0,
};

describe("hmacPhone", () => {
  const SECRET = "test-secret";

  it("normalizes +852 and separators to the same key", async () => {
    const a = await hmacPhone("+852 9123 4567", SECRET);
    const b = await hmacPhone("9123-4567", SECRET);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it("is keyed: another secret gives another hash", async () => {
    expect(await hmacPhone("91234567", SECRET)).not.toBe(await hmacPhone("91234567", "other"));
  });

  it("returns null for non-phones or a missing secret", async () => {
    expect(await hmacPhone("", SECRET)).toBeNull();
    expect(await hmacPhone("123", SECRET)).toBeNull();
    expect(await hmacPhone("91234567", "")).toBeNull();
    expect(await hmacPhone("91234567", undefined)).toBeNull();
  });
});

describe("masking", () => {
  it("masks an 8-digit HK phone to first + last two digits", () => {
    expect(maskPhone("+852 9123 4567")).toBe("9••• ••67");
  });

  it("masks names to surname + initial", () => {
    expect(maskName("Chan Tai Man")).toBe("Chan T.");
    expect(maskName("Mary")).toBe("Mary");
    expect(maskName("  ")).toBeNull();
  });
});

describe("canRevealParentContact (#535 progressive reveal)", () => {
  it("masks for a new tutor until the intro fee is settled", () => {
    expect(canRevealParentContact(baseReveal)).toEqual({
      reveal: false,
      reason: "FEE_OR_HOURS_REQUIRED",
    });
    expect(canRevealParentContact({ ...baseReveal, introFeeSettled: true })).toEqual({
      reveal: true,
    });
  });

  it("reveals for established tutors (≥ 3 verified hours)", () => {
    expect(canRevealParentContact({ ...baseReveal, tutorVerifiedHours: 3 }).reveal).toBe(true);
  });

  it("blocking risk flags revoke reveal for everyone", () => {
    const r = canRevealParentContact({
      ...baseReveal,
      introFeeSettled: true,
      openFlagTypes: ["SCAM_OVERPAYMENT"],
    });
    expect(r).toEqual({ reveal: false, reason: "RISK_HOLD" });
  });

  it("advisory-only flags do not revoke reveal", () => {
    const r = canRevealParentContact({
      ...baseReveal,
      introFeeSettled: true,
      openFlagTypes: ["TUTOR_GHOST_RISK"],
    });
    expect(r.reveal).toBe(true);
  });

  it("never reveals to a non-matched tutor or on a closed case", () => {
    expect(canRevealParentContact({ ...baseReveal, isMatchedTutor: false })).toMatchObject({
      reason: "NOT_MATCHED",
    });
    expect(
      canRevealParentContact({ ...baseReveal, introFeeSettled: true, caseClosed: true }),
    ).toMatchObject({ reason: "CASE_CLOSED" });
  });

  it("parentContactView masks unless the gate clears", () => {
    const contact = { name: "Chan Tai Man", phone: "91234567" };
    expect(parentContactView(contact, { reveal: false, reason: "RISK_HOLD" })).toEqual({
      revealed: false,
      name: "Chan T.",
      phone: "9••• ••67",
      reason: "RISK_HOLD",
    });
    expect(parentContactView(contact, { reveal: true })).toEqual({
      revealed: true,
      name: "Chan Tai Man",
      phone: "91234567",
      reason: null,
    });
  });
});

describe("new-tutor concurrency cap", () => {
  it("defaults to 2 and accepts sane overrides only", () => {
    expect(resolveFirstLessonCap(undefined)).toBe(DEFAULT_NEW_TUTOR_FIRST_LESSON_CAP);
    expect(resolveFirstLessonCap(3)).toBe(3);
    expect(resolveFirstLessonCap("4")).toBe(4);
    expect(resolveFirstLessonCap(0)).toBe(2);
    expect(resolveFirstLessonCap(99)).toBe(2);
  });

  it("blocks a new tutor at the cap and never blocks established tutors", () => {
    expect(checkFirstLessonCap({ tutorVerifiedHours: 0, openFirstLessonCount: 1, cap: 2 })).toEqual(
      { ok: true },
    );
    expect(
      checkFirstLessonCap({ tutorVerifiedHours: 2.5, openFirstLessonCount: 2, cap: 2 }),
    ).toEqual({ ok: false, reason: "NEW_TUTOR_CAP_REACHED", cap: 2 });
    expect(checkFirstLessonCap({ tutorVerifiedHours: 3, openFirstLessonCount: 9, cap: 2 })).toEqual(
      { ok: true },
    );
  });

  it("verifiedHoursFromMinutes ignores junk", () => {
    expect(verifiedHoursFromMinutes([90, 60, -10, Number.NaN])).toBe(2.5);
  });
});

describe("vocabulary guards", () => {
  it("accepts only known enums", () => {
    expect(isBlacklistReason("HOSTILE_PARENT")).toBe(true);
    expect(isBlacklistReason("hostile")).toBe(false);
    expect(isCaseRiskFlagType("BYPASS_COLLUSION_RISK")).toBe(true);
    expect(isCaseRiskFlagType("NOPE")).toBe(false);
  });
});
