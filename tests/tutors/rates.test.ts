import { describe, expect, it } from "vitest";

import {
  computeSuggestedRates,
  isValidTutorRate,
  medianRate,
  normalizeTutorRateRows,
  roundRateTo10,
} from "../../src/features/tutors/rates";

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

describe("computeSuggestedRates", () => {
  const card = (online: number | null, inperson: number | null) => ({
    online_rate: online,
    inperson_rate: inperson,
  });

  it("returns not_enough_data under ten similar cards", () => {
    const cards = Array.from({ length: 9 }, () => card(200, 400));
    expect(computeSuggestedRates(cards)).toEqual({ status: "not_enough_data" });
  });

  it("fills each mode from its own median, rounded to $10", () => {
    const cards = [...Array.from({ length: 10 }, () => card(200, 400)), card(300, null)];
    const result = computeSuggestedRates(cards);
    expect(result).toEqual({ status: "ok", online: 200, inPerson: 400 });
  });

  it("a single $3000 card does not skew the median", () => {
    const cards = [...Array.from({ length: 12 }, () => card(200, 200)), card(3000, 3000)];
    const result = computeSuggestedRates(cards);
    expect(result).toEqual({ status: "ok", online: 200, inPerson: 200 });
  });

  it("suggests base fields only (extra rows never appear)", () => {
    const result = computeSuggestedRates(Array.from({ length: 10 }, () => card(150, 250)));
    expect(result).toEqual({ status: "ok", online: 150, inPerson: 250 });
    expect(JSON.stringify(result)).not.toContain("label");
  });
});
