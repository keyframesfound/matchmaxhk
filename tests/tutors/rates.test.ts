import { describe, expect, it } from "vitest";

import {
  computeSuggestedRates,
  groupRateFloor,
  isGroupRateRow,
  isValidTutorRate,
  medianRate,
  normalizeTutorRateRows,
  roundRateTo10,
  SUGGEST_MIN_SIMILAR,
  tutorCardIsSimilar,
} from "../../src/features/tutors/rates";

const normalizeKey = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

describe("isValidTutorRate", () => {
  it("accepts whole dollars inside the 50-3000 band", () => {
    expect(isValidTutorRate(50)).toBe(true);
    expect(isValidTutorRate(3000)).toBe(true);
    expect(isValidTutorRate(200)).toBe(true);
  });

  it("rejects out-of-band, decimal and non-number values", () => {
    expect(isValidTutorRate(49)).toBe(false);
    expect(isValidTutorRate(3001)).toBe(false);
    expect(isValidTutorRate(250.5)).toBe(false);
    expect(isValidTutorRate("200")).toBe(false);
    expect(isValidTutorRate(null)).toBe(false);
  });
});

describe("normalizeTutorRateRows", () => {
  it("drops completely empty rows and keeps filled ones", () => {
    const result = normalizeTutorRateRows([
      { label: "", rate: "" },
      { label: "IGCSE", rate: 100 },
      { label: "  ", rate: null },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toEqual([{ label: "IGCSE", rate: 100 }]);
  });

  it("rejects a half-filled row (label without rate, rate without label)", () => {
    const noRate = normalizeTutorRateRows([{ label: "IGCSE", rate: null }]);
    expect(noRate.ok).toBe(false);
    const noLabel = normalizeTutorRateRows([{ label: "", rate: 100 }]);
    expect(noLabel.ok).toBe(false);
  });

  it("rejects out-of-band rates on extra rows", () => {
    const result = normalizeTutorRateRows([{ label: "IGCSE", rate: 49 }]);
    expect(result.ok).toBe(false);
  });

  it("caps stored rows at six and reports the error", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ label: `R${i}`, rate: 100 + i }));
    const result = normalizeTutorRateRows(rows);
    expect(result.ok).toBe(false);
    expect(result.rows).toHaveLength(6);
  });

  it("contact-filters the label", () => {
    const result = normalizeTutorRateRows([{ label: "WhatsApp me 91234567", rate: 100 }]);
    expect(result.ok).toBe(false);
  });
});

describe("medianRate + rounding", () => {
  it("median ignores position, not extremes", () => {
    expect(medianRate([3000, 200, 250])).toBe(250);
    expect(medianRate([200, 300])).toBe(250);
    expect(medianRate([])).toBeNull();
  });

  it("rounds to the nearest $10 ($247 -> $250)", () => {
    expect(roundRateTo10(247)).toBe(250);
    expect(roundRateTo10(244)).toBe(240);
  });
});

describe("tutorCardIsSimilar", () => {
  const subjects = new Set(["maths", "physics"]);
  const curricula = new Set(["ib diploma", "dse"]);

  it("matches a shared subject (case/space-insensitive)", () => {
    expect(
      tutorCardIsSimilar(
        { subjects: ["  MATHS "], pricing_tiers: [] },
        subjects,
        curricula,
        normalizeKey,
      ),
    ).toBe(true);
  });

  it("matches a shared pricing-tier curriculum", () => {
    expect(
      tutorCardIsSimilar(
        { subjects: ["chemistry"], pricing_tiers: [{ curriculum: "IB Diploma", rate: 500 }] },
        subjects,
        curricula,
        normalizeKey,
      ),
    ).toBe(true);
  });

  it("is false when nothing overlaps", () => {
    expect(
      tutorCardIsSimilar(
        { subjects: ["chemistry"], pricing_tiers: [{ curriculum: "A-Level", rate: 500 }] },
        subjects,
        curricula,
        normalizeKey,
      ),
    ).toBe(false);
  });

  it("tolerates null/missing columns", () => {
    expect(
      tutorCardIsSimilar(
        { subjects: null, pricing_tiers: null },
        subjects,
        curricula,
        normalizeKey,
      ),
    ).toBe(false);
  });
});

