import { describe, expect, it } from "vitest";

import {
  canEndCase,
  decideCaseEnd,
  isCaseEnded,
  sideHasEnded,
} from "../../src/features/cases/end-case";

describe("bilateral End Case decision (#503)", () => {
  it("only ongoing post-fee cases are endable", () => {
    expect(canEndCase("fee_paid")).toBe(true);
    expect(canEndCase("active")).toBe(true);
    expect(canEndCase("lesson_1_done")).toBe(false);
    expect(canEndCase("fee_invoiced")).toBe(false);
    expect(canEndCase("closed")).toBe(false);
    expect(canEndCase(null)).toBe(false);
  });

  it("first tap marks; both taps complete", () => {
    expect(
      decideCaseEnd({
        sorStatus: "fee_paid",
        endedByParentAt: null,
        endedByTutorAt: null,
        actorRole: "parent",
      }),
    ).toEqual({ action: "mark" });

    expect(
      decideCaseEnd({
        sorStatus: "active",
        endedByParentAt: "2026-01-01T00:00:00Z",
        endedByTutorAt: null,
        actorRole: "tutor",
      }),
    ).toEqual({ action: "complete" });
  });

  it("a re-tap by the same side is an idempotent mark, not an error", () => {
    expect(
      decideCaseEnd({
        sorStatus: "active",
        endedByParentAt: "2026-01-01T00:00:00Z",
        endedByTutorAt: null,
        actorRole: "parent",
      }),
    ).toEqual({ action: "mark" });
  });

  it("rejects an already ended case and non-ongoing states", () => {
    expect(
      decideCaseEnd({
        sorStatus: "closed",
        endedByParentAt: null,
        endedByTutorAt: null,
        actorRole: "parent",
      }),
    ).toEqual({ action: "reject", message: "CASE_ENDED" });
    expect(
      decideCaseEnd({
        sorStatus: "lesson_1_done",
        endedByParentAt: null,
        endedByTutorAt: null,
        actorRole: "tutor",
      }),
    ).toEqual({ action: "reject", message: "NOT_ONGOING" });
    expect(
      decideCaseEnd({
        sorStatus: null,
        endedByParentAt: null,
        endedByTutorAt: null,
        actorRole: "parent",
      }),
    ).toEqual({ action: "reject", message: "NOT_ONGOING" });
  });

  it("sideHasEnded / isCaseEnded read the markers", () => {
    expect(sideHasEnded("t", null, "parent")).toBe(true);
    expect(sideHasEnded("t", null, "tutor")).toBe(false);
    expect(isCaseEnded({ sorStatus: "active", endedByParentAt: "t", endedByTutorAt: "t" })).toBe(
      true,
    );
    expect(isCaseEnded({ sorStatus: "active", endedByParentAt: "t", endedByTutorAt: null })).toBe(
      false,
    );
    // Staff force-end: 'closed' alone is ended even with no markers.
    expect(isCaseEnded({ sorStatus: "closed", endedByParentAt: null, endedByTutorAt: null })).toBe(
      true,
    );
  });
});
