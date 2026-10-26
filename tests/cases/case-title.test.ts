// Issue #423 (sections 2+3) — bilingual structured auto-title.
// Includes the tier/curriculum-lock interaction: after the server-side
// enforceCaseTierConsistency DROP, a Primary case can never produce an
// "IBDP Chemistry HL" title.
import { describe, expect, it } from "vitest";

import { buildCaseTitle } from "../../src/features/cases/case-title";
import { caseTitleFieldsFromBoard } from "../../src/features/cases/case-title";
import { caseChips } from "../../src/features/cases/case-chips";
import { caseLogisticsParts } from "../../src/features/cases/case-card";
import { enforceCaseTierConsistency } from "../../src/features/cases/case-options";
import type { PublicCaseBoardItem } from "../../src/lib/cases.functions";

describe("buildCaseTitle EN (#423)", () => {
  it("renders [Curriculum] [Subject], [Grade]", () => {
    expect(
      buildCaseTitle({ curriculum: "IB", subjects: ["Chemistry HL"], grade: "Y12" }, "en"),
    ).toBe("IBDP Chemistry HL, Y12");
  });

  it("keeps free-text grades verbatim", () => {
    expect(buildCaseTitle({ curriculum: "DSE", subjects: ["Physics"], grade: "S5" }, "en")).toBe(
      "DSE Physics, S5",
    );
  });

  it("drops a grade segment that restates the curriculum band (GLM r3 minor)", () => {
    expect(
      buildCaseTitle(
        { curriculum: "Primary School", subjects: ["Mathematics"], grade: "Primary" },
        "en",
      ),
    ).toBe("Primary School Mathematics");
    // Prefix-dedup: the Admissions band already contains "University".
    expect(
      buildCaseTitle(
        { curriculum: "Admissions", subjects: ["Mathematics"], grade: "University" },
        "en",
      ),
    ).toBe("University Admissions Mathematics");
    // A distinct grade band still renders — AP's label is NOT a prefix of
    // "Primary", so nothing may be dropped here.
    expect(
      buildCaseTitle({ curriculum: "AP", subjects: ["Mathematics"], grade: "Primary" }, "en"),
    ).toBe("AP Mathematics, Primary");
    // No curriculum → the grade is the only band info; keep it.
    expect(
      buildCaseTitle({ curriculum: null, subjects: ["Mathematics"], grade: "Primary" }, "en"),
    ).toBe("Mathematics, Primary");
  });

  it("collapses extra subjects to +N", () => {
    expect(
      buildCaseTitle({ curriculum: "IB", subjects: ["Math AA HL", "Physics", "Economics"] }, "en"),
    ).toBe("IBDP Math AA HL +2");
  });

  it("skips meaningless curricula", () => {
    expect(
      buildCaseTitle({ curriculum: "Not sure yet", subjects: ["English"], grade: null }, "en"),
    ).toBe("English");
  });

  it("returns '' when the structured fields don't suffice (legacy fallback)", () => {
    expect(buildCaseTitle({ curriculum: null, subjects: [], grade: null }, "en")).toBe("");
  });
});

describe("buildCaseTitle zh-HK (#423)", () => {
  it("renders the parallel structured string", () => {
    expect(
      buildCaseTitle(
        { curriculum: "IB", subjects: ["Chemistry HL"], grade: "Senior secondary" },
        "zh-HK",
      ),
    ).toBe("IBDP 化學 HL, 高中");
  });

  it("translates known subjects and keeps unknown tokens", () => {
    expect(
      buildCaseTitle(
        { curriculum: "DSE", subjects: ["Physics"], grade: "Junior secondary" },
        "zh-HK",
      ),
    ).toBe("DSE 物理, 初中");
    expect(
      buildCaseTitle({ curriculum: "A-Level", subjects: ["Further Math"], grade: null }, "zh-HK"),
    ).toBe("A-Level 延伸數學");
  });

  it("drops the redundant zh band segment too (小學 英文, 小學 → 小學 英文)", () => {
    expect(
      buildCaseTitle(
        { curriculum: "Primary School", subjects: ["English"], grade: "Primary" },
        "zh-HK",
      ),
    ).toBe("小學 英文");
  });
});