describe("computeSuggestedRates", () => {
  const card = (online: number | null, inperson: number | null) => ({
    online_rate: online,
    inperson_rate: inperson,
  });

  it(`returns not_enough_data under ${SUGGEST_MIN_SIMILAR} similar cards`, () => {
    const cards = Array.from({ length: SUGGEST_MIN_SIMILAR - 1 }, () => card(200, 400));
    expect(computeSuggestedRates(cards)).toEqual({ status: "not_enough_data" });
  });

  it("fills each mode from its own median, rounded to $10", () => {
    const cards = [
      ...Array.from({ length: SUGGEST_MIN_SIMILAR }, () => card(200, 400)),
      card(300, null),
    ];
    const result = computeSuggestedRates(cards);
    expect(result).toEqual({ status: "ok", online: 200, inPerson: 400 });
  });

  it("a single $3000 card does not skew the median", () => {
    const cards = [...Array.from({ length: 12 }, () => card(200, 200)), card(3000, 3000)];
    const result = computeSuggestedRates(cards);
    expect(result).toEqual({ status: "ok", online: 200, inPerson: 200 });
  });

  it("suggests base fields only (extra rows never appear)", () => {
    const result = computeSuggestedRates(
      Array.from({ length: SUGGEST_MIN_SIMILAR }, () => card(150, 250)),
    );
    expect(result).toEqual({ status: "ok", online: 150, inPerson: 250 });
    expect(JSON.stringify(result)).not.toContain("label");
  });
});

describe("rate row mode tags + group floor (#391)", () => {
  it("keeps mode and a contact-filtered description on the saved row", () => {
    const result = normalizeTutorRateRows([
      {
        label: "IBDP Maths",
        rate: 220,
        mode: "small_group_2",
        description: "30 mins core concepts + 30 mins past-paper drilling.",
      },
    ]);
    expect(result).toEqual({
      ok: true,
      rows: [
        {
          label: "IBDP Maths",
          rate: 220,
          mode: "small_group_2",
          description: "30 mins core concepts + 30 mins past-paper drilling.",
        },
      ],
    });
  });

  it("rejects an unknown mode", () => {
    const result = normalizeTutorRateRows([{ label: "A", rate: 200, mode: "mega_class" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/unknown class mode/);
  });

  it("rejects an over-long description", () => {
    const result = normalizeTutorRateRows([
      { label: "A", rate: 200, description: "x".repeat(301) },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/300 characters or fewer/);
  });

  it("contact-filters the description", () => {
    const result = normalizeTutorRateRows([
      { label: "A", rate: 200, description: "WhatsApp me at 91234567" },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });

  it("legacy rows without mode/description stay unchanged", () => {
    const result = normalizeTutorRateRows([{ label: "Admissions", rate: 800 }]);
    expect(result).toEqual({ ok: true, rows: [{ label: "Admissions", rate: 800 }] });
  });

  it("groupRateFloor takes the cheapest small-group row and ignores 1-on-1/bootcamp rows", () => {
    expect(
      groupRateFloor([
        { label: "Base", rate: 500, mode: "one_on_one" },
        { label: "Pair", rate: 300, mode: "small_group_2" },
        { label: "Trio+", rate: 260, mode: "small_group_3_6" },
        { label: "Bootcamp", rate: 100, mode: "intensive_bootcamp" },
      ]),
    ).toBe(260);
    expect(groupRateFloor([{ label: "Base", rate: 200, mode: "one_on_one" }])).toBeNull();
    expect(groupRateFloor([])).toBeNull();
    // Legacy rows carry no mode — they never read as group rates.
    expect(groupRateFloor([{ label: "Legacy", rate: 100 }])).toBeNull();
  });

  it("isGroupRateRow matches only the two small-group modes", () => {
    expect(isGroupRateRow({ mode: "small_group_2" })).toBe(true);
    expect(isGroupRateRow({ mode: "small_group_3_6" })).toBe(true);
    expect(isGroupRateRow({ mode: "intensive_bootcamp" })).toBe(false);
    expect(isGroupRateRow({ mode: null })).toBe(false);
  });
});
