import { describe, expect, it } from "vitest";

import { parseCaseImportCsv, normalizeLessonDate } from "../../src/features/cases/import-csv";

const HEADER = "parent name,phone,tutor,subject,rate,lesson dates,fee paid";

describe("case import CSV (#201)", () => {
  it("parses a well-formed file", () => {
    const csv = [
      HEADER,
      'Mrs. Chan,+852 9123 4567,MM-T005,Physics,500,2026-10-01;2026-10-08,yes',
      "Mr. Lee,91234567,MM-T012,IB Math,650,2026/10/02 and 2026/10/09,no",
    ].join("\n");
    const res = parseCaseImportCsv(csv);
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toEqual({
      parentName: "Mrs. Chan",
      phone: "+852 9123 4567",
      tutor: "MM-T005",
      subject: "Physics",
      rateHkd: 500,
      lessonDates: ["2026-10-01", "2026-10-08"],
      feePaid: true,
    });
    expect(res.rows[1].feePaid).toBe(false);
    expect(res.rows[1].lessonDates).toEqual(["2026-10-02", "2026-10-09"]);
  });

  it("normalises D/M/YYYY and YYYY/M/D", () => {
    expect(normalizeLessonDate("8/10/2026")).toBe("2026-10-08");
    expect(normalizeLessonDate("2026/10/8")).toBe("2026-10-08");
    expect(normalizeLessonDate("2026-10-08")).toBe("2026-10-08");
    expect(normalizeLessonDate("garbage")).toBeNull();
  });

  it("strips currency noise from rate", () => {
    const res = parseCaseImportCsv(
      [HEADER, "P,9,x,Math,HK$500/hr,2026-10-01,yes"].join("\n"),
    );
    expect(res.rows[0].rateHkd).toBe(500);
  });

  it("collects row errors without dropping the whole file", () => {
    const csv = [
      HEADER,
      ",91234567,MM-T005,Physics,500,2026-10-01,yes", // missing parent name
      "Good Parent,91234567,MM-T006,Chem,abc,2026-10-01,yes", // bad rate
      "Another,91234567,MM-T007,Bio,400,not-a-date,yes", // bad date
      "Another2,91234567,MM-T008,Hist,400,2026-10-01,maybe", // bad fee flag
    ].join("\n");
    const res = parseCaseImportCsv(csv);
    expect(res.rows).toHaveLength(0);
    const fields = new Set(res.errors.map((e) => e.field));
    // "not-a-date" raises both the invalid-date and no-dates errors for its row.
    expect([...fields].sort()).toEqual(["feePaid", "lessonDates", "parentName", "rate"]);
  });

  it("rejects unknown headers and missing required columns", () => {
    const res = parseCaseImportCsv("name,phone\na,b");
    expect(res.rows).toHaveLength(0);
    expect(res.errors.some((e) => e.message.includes('missing required column "tutor"'))).toBe(true);
  });

  it("handles quoted cells with commas", () => {
    const csv = [HEADER, '"Wong, John",91234567,MM-T009,English,600,2026-10-01,yes'].join("\n");
    const res = parseCaseImportCsv(csv);
    expect(res.rows[0].parentName).toBe("Wong, John");
  });

  it("empty file errors cleanly", () => {
    const res = parseCaseImportCsv("");
    expect(res.rows).toHaveLength(0);
    expect(res.errors[0].message).toBe("empty file");
  });
});
