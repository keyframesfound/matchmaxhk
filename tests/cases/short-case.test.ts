import { describe, expect, it } from "vitest";

import { fullAdminFeeAmount } from "../../src/features/cases/fee-breakdown";
import {
  SHORT_CASE_FEE_RATE,
  buildShortCaseConfirmNote,
  convertBalanceAmountHkd,
  isShortCaseHours,
  shortCaseFeeAmount,
  shortCaseFeeMultiplier,
  shortCasePackageValueHkd,
  shortCaseConfirmationError,
  shouldInvoiceShortFee,
  sumBilledFeeHkd,
  validateShortCaseInputs,
} from "../../src/features/cases/short-case";

describe("shortCasePackageValueHkd (#443 formula)", () => {
  it("multiplies rate × hours × lessons", () => {
    expect(shortCasePackageValueHkd(400, 1, 4)).toBe(1600);
    expect(shortCasePackageValueHkd(400, 1.5, 5)).toBe(3000);
    expect(shortCasePackageValueHkd(333, 2, 3)).toBe(1998);
  });

  it("returns 0 for out-of-domain inputs (DB CHECK shapes)", () => {
    expect(shortCasePackageValueHkd(400, 1.3, 3)).toBe(0);
    expect(shortCasePackageValueHkd(400, 1, 0)).toBe(0);
    expect(shortCasePackageValueHkd(400, 1, 6)).toBe(0);
    expect(shortCasePackageValueHkd(-5, 1, 3)).toBe(0);
    expect(shortCasePackageValueHkd(Number.NaN, 1, 3)).toBe(0);
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
        hoursPerLesson: 9,
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
    for (const hours of [1, 1.5, 2] as const) {
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
});

describe("validateShortCaseInputs (desk gate)", () => {
  it("accepts the legal 1–5 × enum-ish shape", () => {
    expect(validateShortCaseInputs({ scheduledLessonCount: 5, hoursPerLesson: 1.5 })).toBeNull();
    expect(validateShortCaseInputs({ scheduledLessonCount: "3", hoursPerLesson: 2 })).toBeNull();
  });

  it("rejects missing / out-of-range values in order", () => {
    expect(validateShortCaseInputs({ scheduledLessonCount: null, hoursPerLesson: 1 })).toBe(
      "COUNT_REQUIRED",
    );
    expect(validateShortCaseInputs({ scheduledLessonCount: 6, hoursPerLesson: 1 })).toBe(
      "COUNT_RANGE",
    );
    expect(validateShortCaseInputs({ scheduledLessonCount: 3, hoursPerLesson: null })).toBe(
      "HOURS_REQUIRED",
    );
    expect(validateShortCaseInputs({ scheduledLessonCount: 3, hoursPerLesson: 1.3 })).toBe(
      "HOURS_INVALID",
    );
  });

  it("hours predicate matches the DB CHECK values", () => {
    expect(isShortCaseHours(1)).toBe(true);
    expect(isShortCaseHours(1.5)).toBe(true);
    expect(isShortCaseHours(2)).toBe(true);
    expect(isShortCaseHours("1.5")).toBe(true);
    expect(isShortCaseHours(0.5)).toBe(false);
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