describe("tier/curriculum-lock interaction (#423 bug 3)", () => {
  it("a tampered Primary+IB payload drops the curriculum and its subjects — never 'Primary: Chem HL'", () => {
    const tierConsistent = enforceCaseTierConsistency({
      supportType: "subject_tutoring",
      academicLevel: "Primary",
      curriculum: "IB",
      subjects: ["Chemistry HL", "Phonics"],
    });
    const en = buildCaseTitle(
      {
        curriculum: tierConsistent.curriculum,
        subjects: tierConsistent.subjects,
        grade: "Primary",
      },
      "en",
    );
    expect(tierConsistent.curriculum).toBeNull();
    // Custom parent-typed subjects survive the DROP (#396 precedent) — but
    // the "IBDP" curriculum label can never render beside a Primary grade.
    expect(en).not.toContain("IBDP");
    expect(en).not.toContain("Primary School");
  });

  it("a coherent Secondary+IB pair survives the lock and titles correctly", () => {
    const tierConsistent = enforceCaseTierConsistency({
      supportType: "subject_tutoring",
      academicLevel: "Secondary",
      curriculum: "IB",
      subjects: ["Chemistry HL"],
    });
    expect(
      buildCaseTitle(
        {
          curriculum: tierConsistent.curriculum,
          subjects: tierConsistent.subjects,
          grade: "Senior secondary",
        },
        "en",
      ),
    ).toBe("IBDP Chemistry HL, Senior secondary");
  });
});

function baseItem(overrides: Partial<PublicCaseBoardItem>): PublicCaseBoardItem {
  return {
    id: "c1",
    caseCode: "CR-0001",
    title: "legacy title",
    description: null,
    subjects: ["Chemistry HL"],
    studentLevel: "Senior secondary",
    academicTier: null,
    uniField: null,
    uniName: null,
    uniProgram: null,
    uniCourseCodes: null,
    kindergartenFocus: [],
    examSystem: "IB",
    district: "Yuen Long",
    mode: "in_person",
    sessionsPerWeek: 1,
    sessionLengthMinutes: 60,
    languageOfInstruction: null,
    tutorBackground: "any",
    specificComponent: null,
    targetSchool: null,
    tags: [],
    senRequired: false,
    senCategories: [],
    preferredGender: "any",
    startTiming: null,
    packageType: "ongoing_1_5",
    studentCount: 1,
    rateUnit: "hr",
    budgetCurrency: "HKD",
    budgetMin: null,
    budgetMax: null,
    budgetMinHkd: null,
    budgetMaxHkd: null,
    boardPublishedAt: null,
    createdAt: "2026-10-23T00:00:00Z",
    ...overrides,
  };
}

