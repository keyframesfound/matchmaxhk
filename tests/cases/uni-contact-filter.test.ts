import { describe, expect, it } from "vitest";

// Issue #396: uni free-text case fields (uni_course_codes and the other uni
// columns whitelisted in PUBLIC_CASE_COLUMNS) run through the shared
// contact filter before they can reach the public board — matches are
// STRIPPED, never rejected, on both the parent submit path (buildVerticalInsert,
// which submitCaseRequest calls) and the admin case editor save
// (sanitizeCaseUniText directly).
import { buildVerticalInsert, sanitizeCaseUniText } from "../../src/features/cases/case-verticals";
import { hasContactDetails, stripContactDetails } from "../../src/lib/contact-filter";

const uniRequest = (uniCourseCodes: string) =>
  buildVerticalInsert({
    academicLevel: "University",
    uniCourseCodes,
  });

describe("stripContactDetails", () => {
  it("removes phone numbers, emails, URLs and channel words", () => {
    // Raw removal — whitespace collapsing is the caller's job
    // (sanitizeCaseUniText does it before storage).
    expect(stripContactDetails("call 9123 4567 please")).toBe("call   please");
    expect(stripContactDetails("ping me@example.com ok")).toBe("ping   ok");
    expect(stripContactDetails("see https://wa.me/85291234567 now")).toBe("see   now");
    expect(stripContactDetails("add my WhatsApp")).toBe("add my  ");
  });

  it("keeps ordinary course text untouched", () => {
    const text = "ECON1210, MATH2010 — need help with problem sets and exam prep";
    expect(stripContactDetails(text)).toBe(text);
  });

  it("leaves no filter violation behind after stripping", () => {
    const dirty =
      "ECON1210 tutor needed, contact 9123 4567 or jane@example.com, www.tutor.hk, on WhatsApp";
    expect(hasContactDetails(stripContactDetails(dirty))).toBe(false);
  });
});

describe("buildVerticalInsert contact filtering (submitCaseRequest path)", () => {
  it("strips contact details from uni_course_codes", () => {
    const row = uniRequest(
      "ECON1210 MATH2010 — WhatsApp me at 9123 4567 or www.tutor.hk for details",
    );
    expect(row.uni_course_codes).toBe("ECON1210 MATH2010 — me at or for details");
    expect(row.uni_course_codes ?? "").not.toContain("9123");
    expect(row.uni_course_codes ?? "").not.toContain("wa");
    expect(hasContactDetails(row.uni_course_codes ?? "")).toBe(false);
  });

  it("never rejects — a fully dirty course box stores null, not an error", () => {
    expect(() => uniRequest("call 9123 4567 on WhatsApp")).not.toThrow();
    expect(uniRequest("call 9123 4567 on WhatsApp").uni_course_codes).toBe("call on");
    expect(uniRequest("www.spam.example.com").uni_course_codes).toBeNull();
  });

  it("keeps clean uni free text intact", () => {
    const row = uniRequest("ECON1210, FINA2320 — past paper practice, midterm revision");
    expect(row.uni_course_codes).toBe("ECON1210, FINA2320 — past paper practice, midterm revision");
  });

  it("strips the other public uni free-text fields too", () => {
    const row = buildVerticalInsert({
      academicLevel: "University",
      uniName: "HKU WhatsApp group",
      uniField: "Engineering 9123 4567",
      uniProgram: "BEng https://spam.example.com",
    });
    expect(row.uni_name).toBe("HKU group");
    expect(row.uni_field).toBe("Engineering");
    expect(row.uni_program).toBe("BEng");
  });

  it("still nulls uni fields on non-university tiers", () => {
    const row = buildVerticalInsert({
      academicLevel: "Primary",
      uniCourseCodes: "ECON1210",
    });
    expect(row.uni_course_codes).toBeNull();
  });
});

describe("sanitizeCaseUniText (admin case editor save path)", () => {
  it("strips contact matches and collapses leftover whitespace", () => {
    expect(sanitizeCaseUniText("ECON  1210  call 9123-4567", 2000)).toBe("ECON 1210 call");
  });

  it("caps the stored value and maps blanks to null", () => {
    expect(sanitizeCaseUniText("x".repeat(30), 10)).toBe("x".repeat(10));
    expect(sanitizeCaseUniText("   ", 80)).toBeNull();
    expect(sanitizeCaseUniText(undefined, 80)).toBeNull();
  });
});
