import { describe, expect, it } from "vitest";

// NOTE: relative imports — the @/ alias does not resolve under this config.
import { getActiveCustomHeadline } from "../../src/features/tutors/custom-headline";
import {
  buildCoreAcademicBreakdown,
  countCoreAcademicGrades,
  formatExamSystemLabel,
  cleanGradeForDisplay,
} from "../../src/features/tutors/core-academic-breakdown";
import { draftChineseHeadline } from "../../src/features/tutors/headline-translate";

describe("getActiveCustomHeadline (issue #411 precedence)", () => {
  const base = {
    custom_headline_en: "IBDP 41/45 | Imperial Aero Eng",
    custom_headline_zh: "IBDP 41/45 | 帝國理工航空工程",
    academic_headline: "IBDP Tutor",
  };

  it("en locale renders custom_headline_en", () => {
    expect(getActiveCustomHeadline(base, "en")).toBe(base.custom_headline_en);
    expect(getActiveCustomHeadline(base, "en-US")).toBe(base.custom_headline_en);
  });

  it("zh-* locale renders custom_headline_zh", () => {
    expect(getActiveCustomHeadline(base, "zh-HK")).toBe(base.custom_headline_zh);
    expect(getActiveCustomHeadline(base, "zh-CN")).toBe(base.custom_headline_zh);
  });

  it("empty zh falls back strictly to EN, then the derived headline", () => {
    expect(getActiveCustomHeadline({ ...base, custom_headline_zh: "   " }, "zh-HK")).toBe(
      base.custom_headline_en,
    );
    expect(
      getActiveCustomHeadline(
        { ...base, custom_headline_en: null, custom_headline_zh: null },
        "zh-HK",
      ),
    ).toBe("IBDP Tutor");
  });

  it("empty EN falls back to the derived headline for en", () => {
    expect(getActiveCustomHeadline({ ...base, custom_headline_en: "" }, "en")).toBe("IBDP Tutor");
    expect(getActiveCustomHeadline({ ...base, custom_headline_en: null }, "en")).toBe("IBDP Tutor");
  });

  it("returns null when everything is empty", () => {
    expect(getActiveCustomHeadline({}, "en")).toBeNull();
    expect(getActiveCustomHeadline({ custom_headline_zh: " " }, "zh-HK")).toBeNull();
  });
});

describe("buildCoreAcademicBreakdown (issue #411)", () => {
  it("lifts the headline total into the curriculum group header", () => {
    const groups = buildCoreAcademicBreakdown(
      [
        {
          system: "ib",
          subjects: [
            { subject: "Phys HL", grade: "Grade 7" },
            { subject: "Math AA HL", grade: "7" },
          ],
        },
      ],
      "IBDP 41/45 - Physics & Math Specialist",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].curriculum).toBe("IBDP");
    expect(groups[0].total).toBe("41/45");
    expect(groups[0].grades.map((g) => g.grade)).toEqual(["7", "7"]);
  });

  it("shows the curriculum name only when subjects exist but no total", () => {
    const groups = buildCoreAcademicBreakdown(
      [{ system: "dse", subjects: [{ subject: "Math Compulsory", grade: "5**" }] }],
      null,
    );
    expect(groups[0]).toEqual({
      curriculum: "HKDSE",
      total: null,
      grades: [{ subject: "Math Compulsory", grade: "5**" }],
    });
  });

  it("lifts a SAT Total entry into the header and out of the rows", () => {
    const groups = buildCoreAcademicBreakdown(
      [
        {
          system: "sat",
          subjects: [
            { subject: "SAT Total", grade: "1520" },
            { subject: "SAT Math", grade: "780" },
          ],
        },
      ],
      null,
    );
    expect(groups[0].total).toBe("1520");
    expect(groups[0].grades).toHaveLength(1);
    expect(groups[0].grades[0].subject).toBe("SAT Math");
  });

  it("never lifts prose that merely starts with the curriculum label", () => {
    const groups = buildCoreAcademicBreakdown(
      [{ system: "ap", subjects: [{ subject: "Statistics", grade: "Grade 5" }] }],
      "AP Straight 5/5 Specialist",
    );
    expect(groups[0].curriculum).toBe("AP");
    expect(groups[0].total).toBeNull();
  });

  it("hides everything when no scores/grades exist (Examiner / pro tutors)", () => {
    expect(buildCoreAcademicBreakdown([], "Official IB Maths Examiner")).toEqual([]);
    expect(buildCoreAcademicBreakdown([], "IBDP Tutor")).toEqual([]);
  });

  it("produces nothing from a headline total without exam entries (Row 1 carries it)", () => {
    expect(buildCoreAcademicBreakdown([], "IBDP 41/45")).toEqual([]);
  });

  it("strips the (legacy) suffix and Grade/Band nouns", () => {
    expect(cleanGradeForDisplay("Grade 7 (legacy)")).toBe("7");
    expect(cleanGradeForDisplay("Band 7.5")).toBe("7.5");
    expect(cleanGradeForDisplay("A*")).toBe("A*");
  });

  it("counts grade rows for the View-all toggle", () => {
    const groups = buildCoreAcademicBreakdown(
      [
        {
          system: "ib",
          subjects: [
            { subject: "Phys HL", grade: "7" },
            { subject: "Chem HL", grade: "7" },
          ],
        },
        { system: "igcse", subjects: [{ subject: "Mathematics", grade: "A*" }] },
      ],
      "IBDP 45/45 - IGCSE 9A*",
    );
    expect(countCoreAcademicGrades(groups)).toBe(3);
  });

  it("formats system labels for the group headers", () => {
    expect(formatExamSystemLabel("ib")).toBe("IBDP");
    expect(formatExamSystemLabel("alevel")).toBe("GCE A-Level");
    expect(formatExamSystemLabel("igcse")).toBe("IGCSE / GCSE");
  });
});

describe("draftChineseHeadline (issue #411 rule-based auto-translate)", () => {
  it("keeps score tokens and translates known segments", () => {
    expect(draftChineseHeadline("IBDP 41/45 | Imperial Aero Eng")).toBe(
      "IBDP 41/45 | 帝國理工航空工程",
    );
  });

  it("translates university phrases and majors", () => {
    expect(draftChineseHeadline("HKU Medicine")).toBe("港大醫學");
    expect(draftChineseHeadline("CUHK Law")).toBe("中大法律");
    expect(draftChineseHeadline("HKUST Engineering")).toBe("科大工程");
    expect(draftChineseHeadline("Computer Science graduate")).toBe("電腦科學畢業");
  });

  it("leaves unresolved segments in English", () => {
    const out = draftChineseHeadline("Zzzblurgh Tutor");
    expect(out).toContain("Zzzblurgh");
    expect(out).toContain("導師");
  });

  it("returns empty for empty input", () => {
    expect(draftChineseHeadline("")).toBe("");
    expect(draftChineseHeadline(null)).toBe("");
    expect(draftChineseHeadline("   ")).toBe("");
  });

  it("caps the draft at 60 characters", () => {
    const long = "Medicine Medicine Medicine Medicine Medicine Medicine Medicine";
    expect(draftChineseHeadline(long).length).toBeLessThanOrEqual(60);
  });
});