describe("caseChips — the ONE chip system (#423)", () => {
  it("merges requirement pills and stored tags, deduped, capped at MAX_CASE_TAGS", () => {
    const chips = caseChips(
      baseItem({
        tags: ["ia review", "examiner"],
        specificComponent: "IA",
        tutorBackground: "uni_student",
      }),
    );
    const labels = chips.map((c) => c.label);
    expect(labels).toContain("IB"); // pill
    expect(labels).toContain("IA"); // pill (specificComponent)
    expect(labels).toContain("University student"); // pill (background)
    expect(labels).toContain("ia review"); // stored tag
    expect(labels).toContain("examiner"); // stored tag
    // "IA" pill and a hypothetical "ia" tag dedupe to one chip.
    expect(chips.length).toBeLessThanOrEqual(8);
  });

  it("marks gender preference as the HARD chip", () => {
    const female = caseChips(baseItem({ preferredGender: "female" }));
    expect(female.filter((c) => c.hard).map((c) => c.label)).toEqual(["Female Only"]);
    const male = caseChips(baseItem({ preferredGender: "male" }));
    expect(male.filter((c) => c.hard).map((c) => c.label)).toEqual(["Male Only"]);
    expect(caseChips(baseItem({ preferredGender: "any" })).some((c) => c.hard)).toBe(false);
  });

  it("surfaces SEN support", () => {
    const chips = caseChips(baseItem({ senRequired: true }));
    expect(chips.map((c) => c.label)).toContain("SEN Friendly");
  });

  it("caps the row at MAX_CASE_TAGS (8)", () => {
    const chips = caseChips(
      baseItem({
        tags: Array.from({ length: 12 }, (_, i) => `tag-${i}`),
      }),
    );
    expect(chips.length).toBe(8);
  });

  it("carries tKey on fixed-vocabulary chips; raw label stays the filter identity", () => {
    const chips = caseChips(
      baseItem({ preferredGender: "female", senRequired: true, tutorBackground: "uni_student" }),
    );
    const byLabel = new Map(chips.map((c) => [c.label, c]));
    expect(byLabel.get("Female Only")?.tKey).toBe("case_board.chip_female_only");
    expect(byLabel.get("SEN Friendly")?.tKey).toBe("case_board.chip_sen");
    expect(byLabel.get("University student")?.tKey).toBe("case_board.chip_uni_student");
    expect(byLabel.get("University student")?.query).toBe("University student");
    // Exam-system pills translate through the existing curriculum vocabulary.
    const primary = caseChips(baseItem({ examSystem: "Primary School" }));
    expect(primary.find((c) => c.label === "Primary School")?.tKey).toBe(
      "search_panel.category_primary_school",
    );
    // IB/DSE/A-Level have identical labels in both locales — no tKey needed.
    const ib = caseChips(baseItem({ examSystem: "IB" }));
    expect(ib.find((c) => c.label === "IB")?.tKey).toBeUndefined();
    // Data-backed chips (school names, parent-typed tags) never localize.
    const tagged = caseChips(baseItem({ tags: ["ia review"] }));
    expect(tagged.find((c) => c.label === "ia review")?.tKey).toBeUndefined();
  });
});

describe("caseTitleFieldsFromBoard — the item→fields boundary (#423)", () => {
  it("maps examSystem→curriculum and studentLevel→grade so the title is never subject-only", () => {
    // The GLM-review blocker: the raw board item shadows the stored title
    // with a bare subject string because CaseTitleFields props are optional
    // and structural typing stays silent. The boundary mapper must produce
    // the full "IBDP Chemistry HL — Senior secondary" from a REAL board item.
    const item = baseItem({ title: "IBDP Chemistry HL — Y12" });
    expect(buildCaseTitle(caseTitleFieldsFromBoard(item), "en")).toBe(
      "IBDP Chemistry HL, Senior secondary",
    );
    expect(buildCaseTitle(caseTitleFieldsFromBoard(item), "zh-HK")).toBe("IBDP 化學 HL, 高中");
    // The mapped value is non-empty, so useCaseTitles' `|| item.title`
    // fallback only triggers for rows the helper can't express.
  });
});

describe("caseLogisticsParts — one mode mention (#423)", () => {
  it("drops the bare mode label on district-less (online) cases", () => {
    const parts = caseLogisticsParts(
      baseItem({
        district: null,
        mode: "online",
        budgetMin: null,
        budgetMax: null,
        budgetMinHkd: 300,
        budgetMaxHkd: null,
      }),
    );
    expect(parts[0]).toBe("📍 Online");
    expect(parts.filter((p) => p.includes("Online")).length).toBe(1);
    expect(parts.join(" · ")).not.toContain("Online · Online");
  });

  it("excludes the rate — the card renders it as its own converted line (#113)", () => {
    const parts = caseLogisticsParts(baseItem({ budgetMinHkd: 300, budgetMaxHkd: 500 }));
    expect(parts.join(" · ")).not.toContain("HK$");
  });

  it("keeps district + mode as separate parts for in-person cases", () => {
    const parts = caseLogisticsParts(
      baseItem({
        district: "Yuen Long",
        mode: "in_person",
        budgetMin: null,
        budgetMax: null,
        budgetMinHkd: 300,
        budgetMaxHkd: null,
      }),
    );
    expect(parts[0]).toBe("📍 Yuen Long");
    expect(parts[1]).toBe("In-person");
  });
});
