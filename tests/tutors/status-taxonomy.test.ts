import { describe, expect, it } from "vitest";

import {
  LEGACY_BUNDLED_STATUS,
  MORE_TUTOR_STATUSES,
  PRIMARY_TUTOR_STATUSES,
  buildStatusParamPatch,
  canonicalTutorStatus,
  isKnownStatusFilterCode,
  isLegacyBundledStatus,
  parseSelectedStatuses,
  parseStatusListParam,
  parseStatusParam,
  tutorMatchesStatusFilter,
  tutorStatusFilterRank,
} from "../../src/features/tutors/status-taxonomy";

describe("canonicalTutorStatus", () => {
  it("maps every canonical code to itself", () => {
    for (const code of [...PRIMARY_TUTOR_STATUSES, ...MORE_TUTOR_STATUSES]) {
      expect(canonicalTutorStatus(code)).toBe(code);
    }
  });

  it("resolves the legacy uni_student rename to uni_undergrad", () => {
    expect(canonicalTutorStatus("uni_student")).toBe("uni_undergrad");
  });

  it("does not resolve the bundled legacy value (no single canonical code)", () => {
    expect(canonicalTutorStatus("full_part_time_tutor")).toBeNull();
  });

  it("returns null for empty, blank and unknown values", () => {
    expect(canonicalTutorStatus(null)).toBeNull();
    expect(canonicalTutorStatus("")).toBeNull();
    expect(canonicalTutorStatus("   ")).toBeNull();
    expect(canonicalTutorStatus("wizard")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(canonicalTutorStatus(" part_time ")).toBe("part_time");
  });
});

describe("isLegacyBundledStatus", () => {
  it("is true only for the exact bundled value", () => {
    expect(isLegacyBundledStatus("full_part_time_tutor")).toBe(true);
    expect(isLegacyBundledStatus(" full_part_time_tutor ")).toBe(true);
    expect(isLegacyBundledStatus("full_time")).toBe(false);
    expect(isLegacyBundledStatus("uni_student")).toBe(false);
    expect(isLegacyBundledStatus(null)).toBe(false);
  });
});

describe("tutorMatchesStatusFilter", () => {
  it("matches exact canonical selections", () => {
    expect(tutorMatchesStatusFilter("full_time", ["full_time"])).toBe(true);
    expect(tutorMatchesStatusFilter("examiner", ["examiner", "full_time"])).toBe(true);
    expect(tutorMatchesStatusFilter("full_time", ["part_time"])).toBe(false);
  });

  it("treats legacy uni_student rows as exact uni_undergrad matches", () => {
    expect(tutorMatchesStatusFilter("uni_student", ["uni_undergrad"])).toBe(true);
    expect(tutorMatchesStatusFilter("uni_student", ["uni_student"])).toBe(true);
    expect(tutorMatchesStatusFilter("uni_undergrad", ["uni_student"])).toBe(true);
    expect(tutorMatchesStatusFilter("uni_student", ["part_time"])).toBe(false);
  });

  it("backfills FT/PT selections with legacy bundled profiles (issue §2.2)", () => {
    expect(tutorMatchesStatusFilter("full_part_time_tutor", ["full_time"])).toBe(true);
    expect(tutorMatchesStatusFilter("full_part_time_tutor", ["part_time"])).toBe(true);
    expect(tutorMatchesStatusFilter("full_part_time_tutor", ["full_time", "part_time"])).toBe(true);
  });

  it("never backfills non-FT/PT selections from bundled rows", () => {
    expect(tutorMatchesStatusFilter("full_part_time_tutor", ["examiner"])).toBe(false);
    expect(tutorMatchesStatusFilter("full_part_time_tutor", ["uni_undergrad"])).toBe(false);
    expect(tutorMatchesStatusFilter("full_part_time_tutor", ["sub_degree"])).toBe(false);
  });

  it("returns false for empty selections, unknown stored values and blanks", () => {
    expect(tutorMatchesStatusFilter("full_time", [])).toBe(false);
    expect(tutorMatchesStatusFilter(null, ["full_time"])).toBe(false);
    expect(tutorMatchesStatusFilter("", ["full_time"])).toBe(false);
    expect(tutorMatchesStatusFilter("unknown_code", ["full_time"])).toBe(false);
  });
});

describe("tutorStatusFilterRank", () => {
  it("ranks exact matches 0", () => {
    expect(tutorStatusFilterRank("full_time", ["full_time"])).toBe(0);
    expect(tutorStatusFilterRank("uni_student", ["uni_undergrad"])).toBe(0);
    expect(tutorStatusFilterRank("examiner", ["examiner", "part_time"])).toBe(0);
  });

  it("ranks legacy bundled rows pulled in by the FT/PT backfill 1", () => {
    expect(tutorStatusFilterRank("full_part_time_tutor", ["full_time"])).toBe(1);
    expect(tutorStatusFilterRank("full_part_time_tutor", ["part_time"])).toBe(1);
  });

  it("ranks an explicit bundled-value selection 0 (parent asked for it)", () => {
    expect(tutorStatusFilterRank("full_part_time_tutor", [LEGACY_BUNDLED_STATUS])).toBe(0);
  });

  it("returns -1 for non-matches", () => {
    expect(tutorStatusFilterRank("full_time", ["part_time"])).toBe(-1);
    expect(tutorStatusFilterRank(null, ["full_time"])).toBe(-1);
  });
});

describe("parseSelectedStatuses", () => {
  it("unions the first pick with the extras and dedupes", () => {
    expect(parseSelectedStatuses("full_time", "part_time||full_time")).toEqual([
      "full_time",
      "part_time",
    ]);
  });

  it("drops unknown and blank values", () => {
    expect(parseSelectedStatuses("wizard", "full_time||")).toEqual(["full_time"]);
    expect(parseSelectedStatuses("", "")).toEqual([]);
    expect(parseSelectedStatuses(null, null)).toEqual([]);
  });
});

describe("buildStatusParamPatch", () => {
  it("leads with the first pick and joins the rest", () => {
    expect(buildStatusParamPatch(["part_time", "full_time"])).toEqual({
      status: "part_time",
      statuses_extra: "full_time",
    });
  });

  it("clears both params when the pick is empty", () => {
    expect(buildStatusParamPatch([])).toEqual({ status: undefined, statuses_extra: undefined });
  });
});

describe("total search-param preprocessors (TanStack JSON-decode gotcha)", () => {
  it("parseStatusParam keeps strings", () => {
    expect(parseStatusParam("full_time")).toBe("full_time");
  });

  it("parseStatusParam stringifies JSON-decoded numbers (?status=1 arrives as 1)", () => {
    expect(parseStatusParam(1)).toBe("1");
    expect(parseStatusParam(12.5)).toBe("12.5");
  });

  it("parseStatusParam drops booleans, null, arrays and objects", () => {
    expect(parseStatusParam(true)).toBeUndefined();
    expect(parseStatusParam(null)).toBeUndefined();
    expect(parseStatusParam(["full_time"])).toBeUndefined();
    expect(parseStatusParam({ status: "full_time" })).toBeUndefined();
    expect(parseStatusParam(undefined)).toBeUndefined();
  });

  it("parseStatusListParam handles the same shapes", () => {
    expect(parseStatusListParam("part_time||full_time")).toBe("part_time||full_time");
    expect(parseStatusListParam(1)).toBe("1");
    expect(parseStatusListParam(false)).toBeUndefined();
    expect(parseStatusListParam(null)).toBeUndefined();
  });

  it("rejects unknown filter codes after parsing", () => {
    expect(isKnownStatusFilterCode("full_time")).toBe(true);
    expect(isKnownStatusFilterCode("wizard")).toBe(false);
  });
});
