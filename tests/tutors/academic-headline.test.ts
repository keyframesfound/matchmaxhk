import { describe, it, expect } from "vitest";

import {
  MAX_ACADEMIC_HEADLINE,
  academicHeadlineError,
  buildAcademicHeadline,
  isDefaultHeadline,
} from "../../src/lib/academic-headline";

/**
 * Issue #323 — smart headline rules, tested as pure functions (server fns
 * are not testable end-to-end; the headline builder is the vitest target).
 */

describe("buildAcademicHeadline (#323 auto-fill rules)", () => {
  it("Rule 1: curriculum + score", () => {
    expect(buildAcademicHeadline([{ curriculum: "IBDP", score: "44/45" }])).toBe("IBDP 44/45");
  });

  it("Rule 2: multiple curricula joined with ' - '", () => {
    expect(
      buildAcademicHeadline([
        { curriculum: "IBDP", score: "44/45" },
        { curriculum: "IGCSE / GCSE", score: "9A*" },
      ]),
    ).toBe("IBDP 44/45 - IGCSE / GCSE 9A*");
  });

  it("Rule 3: curriculum without score gets the Tutor suffix", () => {
    expect(buildAcademicHeadline([{ curriculum: "HKDSE", score: "" }])).toBe("HKDSE Tutor");
  });

  it("Rule 3: mixed — scored and unscored entries in one headline", () => {
    expect(
      buildAcademicHeadline([
        { curriculum: "IBDP", score: "42" },
        { curriculum: "A-Level", score: "" },
      ]),
    ).toBe("IBDP 42 - A-Level Tutor");
  });

  it("Rule 4: truncates at 40 chars and trims trailing separators", () => {
    const long = buildAcademicHeadline([
      { curriculum: "IBDP", score: "44/45" },
      { curriculum: "IGCSE", score: "9A*" },
      { curriculum: "HKDSE", score: "5**" },
    ]);
    expect(long.length).toBeLessThanOrEqual(MAX_ACADEMIC_HEADLINE);
    expect(long.endsWith("-")).toBe(false);
    expect(long.endsWith(" ")).toBe(false);
  });

  it("ignores blank entries and returns empty for none", () => {
    expect(buildAcademicHeadline([])).toBe("");
    expect(buildAcademicHeadline([{ curriculum: "  ", score: "44" }])).toBe("");
  });

  it("trims surrounding whitespace in inputs", () => {
    expect(buildAcademicHeadline([{ curriculum: " IBDP ", score: " 44/45 " }])).toBe("IBDP 44/45");
  });
});

describe("isDefaultHeadline (#323 overwrite protection)", () => {
  const entries = [
    { curriculum: "IBDP", score: "44/45" },
    { curriculum: "HKDSE", score: "" },
  ];

  it("saved default matches -> safe to auto-update", () => {
    expect(isDefaultHeadline("IBDP 44/45 - HKDSE Tutor", entries)).toBe(true);
  });

  it("customized headline -> dirty", () => {
    expect(isDefaultHeadline("IBDP 44/45 - HKDSE Tutor - 10 yrs", entries)).toBe(false);
    expect(isDefaultHeadline("Official IB Examiner", entries)).toBe(false);
  });

  it("empty saved headline is never 'default'", () => {
    expect(isDefaultHeadline("", entries)).toBe(false);
    expect(isDefaultHeadline("   ", entries)).toBe(false);
  });

  it("matches after scores changed away from the saved default -> dirty", () => {
    expect(isDefaultHeadline("IBDP 44/45", [{ curriculum: "IBDP", score: "43" }])).toBe(false);
  });
});

describe("academicHeadlineError (#323 validation)", () => {
  it("rejects blank", () => {
    expect(academicHeadlineError("")).toBe("Required");
    expect(academicHeadlineError("   ")).toBe("Required");
  });

  it("rejects over 40 chars", () => {
    expect(academicHeadlineError("x".repeat(41))).toContain("40");
    expect(academicHeadlineError("x".repeat(40))).toBeNull();
  });

  it("rejects contact details", () => {
    expect(academicHeadlineError("Call me 91234567")).not.toBeNull();
    expect(academicHeadlineError("IBDP 44/45")).toBeNull();
  });
});
