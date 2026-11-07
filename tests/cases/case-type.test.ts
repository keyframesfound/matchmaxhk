import { describe, expect, it } from "vitest";

import { matchesCaseFilters, type CaseBoardFilters } from "@/features/cases/case-filters";
import { caseChipsWithOverflow } from "@/features/cases/case-chips";
import { caseFeeNoteKey, parseCaseTypeParam, resolveCaseType } from "@/features/cases/case-type";
import type { PublicCaseBoardItem } from "@/lib/cases.functions";

const centre = { name: "Top Leader", slug: "top", verified: true, orgType: null };

function boardItem(overrides: Partial<PublicCaseBoardItem> = {}): PublicCaseBoardItem {
  return {
    academicTier: null,
    studentLevel: "S5",
    subjects: [],
    mode: "online",
    packageType: "ongoing_1_5",
    budgetMin: null,
    budgetMax: null,
    budgetMinHkd: null,
    budgetMaxHkd: null,
    tutorBackground: null,
    preferredGender: null,
    languageOfInstruction: null,
    senRequired: false,
    tags: [],
    caseType: "private",
    centre: null,
    ...overrides,
  } as PublicCaseBoardItem;
}

const byType = (item: PublicCaseBoardItem, type: CaseBoardFilters["type"]) =>
  matchesCaseFilters(item, { type });

describe("resolveCaseType (#552)", () => {
  it("defaults legacy and unknown rows to private", () => {
    expect(resolveCaseType({ caseType: null, centre: null })).toBe("private");
    expect(resolveCaseType({ caseType: "bogus", centre: null })).toBe("private");
  });

  it("keeps an activity case as activity", () => {
    expect(resolveCaseType({ caseType: "activity", centre: null })).toBe("activity");
  });

  it("treats any case linked to a centre as centre, whatever the column says", () => {
    expect(resolveCaseType({ caseType: "private", centre })).toBe("centre");
  });
});

describe("parseCaseTypeParam (#552)", () => {
  it("accepts the three types and drops anything else so cold URLs stay clean", () => {
    expect(parseCaseTypeParam("activity")).toBe("activity");
    expect(parseCaseTypeParam("all")).toBeUndefined();
    expect(parseCaseTypeParam(undefined)).toBeUndefined();
  });
});

describe("caseFeeNoteKey (#552)", () => {
  it("uses the standard note for private and activity, the centre note for centre", () => {
    expect(caseFeeNoteKey("private")).toBe("case_board.fee_note_standard");
    expect(caseFeeNoteKey("activity")).toBe("case_board.fee_note_standard");
    expect(caseFeeNoteKey("centre")).toBe("case_board.fee_note_centre");
  });
});

describe("case type board filter (#552)", () => {
  it("lists legacy untyped cases under Private", () => {
    const legacy = boardItem({ caseType: null as never });
    expect(byType(legacy, "private")).toBe(true);
    expect(byType(legacy, "activity")).toBe(false);
  });

  it("returns only matching cases for each type", () => {
    expect(byType(boardItem({ centre }), "centre")).toBe(true);
    expect(byType(boardItem({ centre }), "private")).toBe(false);
    expect(byType(boardItem({ caseType: "activity" }), "activity")).toBe(true);
    expect(byType(boardItem({ caseType: "activity" }), "centre")).toBe(false);
  });

  it("shows everything when no type is picked", () => {
    expect(byType(boardItem({ centre }), undefined)).toBe(true);
  });
});

describe("caseChipsWithOverflow (#552)", () => {
  const tags = ["a", "b", "c", "d", "e", "f"].map((tag) => `tag${tag}`);

  it("caps visible chips and reports how many were left out", () => {
    const { visible, overflow } = caseChipsWithOverflow(boardItem({ tags }), 4);
    expect(visible).toHaveLength(4);
    expect(overflow).toBe(2);
  });

  it("reports no overflow when everything fits", () => {
    const { visible, overflow } = caseChipsWithOverflow(boardItem({ tags: ["taga"] }), 4);
    expect(visible).toHaveLength(1);
    expect(overflow).toBe(0);
  });
});
