import { describe, expect, it } from "vitest";

import {
  buildImportOps,
  normalizePhone,
  type ImportLookup,
} from "../../src/features/cases/import-plan";
import { parseCaseImportCsv } from "../../src/features/cases/import-csv";

const tutors: {
  id: string;
  user_id: string | null;
  display_name: string;
  tutor_code: string | null;
}[] = [
  { id: "t1", user_id: "u1", display_name: "Kitty Chan", tutor_code: "MM-T005" },
  { id: "t2", user_id: null, display_name: "Marcus Wong", tutor_code: "MM-T012" },
];

const lookup: ImportLookup = {
  findTutor: (needle) => {
    const n = needle.trim().toLowerCase();
    return (
      tutors.find((t) => (t.tutor_code ?? "").toLowerCase() === n) ??
      tutors.find((t) => t.display_name.toLowerCase() === n) ??
      null
    );
  },
  findParentByPhone: (phone) => (normalizePhone(phone) === "91234567" ? { id: "p1" } : null),
};

describe("import planning (#201)", () => {
  it("normalizes phones to digits and strips the 852 country code", () => {
    expect(normalizePhone("+852 9123 4567")).toBe("91234567");
    expect(normalizePhone("9123-4567")).toBe("91234567");
    expect(normalizePhone("85231234")).toBe("85231234"); // 8 digits stays intact
  });

  it("resolves tutor by code case-insensitively and parent by phone", () => {
    const csv = [
      "parent name,phone,tutor,subject,rate,lesson dates,fee paid",
      "Mrs. Chan,+852 9123 4567,mm-t005,Physics,500,2026-10-01;2026-10-08,yes",
    ].join("\n");
    const res = buildImportOps(parseCaseImportCsv(csv).rows, lookup);
    expect(res.errors).toEqual([]);
    expect(res.ops).toHaveLength(1);
    const op = res.ops[0];
    expect(op.tutorId).toBe("t1");
    expect(op.parentAccountId).toBe("p1");
    expect(op.lessonDateKeys).toEqual(["2026-10-01", "2026-10-08"]); // date order
    expect(op.feePaid).toBe(true);
    expect(op.hourlyRateHkd).toBe(500);
  });

  it("falls back to exact display-name tutor match", () => {
    const csv = [
      "parent name,phone,tutor,subject,rate,lesson dates,fee paid",
      "Mr. Lee,91234567,Marcus Wong,IB Math,650,2026/10/02,no",
    ].join("\n");
    const res = buildImportOps(parseCaseImportCsv(csv).rows, lookup);
    expect(res.errors).toEqual([]);
    expect(res.ops[0].tutorId).toBe("t2");
    expect(res.ops[0].parentAccountId).toBe("p1"); // 91234567 matches the seeded parent
  });

  it("unresolvable tutor -> row error, never a guess", () => {
    const csv = [
      "parent name,phone,tutor,subject,rate,lesson dates,fee paid",
      "X,9,Y,Math,300,2026-10-01,yes",
    ].join("\n");
    const res = buildImportOps(parseCaseImportCsv(csv).rows, lookup);
    expect(res.ops).toHaveLength(0);
    expect(res.errors).toEqual([{ row: 1, message: 'tutor "Y" not found' }]);
  });

  it("sorts lesson dates chronologically regardless of CSV order", () => {
    const csv = [
      "parent name,phone,tutor,subject,rate,lesson dates,fee paid",
      "A,9,MM-T005,Math,300,2026-10-08;2026-10-01,yes",
    ].join("\n");
    const res = buildImportOps(parseCaseImportCsv(csv).rows, lookup);
    expect(res.ops[0].lessonDateKeys).toEqual(["2026-10-01", "2026-10-08"]);
  });
});
