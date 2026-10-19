import { describe, it, expect } from "vitest";

import {
  kindergartenActiveToggles,
  kindergartenParamPatch,
  matchesFieldOfStudyFilter,
  matchesKeywordHaystack,
  matchesTierFilter,
  parseTierParam,
  parseToggleParam,
  tierSwitchPatch,
} from "../../src/features/tutors/search-tiers";

/**
 * Issue #190 slice — pure helpers behind the /tutors academic-tier tabs:
 * tier gating over target_students, the university-tab keyword haystack
 * (course codes included), and the URL-param parsing for `tier` and the
 * kindergarten toggles (TanStack params arrive JSON-decoded).
 */

describe("parseTierParam (JSON-decode gotcha)", () => {
  it("accepts the exact canonical strings only", () => {
    expect(parseTierParam("kindergarten")).toBe("kindergarten");
    expect(parseTierParam("primary_secondary")).toBe("primary_secondary");
    expect(parseTierParam("university")).toBe("university");
  });

  it("rejects junk, casing variants and non-strings", () => {
    expect(parseTierParam("University")).toBe(null);
    expect(parseTierParam(" university ")).toBe(null);
    expect(parseTierParam("ibdp")).toBe(null);
    expect(parseTierParam(1)).toBe(null);
    expect(parseTierParam(undefined)).toBe(null);
    expect(parseTierParam(null)).toBe(null);
  });
});

describe("parseToggleParam (string 'true' and boolean true)", () => {
  it("accepts boolean true and the string 'true'", () => {
    expect(parseToggleParam(true)).toBe(true);
    expect(parseToggleParam("true")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(parseToggleParam("True")).toBe(false);
    expect(parseToggleParam(1)).toBe(false);
    expect(parseToggleParam("1")).toBe(false);
    expect(parseToggleParam(undefined)).toBe(false);
  });
});

describe("matchesTierFilter (cold-start gating)", () => {
  it("legacy tutors with no tier data stay on the default tab only", () => {
    expect(matchesTierFilter("primary_secondary", [])).toBe(true);
    expect(matchesTierFilter("kindergarten", [])).toBe(false);
    expect(matchesTierFilter("university", [])).toBe(false);
    expect(matchesTierFilter("primary_secondary", ["IBDP"])).toBe(true);
  });

  it("vertical tutors land on their tab; exclusively-vertical tutors leave the default", () => {
    expect(matchesTierFilter("kindergarten", ["Kindergarten"])).toBe(true);
    expect(matchesTierFilter("primary_secondary", ["Kindergarten"])).toBe(false);
    expect(matchesTierFilter("university", ["University"])).toBe(true);
    expect(matchesTierFilter("primary_secondary", ["University"])).toBe(false);
    expect(matchesTierFilter("university", ["University", "Primary"])).toBe(true);
    expect(matchesTierFilter("primary_secondary", ["University", "Primary"])).toBe(true);
  });
});

describe("matchesKeywordHaystack (university course codes)", () => {
  it("matches subjects through matchesSubjectQuery", () => {
    expect(matchesKeywordHaystack("math", ["Mathematics"], [])).toBe(true);
    expect(matchesKeywordHaystack("economics", ["Biology"], [])).toBe(false);
  });

  it("indexes extraTexts so 'ECON1210' finds course-tagged tutors", () => {
    expect(matchesKeywordHaystack("ECON1210", ["Economics"], ["ECON1210", "ACCT1101"])).toBe(
      true,
    );
    expect(matchesKeywordHaystack("ECON1210", ["Economics"], ["ACCT1101"])).toBe(false);
  });

  it("empty query matches everything", () => {
    expect(matchesKeywordHaystack("  ", [], [])).toBe(true);
  });
});

describe("matchesFieldOfStudyFilter (text-contains over degrees)", () => {
  it("matches when either degree field contains the field of study", () => {
    expect(
      matchesFieldOfStudyFilter("Engineering", {
        undergradDegree: "BEng Mechanical Engineering",
        postgradDegree: null,
      }),
    ).toBe(true);
    expect(
      matchesFieldOfStudyFilter("Medicine", {
        undergradDegree: "BSc Computer Science",
        postgradDegree: "Master of Medicine",
      }),
    ).toBe(true);
  });

  it("is case-insensitive and rejects non-matching degrees", () => {
    expect(
      matchesFieldOfStudyFilter("law", { undergradDegree: "Bachelor of Laws", postgradDegree: null }),
    ).toBe(true);
    expect(
      matchesFieldOfStudyFilter("Medicine", { undergradDegree: "BA English", postgradDegree: null }),
    ).toBe(false);
    expect(
      matchesFieldOfStudyFilter("Medicine", { undergradDegree: null, postgradDegree: null }),
    ).toBe(false);
  });

  it("empty field matches every tutor", () => {
    expect(matchesFieldOfStudyFilter("", { undergradDegree: null, postgradDegree: null })).toBe(
      true,
    );
    expect(matchesFieldOfStudyFilter(undefined, {})).toBe(true);
  });
});

describe("kindergarten toggle <-> param mapping", () => {
  it("reads the k_* params into the matchesKindergartenFilter shape", () => {
    expect(
      kindergartenActiveToggles({ k_phonics: "true", k_interview: true }),
    ).toEqual({ phonics: true, mandarin: undefined, interviewPrep: true });
    expect(kindergartenActiveToggles({})).toEqual({
      phonics: undefined,
      mandarin: undefined,
      interviewPrep: undefined,
    });
    expect(kindergartenActiveToggles({ k_mandarin: "false" })).toEqual({
      phonics: undefined,
      mandarin: undefined,
      interviewPrep: undefined,
    });
  });

  it("writes a full reset patch from the selected keys", () => {
    expect(kindergartenParamPatch(["phonics"])).toEqual({
      k_phonics: true,
      k_mandarin: undefined,
      k_interview: undefined,
    });
    expect(kindergartenParamPatch([])).toEqual({
      k_phonics: undefined,
      k_mandarin: undefined,
      k_interview: undefined,
    });
  });

  it("round-trips param -> toggles -> param", () => {
    const toggles = kindergartenActiveToggles({ k_mandarin: "true" });
    const keys = (
      Object.entries(toggles) as Array<[keyof typeof toggles, boolean | undefined]>
    )
      .filter(([, active]) => active === true)
      .map(([key]) => key);
    expect(kindergartenParamPatch(keys)).toEqual({
      k_phonics: undefined,
      k_mandarin: true,
      k_interview: undefined,
    });
  });
});

describe("tierSwitchPatch (reset vertical params, keep q/subject)", () => {
  it("clears every vertical-specific param and carries the new tier", () => {
    expect(tierSwitchPatch("university")).toEqual({
      tier: "university",
      category: undefined,
      subjects_extra: undefined,
      university: undefined,
      high_school: undefined,
      major: undefined,
      field: undefined,
      k_phonics: undefined,
      k_mandarin: undefined,
      k_interview: undefined,
    });
  });

  it("carries the kindergarten tier too", () => {
    expect(tierSwitchPatch("kindergarten").tier).toBe("kindergarten");
  });
});
