import { describe, expect, it } from "vitest";

import { fullAdminFeeAmount } from "../../src/features/cases/fee-breakdown";
import {
  SHORT_CASE_FEE_RATE,
  buildShortCaseConfirmNote,
  convertBalanceAmountHkd,
  hoursPerLessonFromMinutes,
  shortCaseFeeAmount,
  shortCaseFeeMultiplier,
  shortCasePackageValueHkd,
  shortCaseConfirmationError,
  shouldInvoiceShortFee,
  sumBilledFeeHkd,
  validateShortCaseInputs,
} from "../../src/features/cases/short-case";

describe("hoursPerLessonFromMinutes (#443 duration lock)", () => {
  it("derives hours from the EXISTING session_length_minutes", () => {
    expect(hoursPerLessonFromMinutes(60)).toBe(1);
    expect(hoursPerLessonFromMinutes(90)).toBe(1.5);
    expect(hoursPerLessonFromMinutes(120)).toBe(2);
    expect(hoursPerLessonFromMinutes(45)).toBe(0.75);
  });

  it("returns null for missing / non-positive durations (never a lying fee)", () => {
    expect(hoursPerLessonFromMinutes(null)).toBeNull();
    expect(hoursPerLessonFromMinutes(undefined)).toBeNull();
    expect(hoursPerLessonFromMinutes(0)).toBeNull();
    expect(hoursPerLessonFromMinutes(-30)).toBeNull();
    expect(hoursPerLessonFromMinutes(Number.NaN)).toBeNull();
  });
});

describe("shortCasePackageValueHkd (#443 formula)", () => {
  it("multiplies rate × hours × lessons", () => {
    expect(shortCasePackageValueHkd(400, 1, 4)).toBe(1600);
    expect(shortCasePackageValueHkd(400, 1.5, 5)).toBe(3000);
    expect(shortCasePackageValueHkd(333, 2, 3)).toBe(1998);
  });

  it("returns 0 for out-of-domain inputs (guard shapes)", () => {
    expect(shortCasePackageValueHkd(400, 0, 3)).toBe(0);
    expect(shortCasePackageValueHkd(400, -1, 3)).toBe(0);
    expect(shortCasePackageValueHkd(400, 1, 0)).toBe(0);
    expect(shortCasePackageValueHkd(400, 1, 6)).toBe(0);
    expect(shortCasePackageValueHkd(-5, 1, 3)).toBe(0);
    expect(shortCasePackageValueHkd(Number.NaN, 1, 3)).toBe(0);
  });

  it("accepts non-enum hours derived from arbitrary session lengths (78 min = 1.3 h)", () => {
    // Duration lock: no hours enum — any positive derived hour is legal.
    expect(shortCasePackageValueHkd(400, 78 / 60, 2)).toBe(1040);
  });
});

describe("shortCaseFeeAmount", () => {
  it("is exactly 20% of the package, rounded to whole HKD", () => {
    expect(
      shortCaseFeeAmount({
        rateHkd: 400,
        hoursPerLesson: 1,
        scheduledLessonCount: 4,
        packageType: "ongoing_1_5",
      }),
    ).toBe(320);
    expect(
      shortCaseFeeAmount({
        rateHkd: 333,
        hoursPerLesson: 1.5,
        scheduledLessonCount: 5,
        packageType: "short_20",
      }),
    ).toBe(500);
    // 0.2 × 1998 = 399.6 → 400 (round-half-up on .5 boundaries via Math.round)
    expect(
      shortCaseFeeAmount({
        rateHkd: 333,
        hoursPerLesson: 2,
        scheduledLessonCount: 3,
        packageType: "short_20",
      }),
    ).toBe(400);
  });

  it("$0 pro-bono wins over the short 20%", () => {
    expect(
      shortCaseFeeAmount({
        rateHkd: 400,
        hoursPerLesson: 1,
        scheduledLessonCount: 4,
        packageType: "pro_bono",
      }),
    ).toBe(0);
  });

  it("degenerate inputs never produce a fee", () => {
    expect(
      shortCaseFeeAmount({
        rateHkd: 400,
        hoursPerLesson: 0,
        scheduledLessonCount: 4,
        packageType: "short_20",
      }),
    ).toBe(0);
    expect(
      shortCaseFeeAmount({
        rateHkd: 400,
        hoursPerLesson: Number.NaN,
        scheduledLessonCount: 4,
        packageType: "short_20",
      }),
    ).toBe(0);
  });

  it("constant matches the locked 20%", () => {
    expect(SHORT_CASE_FEE_RATE).toBe(0.2);
  });
});

