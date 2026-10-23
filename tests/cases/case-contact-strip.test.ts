import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Issue #410: the two remaining parent-authored free-text case fields on
// PUBLIC_CASE_COLUMNS — description (from data.notes) and target_school
// (admissions path) — run through the shared contact filter inside
// submitCaseRequest before insert, mirroring the #396 uni-field strip:
// matches are STRIPPED, never rejected, on the parent path.
import { hasContactDetails, sanitizeCaseFreeText } from "../../src/lib/contact-filter";

describe("sanitizeCaseFreeText (submitCaseRequest description/target_school path)", () => {
  it("strips phone numbers", () => {
    expect(sanitizeCaseFreeText("call 9123 4567 please", 2000)).toBe("call please");
    expect(sanitizeCaseFreeText("call +852 9123 4567 please", 2000)).toBe("call please");
  });

  it("strips wa.me / URL links", () => {
    expect(sanitizeCaseFreeText("see https://wa.me/85291234567 now", 2000)).toBe("see now");
    expect(sanitizeCaseFreeText("www.spam.example.com", 2000)).toBeNull();
  });

  it("strips channel words (WhatsApp / Instagram / ig)", () => {
    expect(sanitizeCaseFreeText("add my WhatsApp", 2000)).toBe("add my");
    expect(sanitizeCaseFreeText("DM me on Instagram or add my ig", 2000)).toBe(
      "DM me on or add my",
    );
  });

  it("strips email addresses", () => {
    expect(sanitizeCaseFreeText("ping me@example.com ok", 2000)).toBe("ping ok");
  });

  it("runs to a fixpoint: cannot reconstitute a number split across a stripped token", () => {
    // Same GLM-round-1 shape as #396: "9123 foo@bar.com 4567" strips to
    // "9123   4567"; collapsing the whitespace would stitch it back into
    // the canonical number, so the collapsed output is re-stripped.
    expect(sanitizeCaseFreeText("9123 foo@bar.com 4567", 2000)).toBeNull();
    expect(sanitizeCaseFreeText("9123 whatsapp 4567", 2000)).toBeNull();
  });

  it("keeps ordinary free text intact", () => {
    const text = "Please help with S4 English writing and exam techniques";
    expect(sanitizeCaseFreeText(text, 2000)).toBe(text);
    const school = "St. Paul's Co-ed, admissions interview prep";
    expect(sanitizeCaseFreeText(school, 120)).toBe(school);
  });

  it("leaves year/course-level ranges intact (strip-mode guards)", () => {
    const text = "past papers 2015-2019 and 3000-4000 level courses";
    expect(sanitizeCaseFreeText(text, 2000)).toBe(text);
  });

  it("caps the stored value and maps blanks/non-strings to null", () => {
    expect(sanitizeCaseFreeText("x".repeat(30), 10)).toBe("x".repeat(10));
    expect(sanitizeCaseFreeText("   ", 2000)).toBeNull();
    expect(sanitizeCaseFreeText(undefined, 120)).toBeNull();
    expect(sanitizeCaseFreeText(null, 120)).toBeNull();
  });

  it("strips everything dirty and never throws (no hard reject)", () => {
    const dirty = "Need admissions tutor, WhatsApp 9123 4567 or parent@school.edu.hk, www.tutor.hk";
    let out: string | null = null;
    expect(() => {
      out = sanitizeCaseFreeText(dirty, 2000);
    }).not.toThrow();
    expect(hasContactDetails(out ?? "")).toBe(false);
  });
});

describe("submitCaseRequest wiring (source assertion)", () => {
  // TanStack Start server fns cannot run end-to-end under vitest, so the
  // wiring is asserted against the source, mirroring the
  // tests/reports/material-uphold.test.ts pattern.
  const source = readFileSync("src/lib/cases.functions.ts", "utf8");

  it("routes description through sanitizeCaseFreeText", () => {
    expect(source).toMatch(/description:\s*sanitizeCaseFreeText\(data\.notes,\s*2000\)/);
  });

  it("routes target_school through sanitizeCaseFreeText on the admissions path", () => {
    expect(source).toMatch(/sanitizeCaseFreeText\(data\.targetSchool,\s*120\)/);
  });

  it("builds the stored title from the sanitized target school, not the raw one", () => {
    // GLM round-2 blocker: `title` interpolates targetSchool on the
    // admissions path AND is itself a PUBLIC_CASE_COLUMNS column, so the
    // raw string must never reach buildCaseTitle — the hoisted
    // cleanTargetSchool feeds both the title and the column.
    expect(source).toMatch(
      /const cleanTargetSchool =[\s\S]*?sanitizeCaseFreeText\(data\.targetSchool,\s*120\)/,
    );
    expect(source).toMatch(
      // #423 sections 2+3: the stored title IS the structured EN auto-title
      // (buildStructuredTitle over the tier-consistent fields); the legacy
      // builder remains only as the fallback for rows the structured fields
      // can't express — still fed cleanTargetSchool, never the raw string.
      /title:\s*\n?\s*storedTitle \|\|\s*\n?\s*buildCaseTitle\(\{\s*\.\.\.data,\s*targetSchool:\s*cleanTargetSchool,\s*subjects:\s*tierConsistent\.subjects,?\s*\}\)/,
    );
    expect(source).toMatch(
      /const storedTitle = buildStructuredTitle\(\s*\{[\s\S]*?curriculum:\s*tierConsistent\.curriculum,[\s\S]*?subjects:\s*tierConsistent\.subjects,/,
    );
    expect(source).toMatch(/target_school:\s*cleanTargetSchool/);
  });

  it("no longer stores raw parent notes/target school verbatim", () => {
    expect(source).not.toMatch(/description:\s*data\.notes/);
    expect(source).not.toMatch(/target_school:\s*data\.targetSchool/);
    expect(source).not.toMatch(/title:\s*buildCaseTitle\(data\)/);
  });
});
