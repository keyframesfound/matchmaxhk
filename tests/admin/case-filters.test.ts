import { describe, expect, it } from "vitest";

import {
  applyCaseFilters,
  caseFilterOptions,
  caseFiltersToSearch,
  caseRateBandId,
  CLEAR_ALL,
  DEFAULT_CASE_FILTERS,
  isDefaultFilters,
  parseCaseFilters,
  type CaseFilters,
} from "../../src/features/admin/case-filters";
import { EXAM_SYSTEM_OPTIONS } from "../../src/features/cases/case-options";
import type { CaseRow } from "../../src/features/cases/admin/shared";

/**
 * Issue #71 — staff case-queue filters, tested as pure helpers.
 * The parse layer's core job: hand-typed/shared URLs (TanStack
 * JSON-decodes ?x=1 to number 1 and ?x=true to boolean true) must behave
 * exactly like in-app toggles.
 */

function mkRow(overrides: Partial<CaseRow> & Pick<CaseRow, "id">): CaseRow {
  return {
    case_code: "CASE-0001",
    title: "Math tutor wanted",
    description: null,
    subjects: ["Mathematics"],
    exam_system: "DSE",
    student_level: "Senior secondary",
    student_grade_current: null,
    student_school: null,
    district: "Central",
    mode: "either",
    sessions_per_week: 2,
    session_length_minutes: 60,
    schedule_note: null,
    start_timing: null,
    preferred_gender: "any",
    language_of_instruction: "cantonese",
    urgency: "normal",
    budget_min: 150,
    budget_max: 200,
    budget_currency: "HKD",
    budget_min_hkd: 150,
    budget_max_hkd: 200,
    contact_name: "Chan Tai Man",
    contact_phone: "+85291234567",
    status: "new",
    matched_tutor_id: null,
    matched_at: null,
    fee_collected_at: null,
    fee_amount_cents: null,
    tags: [],
    source: "web",
    last_contacted_at: null,
    board_published_at: null,
    created_at: "2026-10-15T00:00:00.000Z",
    updated_at: "2026-10-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseCaseFilters — TanStack JSON-decode tolerance", () => {
  it("empty search → all defaults", () => {
    expect(parseCaseFilters({})).toEqual(DEFAULT_CASE_FILTERS);
  });

  it("string enum values parse", () => {
    expect(parseCaseFilters({ status: "new" }).status).toBe("new");
    expect(parseCaseFilters({ mode: "online" }).mode).toBe("online");
    expect(parseCaseFilters({ mode: "in_person" }).mode).toBe("in_person");
    expect(parseCaseFilters({ rate: "100-200" }).rateBand).toBe("100-200");
    expect(parseCaseFilters({ created: "30d" }).created).toBe("30d");
  });

  it("number 1 (from ?status=1) drops to default — never matches an enum", () => {
    expect(parseCaseFilters({ status: 1 }).status).toBe("all");
    expect(parseCaseFilters({ mode: 1 }).mode).toBe("all");
    expect(parseCaseFilters({ rate: 1 }).rateBand).toBe("all");
  });

  it("boolean true (from ?status=true) drops to default", () => {
    expect(parseCaseFilters({ status: true }).status).toBe("all");
    expect(parseCaseFilters({ mode: false }).mode).toBe("all");
    expect(parseCaseFilters({ created: true }).created).toBe("all");
  });

  it("created presets accept the bare-number hand-typed form (?created=7)", () => {
    expect(parseCaseFilters({ created: 7 }).created).toBe("7d");
    expect(parseCaseFilters({ created: "30" }).created).toBe("30d");
    expect(parseCaseFilters({ created: "7d" }).created).toBe("7d");
  });

  it("desk (#438) parses hold; junk/number/boolean drop to the active default", () => {
    expect(DEFAULT_CASE_FILTERS.desk).toBe("active");
    expect(parseCaseFilters({ desk: "hold" }).desk).toBe("hold");
    expect(parseCaseFilters({ desk: "active" }).desk).toBe("active");
    expect(parseCaseFilters({ desk: "bogus" }).desk).toBe("active");
    expect(parseCaseFilters({ desk: 1 }).desk).toBe("active");
    expect(parseCaseFilters({ desk: true }).desk).toBe("active");
    expect(parseCaseFilters({}).desk).toBe("active");
  });

  it("mode accepts the hyphenated spelling a hand-typed URL would use", () => {
    expect(parseCaseFilters({ mode: "in-person" }).mode).toBe("in_person");
  });

  it("unknown enum values drop to defaults, not throw", () => {
    expect(parseCaseFilters({ status: "bogus" }).status).toBe("all");
    expect(parseCaseFilters({ rate: "999-9999" }).rateBand).toBe("all");
    expect(parseCaseFilters({ created: "yesterday" }).created).toBe("all");
  });

  it("q coerces numbers and keeps the raw string (spaces survive the URL round-trip)", () => {
    expect(parseCaseFilters({ q: "  Maths " }).q).toBe("  Maths ");
    expect(parseCaseFilters({ q: 9021 }).q).toBe("9021");
    expect(parseCaseFilters({ q: "" }).q).toBe("");
    // Matching still trims: a trailing space mid-typing finds the case.
    expect(
      applyCaseFilters(
        [{ case_code: "C1", title: "Maths tutoring" }],
        parseCaseFilters({ q: "Maths " }),
      ),
    ).toHaveLength(1);
  });

  it("subjects: comma-joined string, repeated-param array, junk scalars", () => {
    expect(parseCaseFilters({ subjects: "Math,Physics" }).subjects).toEqual(["Math", "Physics"]);
    // ?subjects=Math&subjects=Physics decodes to an array; numbers inside
    // an array (JSON-decode) are coerced to their string form.
    expect(parseCaseFilters({ subjects: ["Math", 5, ""] }).subjects).toEqual(["Math", "5"]);
    // A bare number/boolean scalar is a flag, not a subject list.
    expect(parseCaseFilters({ subjects: 1 }).subjects).toEqual([]);
    expect(parseCaseFilters({ subjects: true }).subjects).toEqual([]);
    // Whitespace, dedupe, cap.
    expect(parseCaseFilters({ subjects: " Math , Math ,Physics " }).subjects).toEqual([
      "Math",
      "Physics",
    ]);
  });

  it("open-vocabulary fields (curriculum/level/district/tag) pass through non-empty values", () => {
    expect(parseCaseFilters({ curriculum: "Admissions" }).curriculum).toBe("Admissions");
    expect(parseCaseFilters({ level: "Primary" }).level).toBe("Primary");
    expect(parseCaseFilters({ district: "Mong Kok" }).district).toBe("Mong Kok");
    expect(parseCaseFilters({ tag: "sen" }).tag).toBe("sen");
    expect(parseCaseFilters({ curriculum: "" }).curriculum).toBe("all");
  });

  it("unknown keys are ignored entirely", () => {
    expect(parseCaseFilters({ foo: "bar", hack: "<script>" })).toEqual(DEFAULT_CASE_FILTERS);
  });
});

describe("caseFiltersToSearch — default dropping + stable key order", () => {
  it("defaults and CLEAR_ALL serialize to an empty search (clean URLs)", () => {
    expect(caseFiltersToSearch(DEFAULT_CASE_FILTERS)).toEqual({});
    expect(caseFiltersToSearch(CLEAR_ALL)).toEqual({});
  });

  it("emits every non-default filter, keys in stable order", () => {
    const filters: CaseFilters = {
      q: "ib maths",
      status: "contacted",
      desk: "active",
      tag: "ia-review",
      curriculum: "IB",
      subjects: ["Physics", "Chemistry"],
      level: "University",
      mode: "in_person",
      district: "Kowloon Tong",
      rateBand: "200-300",
      created: "30d",
    };
    const search = caseFiltersToSearch(filters);
    expect(Object.keys(search)).toEqual([
      "q",
      "status",
      "tag",
      "curriculum",
      "subjects",
      "level",
      "mode",
      "district",
      "rate",
      "created",
    ]);
    expect(search).toEqual({
      q: "ib maths",
      status: "contacted",
      tag: "ia-review",
      curriculum: "IB",
      subjects: "Physics,Chemistry",
      level: "University",
      mode: "in_person",
      district: "Kowloon Tong",
      rate: "200-300",
      created: "30d",
    });
  });
});

describe("round-trip caseFiltersToSearch ∘ parseCaseFilters", () => {
  const variants: CaseFilters[] = [
    DEFAULT_CASE_FILTERS,
    { ...DEFAULT_CASE_FILTERS, q: "maths" },
    { ...DEFAULT_CASE_FILTERS, status: "matched" },
    { ...DEFAULT_CASE_FILTERS, desk: "hold" },
    { ...DEFAULT_CASE_FILTERS, tag: "sen" },
    { ...DEFAULT_CASE_FILTERS, curriculum: "A-Level" },
    { ...DEFAULT_CASE_FILTERS, subjects: ["Physics", "Chemistry"] },
    { ...DEFAULT_CASE_FILTERS, level: "Primary" },
    { ...DEFAULT_CASE_FILTERS, mode: "either" },
    { ...DEFAULT_CASE_FILTERS, district: "Shatin" },
    { ...DEFAULT_CASE_FILTERS, rateBand: "gte300" },
    { ...DEFAULT_CASE_FILTERS, created: "7d" },
  ];

  it.each(variants.map((variant) => [JSON.stringify(variant), variant] as const))(
    "%s",
    (_name, variant) => {
      expect(parseCaseFilters(caseFiltersToSearch(variant))).toEqual(variant);
    },
  );
});

describe("caseRateBandId — HKD bands over max ?? min, plain-label edges", () => {
  it("no budget → null (matches no band)", () => {
    expect(caseRateBandId({ min: null, max: null })).toBeNull();
  });

  it("band edges: <100, 100–200 incl., up to 300 incl., over 300", () => {
    expect(caseRateBandId({ min: null, max: 99 })).toBe("lt100");
    expect(caseRateBandId({ min: 100, max: 100 })).toBe("100-200");
    expect(caseRateBandId({ min: 150, max: 200 })).toBe("100-200"); // rep = max 200
    expect(caseRateBandId({ min: 201, max: 299 })).toBe("200-300");
    expect(caseRateBandId({ min: 300, max: null })).toBe("200-300"); // 300 incl.
    expect(caseRateBandId({ min: 301, max: null })).toBe("gte300");
    expect(caseRateBandId({ min: null, max: 150 })).toBe("100-200"); // min-only rows
  });
});

describe("applyCaseFilters — fixture queue", () => {
  const NOW = new Date("2026-10-16T12:00:00.000Z");
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

  const rows: CaseRow[] = [
    mkRow({
      id: "r1",
      contact_phone: "+85291234567",
      exam_system: "DSE",
      subjects: ["Mathematics"],
      student_level: "Senior secondary",
      mode: "either",
      district: "Central",
      budget_min: 150,
      budget_max: 200,
      status: "new",
      tags: ["dse-math"],
      created_at: daysAgo(2).toISOString(),
    }),
    mkRow({
      id: "r2",
      case_code: "CASE-0002",
      contact_name: "Wong Siu Ming",
      contact_phone: "+85260002222",
      exam_system: "IB",
      subjects: ["Physics"],
      student_level: "University",
      mode: "online",
      district: "Kowloon Tong",
      budget_min: 300,
      budget_max: 400,
      budget_min_hkd: 300,
      budget_max_hkd: 400,
      status: "contacted",
      created_at: daysAgo(10).toISOString(),
    }),
    mkRow({
      id: "r3",
      case_code: "CASE-0003",
      contact_name: "Li Ka Yan",
      contact_phone: "+85295553333",
      exam_system: "DSE",
      subjects: ["Chemistry", "Mathematics"],
      student_level: "Junior secondary",
      mode: "in_person",
      district: "Shatin",
      budget_min: 80,
      budget_max: null,
      budget_min_hkd: 80,
      budget_max_hkd: null,
      status: "closed",
      tags: ["sen"],
      created_at: daysAgo(45).toISOString(),
    }),
    mkRow({
      id: "r4",
      case_code: "CASE-0004",
      contact_name: "Cheung Man",
      contact_phone: "+85264445555",
      exam_system: null,
      subjects: ["Economics"],
      student_level: "Other",
      mode: "either",
      district: null,
      budget_min: null,
      budget_max: null,
      budget_min_hkd: null,
      budget_max_hkd: null,
      status: "rejected",
      created_at: daysAgo(29).toISOString(),
    }),
  ];

  const apply = (filters: Partial<CaseFilters>) =>
    applyCaseFilters(rows, { ...DEFAULT_CASE_FILTERS, ...filters }, NOW).map((row) => row.id);

  it("status", () => {
    expect(apply({ status: "new" })).toEqual(["r1"]);
    expect(apply({ status: "all" })).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("tag", () => {
    expect(apply({ tag: "sen" })).toEqual(["r3"]);
  });

  it("curriculum (exam_system)", () => {
    expect(apply({ curriculum: "DSE" })).toEqual(["r1", "r3"]);
  });

  it("subjects multi-select is ANY-of (OR)", () => {
    expect(apply({ subjects: ["Physics", "Chemistry"] })).toEqual(["r2", "r3"]);
    expect(apply({ subjects: ["Mathematics"] })).toEqual(["r1", "r3"]);
  });

  it("level / mode / district", () => {
    expect(apply({ level: "University" })).toEqual(["r2"]);
    expect(apply({ mode: "online" })).toEqual(["r2"]);
    expect(apply({ district: "Central" })).toEqual(["r1"]);
    expect(apply({ district: "North Point" })).toEqual([]);
  });

  it("rate bands incl. budgetless rows matching no band", () => {
    expect(apply({ rateBand: "lt100" })).toEqual(["r3"]);
    expect(apply({ rateBand: "100-200" })).toEqual(["r1"]);
    expect(apply({ rateBand: "200-300" })).toEqual([]);
    expect(apply({ rateBand: "gte300" })).toEqual(["r2"]);
  });

  it("created presets with injected now", () => {
    expect(apply({ created: "7d" })).toEqual(["r1"]);
    expect(apply({ created: "30d" })).toEqual(["r1", "r2", "r4"]);
  });

  it("created cutoff is inclusive at exactly 7 days", () => {
    const edge = [
      mkRow({ id: "edge-in", created_at: daysAgo(7).toISOString() }),
      mkRow({
        id: "edge-out",
        created_at: new Date(NOW.getTime() - (7 * 24 * 60 * 60 * 1000 + 1)).toISOString(),
      }),
    ];
    const out = applyCaseFilters(edge, { ...DEFAULT_CASE_FILTERS, created: "7d" }, NOW).map(
      (row) => row.id,
    );
    expect(out).toEqual(["edge-in"]);
  });

  it("free-text q keeps the existing predicate (code/title/contact/subjects/tags)", () => {
    expect(apply({ q: "9123" })).toEqual(["r1"]); // contact phone
    expect(apply({ q: "physics" })).toEqual(["r2"]); // subject, case-insensitive
    expect(apply({ q: "sen" })).toEqual(["r3"]); // tag
    expect(apply({ q: "no such case" })).toEqual([]);
  });

  it("structured filters AND together — the one-click staff path", () => {
    expect(apply({ status: "contacted", curriculum: "IB", subjects: ["Physics"] })).toEqual(["r2"]);
    expect(apply({ status: "new", mode: "online" })).toEqual([]);
  });

  it("desk split (#438): Active = UNASSIGNED/P1/P2 (default), Hold = P3/P4", () => {
    const tiered = [
      mkRow({ id: "d-unassigned" }),
      mkRow({ id: "d-p1", priority_tier: "P1" as const }),
      mkRow({ id: "d-p2", priority_tier: "P2" as const }),
      mkRow({ id: "d-p3", priority_tier: "P3" as const }),
      mkRow({ id: "d-p4", priority_tier: "P4" as const }),
      // Pre-migration row fetched before the column existed: junk → Active.
      mkRow({ id: "d-legacy", priority_tier: null }),
    ];
    const byDesk = (desk: "active" | "hold") =>
      applyCaseFilters(tiered, { ...DEFAULT_CASE_FILTERS, desk }, NOW).map((row) => row.id);
    expect(byDesk("active")).toEqual(["d-unassigned", "d-p1", "d-p2", "d-legacy"]);
    expect(byDesk("hold")).toEqual(["d-p3", "d-p4"]);
  });
});

describe("caseFilterOptions — constants first, row extras merged in", () => {
  it("curricula include the form constants + Admissions even with no rows", () => {
    const options = caseFilterOptions([]);
    expect(options.curricula).toEqual([
      ...EXAM_SYSTEM_OPTIONS.map((option) => option.value),
      "Admissions",
    ]);
    expect(options.subjects).toEqual([]);
    expect(options.districts).toEqual([]);
  });

  it("row values merge in, deduped and sorted where row-derived", () => {
    const options = caseFilterOptions([
      mkRow({
        id: "a",
        exam_system: "Admissions",
        subjects: ["Physics"],
        district: "Central",
        tags: ["sen"],
      }),
      mkRow({
        id: "b",
        exam_system: "DSE",
        subjects: ["Chemistry", "Physics"],
        district: null,
        tags: [],
      }),
      mkRow({
        id: "c",
        exam_system: null,
        subjects: ["Economics"],
        district: "Mong Kok",
        tags: ["admissions"],
      }),
    ]);
    expect(options.curricula).toContain("Admissions");
    expect(options.subjects).toEqual(["Chemistry", "Economics", "Physics"]);
    expect(options.districts).toEqual(["Central", "Mong Kok"]);
    expect(options.tags).toEqual(["admissions", "sen"]);
    expect(options.levels.length).toBeGreaterThan(0);
  });
});

describe("isDefaultFilters + CLEAR_ALL", () => {
  it("defaults and CLEAR_ALL are default", () => {
    expect(isDefaultFilters(DEFAULT_CASE_FILTERS)).toBe(true);
    expect(isDefaultFilters(CLEAR_ALL)).toBe(true);
  });

  it("any active filter makes it false", () => {
    expect(isDefaultFilters({ ...DEFAULT_CASE_FILTERS, q: "x" })).toBe(false);
    expect(isDefaultFilters({ ...DEFAULT_CASE_FILTERS, desk: "hold" })).toBe(false);
    expect(isDefaultFilters({ ...DEFAULT_CASE_FILTERS, subjects: ["Math"] })).toBe(false);
    expect(isDefaultFilters({ ...DEFAULT_CASE_FILTERS, rateBand: "gte300" })).toBe(false);
    expect(isDefaultFilters({ ...DEFAULT_CASE_FILTERS, created: "7d" })).toBe(false);
  });

  it("whitespace-only q still counts as default", () => {
    expect(isDefaultFilters({ ...DEFAULT_CASE_FILTERS, q: "   " })).toBe(true);
  });
});
