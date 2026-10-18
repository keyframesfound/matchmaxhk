// Issues #113/#114 — pure display-currency helpers + the application→card
// currency mapping. Rates are fabricated HKD→X rows (units of X per 1 HKD).
import { describe, expect, it } from "vitest";

import {
  approxHkdText,
  convertedTextFromHkd,
  nativeToDisplayText,
  readStoredCurrency,
} from "@/features/currency/convert";
import { caseBudgetForTutor } from "@/features/cases/display";
import { buildTutorCardInsert } from "@/lib/tutor-card-mapping";
import { DEFAULT_CURRENCY, toHkdRates, type HkdRates } from "@/lib/money";

const RATES: HkdRates = toHkdRates([
  { source_currency: "HKD", target_currency: "USD", rate: 0.128 },
  { source_currency: "HKD", target_currency: "GBP", rate: 0.1 },
]);

describe("convertedTextFromHkd", () => {
  it("returns null for HKD display (caller keeps existing rendering)", () => {
    expect(convertedTextFromHkd(400, DEFAULT_CURRENCY, RATES)).toBeNull();
  });

  it("converts through the rate table and formats with the display symbol", () => {
    expect(convertedTextFromHkd(400, "GBP", RATES)).toBe("£40");
  });

  it("returns null when the rate is missing — never breaks a price", () => {
    expect(convertedTextFromHkd(400, "CNY", {})).toBeNull();
  });
});

describe("nativeToDisplayText", () => {
  it("returns null when native equals display", () => {
    expect(nativeToDisplayText(250, "GBP", "GBP", RATES)).toBeNull();
  });

  it("converts a native rate into the display currency", () => {
    // 400 HKD → GBP at 0.1 → 40
    expect(nativeToDisplayText(400, "HKD", "GBP", RATES)).toBe("£40");
  });
});

describe("approxHkdText", () => {
  it("returns null for HKD input or non-positive/empty values", () => {
    expect(approxHkdText(400, "HKD", RATES)).toBeNull();
    expect(approxHkdText(0, "GBP", RATES)).toBeNull();
    expect(approxHkdText(Number.NaN, "GBP", RATES)).toBeNull();
  });

  it("shows the HKD equivalent of a native input", () => {
    // £400 at 0.1 GBP per HKD → 4000 HKD
    expect(approxHkdText(400, "GBP", RATES)).toBe("HK$4,000");
  });
});

describe("caseBudgetForTutor", () => {
  const item = { budgetMin: 400, budgetMax: 500, budgetMinHkd: 400, budgetMaxHkd: 500 };

  it("returns the plain HKD bounds for HKD-quoting tutors", () => {
    const { primary, original } = caseBudgetForTutor(item, "HKD", RATES);
    expect(primary).toBeNull();
    expect(original).toBe("HK$400–500/hr");
  });

  it("converts the bounds and keeps the HKD original beside them", () => {
    const { primary, original } = caseBudgetForTutor(item, "GBP", RATES);
    expect(primary).toBe("£40–£50/hr");
    expect(original).toBe("HK$400–500/hr");
  });

  it("falls back to HKD when rates are missing", () => {
    const { primary, original } = caseBudgetForTutor(item, "USD", {});
    expect(primary).toBeNull();
    expect(original).toBe("HK$400–500/hr");
  });
});

describe("buildTutorCardInsert currency (#113)", () => {
  const base = {
    name: "Test Tutor",
    format: "Both",
    status: "uni_student",
    startImmediately: true,
    startDate: "",
    selfIntroduction: "Hello",
    curriculum: "IBDP",
    overallScore: 40,
    academicHeadline: "IBDP Tutor",
    awards: "",
    achievements: [],
    subjectsConfident: "Mathematics",
    medium: "English",
    locations: "Central",
    university: null,
    programme: null,
    graduationYear: null,
    hasPostgrad: false,
    highSchool: "Not provided",
    senEnabled: false,
    senCategories: [],
    onlineRate: 250,
    inpersonRate: 300,
    rateRows: [],
    travelNote: "",
    rateNote: "",
    pricingStandardized: true,
    pricingTiers: [],
  } as unknown as Parameters<typeof buildTutorCardInsert>[0];

  it("carries the application's quoting currency through to the card", () => {
    const insert = buildTutorCardInsert({ ...base, currency: "GBP" }, "MM-T000");
    expect(insert.currency).toBe("GBP");
  });

  it("falls back to HKD for legacy applications without a currency", () => {
    const insert = buildTutorCardInsert(base, "MM-T000");
    expect(insert.currency).toBe("HKD");
  });
});

describe("readStoredCurrency", () => {
  it("coerces corrupt or missing values to HKD", () => {
    expect(readStoredCurrency(null)).toBe("HKD");
    expect(readStoredCurrency({ getItem: () => "XXX" } as Pick<Storage, "getItem">)).toBe("HKD");
    expect(readStoredCurrency({ getItem: () => "GBP" } as Pick<Storage, "getItem">)).toBe("GBP");
  });
});
