import { describe, expect, it } from "vitest";

import {
  selectTutorCardSocialProof,
  type TutorCardSocialProofInput,
} from "../../src/features/tutors/card-social-proof";

const select = (input: TutorCardSocialProofInput) => selectTutorCardSocialProof(input);

describe("selectTutorCardSocialProof (#768 card social proof)", () => {
  it("active students wins over the parents line", () => {
    expect(select({ activeCasesCount: 3, engagementCount: 9, slotsLeft: 4 })).toEqual({
      activeStudents: 3,
      savedByParents: null,
      lastSlot: false,
    });
  });

  it("falls back to saved-by-parents when there are not enough active cases", () => {
    expect(select({ activeCasesCount: 1, engagementCount: 4, slotsLeft: 5 })).toEqual({
      activeStudents: null,
      savedByParents: 4,
      lastSlot: false,
    });
  });

  it("never renders 0 or 1 as social proof", () => {
    expect(select({ activeCasesCount: 0, engagementCount: 2, slotsLeft: 3 })).toEqual({
      activeStudents: null,
      savedByParents: null,
      lastSlot: false,
    });
    expect(select({ activeCasesCount: 1, engagementCount: 1 })).toEqual({
      activeStudents: null,
      savedByParents: null,
      lastSlot: false,
    });
  });

  it("flags the last slot when a class is already running", () => {
    expect(select({ activeCasesCount: 2, slotsLeft: 1 })).toEqual({
      activeStudents: 2,
      savedByParents: null,
      lastSlot: true,
    });
  });

  it("does not flag the last slot without enough active cases", () => {
    expect(select({ activeCasesCount: 1, slotsLeft: 1 }).lastSlot).toBe(false);
    expect(select({ slotsLeft: 1 }).lastSlot).toBe(false);
  });

  it("only slotsLeft === 1 is the last slot", () => {
    expect(select({ activeCasesCount: 5, slotsLeft: 0 }).lastSlot).toBe(false);
    expect(select({ activeCasesCount: 5, slotsLeft: 2 }).lastSlot).toBe(false);
  });

  it("treats undefined / null / non-finite / negative input as nothing", () => {
    const empty = { activeStudents: null, savedByParents: null, lastSlot: false };
    expect(selectTutorCardSocialProof()).toEqual(empty);
    expect(selectTutorCardSocialProof(undefined)).toEqual(empty);
    expect(selectTutorCardSocialProof(null)).toEqual(empty);
    expect(select({})).toEqual(empty);
    expect(
      select({
        activeCasesCount: Number.NaN,
        engagementCount: Number.POSITIVE_INFINITY,
        slotsLeft: Number.NaN,
      }),
    ).toEqual(empty);
    expect(select({ activeCasesCount: -3, engagementCount: -9, slotsLeft: -1 })).toEqual(empty);
    expect(select({ activeCasesCount: null, engagementCount: null, slotsLeft: null })).toEqual(
      empty,
    );
  });
});