describe("shortCaseFeeMultiplier", () => {
  it("reproduces the fee from the rate alone (case_fees row shape)", () => {
    expect(shortCaseFeeMultiplier(1, 4)).toBe(0.8);
    expect(shortCaseFeeMultiplier(1.5, 5)).toBe(1.5);
    expect(shortCaseFeeMultiplier(2, 5)).toBe(2);
    // amount = rate × multiplier equals the snapshot fee for every combo
    for (const hours of [1, 1.5, 2, 0.75] as const) {
      for (let count = 1; count <= 5; count += 1) {
        const rate = 250;
        expect(Math.round(rate * shortCaseFeeMultiplier(hours, count))).toBe(
          shortCaseFeeAmount({
            rateHkd: rate,
            hoursPerLesson: hours,
            scheduledLessonCount: count,
            packageType: "short_20",
          }),
        );
      }
    }
  });

  it("keeps odd derived hours (55 min → 0.9167 h) lossless at 4 dp", () => {
    expect(shortCaseFeeMultiplier(55 / 60, 3)).toBe(0.55);
  });
});

describe("shouldInvoiceShortFee (fee trigger)", () => {
  it("invoices immediately for single-lesson packages (booking confirmation)", () => {
    expect(shouldInvoiceShortFee({ scheduledLessonCount: 1, lesson1Status: "planned" })).toBe(true);
    expect(shouldInvoiceShortFee({ scheduledLessonCount: 1, lesson1Status: null })).toBe(true);
  });

  it("waits for Lesson 1 confirmed/done on multi-lesson packages", () => {
    expect(shouldInvoiceShortFee({ scheduledLessonCount: 4, lesson1Status: "planned" })).toBe(
      false,
    );
    expect(shouldInvoiceShortFee({ scheduledLessonCount: 4, lesson1Status: "confirmed" })).toBe(
      true,
    );
    expect(shouldInvoiceShortFee({ scheduledLessonCount: 4, lesson1Status: "done" })).toBe(true);
  });

  it("never fires on malformed counts", () => {
    expect(shouldInvoiceShortFee({ scheduledLessonCount: 0, lesson1Status: "confirmed" })).toBe(
      false,
    );
    expect(shouldInvoiceShortFee({ scheduledLessonCount: 9, lesson1Status: "confirmed" })).toBe(
      false,
    );
  });
});

describe("sumBilledFeeHkd + convertBalanceAmountHkd (convert math)", () => {
  it("counts only invoiced + paid rows (never waived/refunded)", () => {
    expect(
      sumBilledFeeHkd([
        { status: "invoiced", amount_hkd: 320 },
        { status: "paid", amount_hkd: "280.50" },
        { status: "waived", amount_hkd: 999 },
        { status: "refunded", amount_hkd: 999 },
        { status: "paid", amount_hkd: null },
        { status: "paid", amount_hkd: -5 },
      ]),
    ).toBe(600.5);
  });

  it("balance = max(0, standard 1.5-lesson fee − already billed)", () => {
    const standard = fullAdminFeeAmount(400); // 1.5 × 400 = 600 — the #385 math
    expect(
      convertBalanceAmountHkd(standard, sumBilledFeeHkd([{ status: "paid", amount_hkd: 320 }])),
    ).toBe(280);
    expect(
      convertBalanceAmountHkd(standard, sumBilledFeeHkd([{ status: "paid", amount_hkd: 600 }])),
    ).toBe(0);
    expect(
      convertBalanceAmountHkd(standard, sumBilledFeeHkd([{ status: "paid", amount_hkd: 900 }])),
    ).toBe(0);
    expect(convertBalanceAmountHkd(standard, 0)).toBe(600);
  });

  it("never over-invoices: floored at zero and rounded", () => {
    expect(convertBalanceAmountHkd(600, 600.4)).toBe(0);
    expect(convertBalanceAmountHkd(600.4, 0)).toBe(600);
  });

  it("convert target is the #385 fullAdminFeeAmount basis, never hours-mixed", () => {
    // The documented drift bug: rate × (minutes/60) × 1.5 would give 400 × 1.5
    // × 1.5 = 900 on a 90-min case. The convert target must stay 600.
    const rate = 400;
    const sessionMinutes = 90;
    const wrongBasis = rate * (sessionMinutes / 60) * 1.5;
    expect(fullAdminFeeAmount(rate)).not.toBe(wrongBasis);
    expect(fullAdminFeeAmount(rate)).toBe(600);
  });
});

