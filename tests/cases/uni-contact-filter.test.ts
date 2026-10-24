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

  it("leaves year/course-level ranges intact (strip-mode guards)", () => {
    // GLM review round 1, finding 2: the loose detection pattern flags
    // these, but silent stripping must not eat legitimate ranges.
    const ranges = [
      "ECON1210, MATH2010-2011 syllabus",
      "need help with 3000-4000 level MATH courses",
      "past papers 2015-2019",
    ];
    for (const text of ranges) expect(stripContactDetails(text)).toBe(text);
  });

  it("leaves space-separated year pairs intact (GLM round 2, MINOR)", () => {
    // Same guard rule extended to the space form: year halves share >=2
    // digit positions, a dialling number (9123 4567) shares none.
    expect(stripContactDetails("past papers 2010 2011")).toBe("past papers 2010 2011");
    expect(stripContactDetails("papers 2010 2011 2012 2013")).toBe("papers 2010 2011 2012 2013");
  });

  it("still strips real phone forms", () => {
    expect(stripContactDetails("call 91234567 please")).toBe("call   please");
    expect(stripContactDetails("call 9123-4567 please")).toBe("call   please");
    expect(stripContactDetails("call 9123 4567 please")).toBe("call   please");
    expect(stripContactDetails("call +852 9123 4567 please")).toBe("call   please");
  });

  it("still strips ambiguous 4+4 space pairs that are not year shapes (residual)", () => {
    // "2100 2021" is a valid landline shape (2xxx xxxx) and its halves
    // share only one digit position — same accepted residual as the
    // hyphenated "2547-2549" escape documented in round 1. The strip is
    // the safe side of an inherently ambiguous string.
    expect(stripContactDetails("CSCI 2100 2021")).toBe("CSCI  ");
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

  it("iterates to a fixpoint: cannot reconstitute a number split across a stripped token", () => {
    // GLM review round 1, finding 1: "9123 foo@bar.com 4567" strips to
    // "9123   4567"; the whitespace collapse alone would stitch it into
    // the canonical "9123 4567" — so the collapsed output is re-stripped.
    expect(sanitizeCaseUniText("9123 foo@bar.com 4567", 2000)).toBeNull();
    expect(sanitizeCaseUniText("9123 whatsapp 4567", 2000)).toBeNull();
  });

  it("keeps year/course-level ranges in the stored text", () => {
    expect(sanitizeCaseUniText("ECON1210, MATH2010-2011 syllabus", 2000)).toBe(
      "ECON1210, MATH2010-2011 syllabus",
    );
    expect(sanitizeCaseUniText("need help with 3000-4000 level MATH courses", 2000)).toBe(
      "need help with 3000-4000 level MATH courses",
    );
    expect(sanitizeCaseUniText("past papers 2015-2019", 2000)).toBe("past papers 2015-2019");
  });

  it("caps the stored value and maps blanks to null", () => {
    expect(sanitizeCaseUniText("x".repeat(30), 10)).toBe("x".repeat(10));
    expect(sanitizeCaseUniText("   ", 80)).toBeNull();
    expect(sanitizeCaseUniText(undefined, 80)).toBeNull();
  });
});
