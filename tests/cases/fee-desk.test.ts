import { describe, expect, it } from "vitest";

import {
  expectedMarkingDateHkt,
  fpsMemoForCase,
  isAllowedScreenshot,
  isReferenceUsedElsewhere,
  normalizeFpsReference,
} from "../../src/features/cases/fee-desk";

describe("fee desk (#259)", () => {
  it("builds the FPS memo from the case code", () => {
    expect(fpsMemoForCase("c-1234")).toBe("MM-C-1234");
    expect(fpsMemoForCase("MM-C-1")).toBe("MM-C-1");
  });

  it("normalizes references so MM- prefix and spacing do not matter", () => {
    expect(normalizeFpsReference(" mm-c 12 ")).toBe("C12");
    expect(normalizeFpsReference("C12")).toBe("C12");
    expect(normalizeFpsReference("ab")).toBeNull();
    expect(normalizeFpsReference(null)).toBeNull();
  });

  it("rejects a reference that already closed another case", () => {
    const paid = [{ caseId: "a", fpsReference: "MM-C-100" }];
    expect(isReferenceUsedElsewhere("c-100", "b", paid)).toBe(true);
    expect(isReferenceUsedElsewhere("c-100", "a", paid)).toBe(false);
    expect(isReferenceUsedElsewhere("C-101", "b", paid)).toBe(false);
    expect(isReferenceUsedElsewhere("", "b", paid)).toBe(false);
  });

  it("accepts JPEG/PNG up to 5 MB only", () => {
    expect(isAllowedScreenshot("image/png", 1000)).toBe(true);
    expect(isAllowedScreenshot("image/jpeg", 5 * 1024 * 1024)).toBe(true);
    expect(isAllowedScreenshot("image/jpeg", 5 * 1024 * 1024 + 1)).toBe(false);
    expect(isAllowedScreenshot("image/webp", 1000)).toBe(false);
    expect(isAllowedScreenshot("image/png", 0)).toBe(false);
  });

  it("marks same working day before 18:00 HKT", () => {
    // Mon 2026-11-02 10:00 HKT = 02:00 UTC
    expect(expectedMarkingDateHkt(new Date("2026-11-02T02:00:00Z"))).toBe("2026-11-02");
  });

  it("rolls a screenshot after 18:00 HKT to the next working day", () => {
    // Mon 2026-11-02 19:00 HKT
    expect(expectedMarkingDateHkt(new Date("2026-11-02T11:00:00Z"))).toBe("2026-11-03");
    // Fri 2026-11-06 20:00 HKT → Mon 2026-11-09
    expect(expectedMarkingDateHkt(new Date("2026-11-06T12:00:00Z"))).toBe("2026-11-09");
  });

  it("rolls weekend screenshots to Monday", () => {
    // Sat 2026-11-07 09:00 HKT
    expect(expectedMarkingDateHkt(new Date("2026-11-07T01:00:00Z"))).toBe("2026-11-09");
  });
});