describe("validateShortCaseInputs (desk gate)", () => {
  it("accepts the legal 1–5 count × positive session length", () => {
    expect(
      validateShortCaseInputs({ scheduledLessonCount: 5, sessionLengthMinutes: 90 }),
    ).toBeNull();
    expect(
      validateShortCaseInputs({ scheduledLessonCount: "3", sessionLengthMinutes: 60 }),
    ).toBeNull();
    expect(
      validateShortCaseInputs({ scheduledLessonCount: 2, sessionLengthMinutes: 45 }),
    ).toBeNull();
  });

  it("rejects missing / out-of-range values in order", () => {
    expect(validateShortCaseInputs({ scheduledLessonCount: null, sessionLengthMinutes: 60 })).toBe(
      "COUNT_REQUIRED",
    );
    expect(validateShortCaseInputs({ scheduledLessonCount: 6, sessionLengthMinutes: 60 })).toBe(
      "COUNT_RANGE",
    );
    expect(validateShortCaseInputs({ scheduledLessonCount: 3, sessionLengthMinutes: null })).toBe(
      "MINUTES_REQUIRED",
    );
    expect(validateShortCaseInputs({ scheduledLessonCount: 3, sessionLengthMinutes: 0 })).toBe(
      "MINUTES_INVALID",
    );
    expect(validateShortCaseInputs({ scheduledLessonCount: 3, sessionLengthMinutes: -45 })).toBe(
      "MINUTES_INVALID",
    );
  });
});

describe("shortCaseConfirmationError (parent/org WA gate)", () => {
  it("requires a named source and a pasted note", () => {
    expect(
      shortCaseConfirmationError({
        confirmedBy: "parent_wa",
        confirmedNote: "Reply YES — 4 lessons × 1h",
      }),
    ).toBeNull();
    expect(
      shortCaseConfirmationError({
        confirmedBy: "org_wa",
        confirmedNote: "Org confirms fixed 5-lesson engagement",
      }),
    ).toBeNull();
    expect(
      shortCaseConfirmationError({
        confirmedBy: "cs_note",
        confirmedNote: "Confirmed on call with parent",
      }),
    ).toBeNull();
  });

  it("blocks empty sources and short notes", () => {
    expect(
      shortCaseConfirmationError({ confirmedBy: null, confirmedNote: "some long enough note" }),
    ).toBe("CONFIRM_SOURCE_REQUIRED");
    expect(
      shortCaseConfirmationError({
        confirmedBy: "yelling" as never,
        confirmedNote: "some long enough note",
      }),
    ).toBe("CONFIRM_SOURCE_REQUIRED");
    expect(shortCaseConfirmationError({ confirmedBy: "parent_wa", confirmedNote: "short" })).toBe(
      "CONFIRM_NOTE_REQUIRED",
    );
    expect(shortCaseConfirmationError({ confirmedBy: "parent_wa", confirmedNote: "   " })).toBe(
      "CONFIRM_NOTE_REQUIRED",
    );
  });

  it("prefixes the stored case note for audit greppability", () => {
    expect(buildShortCaseConfirmNote("parent_wa", "  YES — 4 lessons  ")).toBe(
      "[short-case confirm · parent_wa] YES — 4 lessons",
    );
  });
});
