import { describe, expect, it } from "vitest";

import { buildWhatsAppPrefill } from "../../src/features/tutors/tutor-display";

describe("#751 WhatsApp request pre-fill", () => {
  it("keeps the placeholders when nothing was chosen", () => {
    const text = buildWhatsAppPrefill({ tutorCode: "MM-T040", language: "en" });
    expect(text).toContain("[curriculum & grade] / [subject] / [district or online]");
    expect(text).toContain("$[X]/hr");
  });

  it("fills curriculum, grade, subjects, mode, station and rate from search", () => {
    const text = buildWhatsAppPrefill({
      tutorCode: "MM-T040",
      language: "en",
      search: {
        curriculum: "HKDSE",
        grade: "S5",
        subjects: ["Chemistry", "Biology"],
        mode: "in_person",
        station: "Admiralty",
        rate: 310,
      },
    });
    expect(text).toContain(
      "Student: HKDSE · S5 / Chemistry, Biology / in person · Admiralty / budget about $310/hr.",
    );
  });

  it("fills the 繁中 message and keeps missing parts as placeholders", () => {
    const text = buildWhatsAppPrefill({
      tutorCode: "MM-T040",
      language: "zh-HK",
      search: { curriculum: "IBDP", mode: "online" },
    });
    expect(text).toContain("學生資料：IBDP / [科目] / 網上 / 預算約 $[X]/hr。");
  });
});
