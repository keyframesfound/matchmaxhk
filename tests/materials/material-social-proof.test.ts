import { describe, expect, it } from "vitest";

import {
  MATERIAL_SOCIAL_PROOF_MIN,
  selectMaterialCardSocialProof,
} from "../../src/features/materials/material-social-proof";

/**
 * Issue #768 (Part 2 AC #4): note / course cards render exactly ONE muted
 * social-proof line. Sold (>= 3) wins, else saved (>= 3), else "New release".
 * Never "0 sold".
 */
describe("#768 material card social proof", () => {
  it("keeps the threshold at 3", () => {
    expect(MATERIAL_SOCIAL_PROOF_MIN).toBe(3);
  });

  it("shows New release for 0 sold / 0 saved", () => {
    expect(selectMaterialCardSocialProof({ salesCount: 0, savesCount: 0 })).toEqual({
      sold: null,
      saved: null,
      isNew: true,
    });
  });

  it("prefers saved when sales are below threshold", () => {
    expect(selectMaterialCardSocialProof({ salesCount: 2, savesCount: 5 })).toEqual({
      sold: null,
      saved: 5,
      isNew: false,
    });
  });

  it("shows sold at exactly 3", () => {
    expect(selectMaterialCardSocialProof({ salesCount: 3, savesCount: 0 })).toEqual({
      sold: 3,
      saved: null,
      isNew: false,
    });
  });

  it("hides 1 sold and takes saved at 3", () => {
    expect(selectMaterialCardSocialProof({ salesCount: 1, savesCount: 3 })).toEqual({
      sold: null,
      saved: 3,
      isNew: false,
    });
  });

  it("lets sold win when both clear the threshold", () => {
    expect(selectMaterialCardSocialProof({ salesCount: 3, savesCount: 3 })).toEqual({
      sold: 3,
      saved: null,
      isNew: false,
    });
  });

  it("treats missing input as New release", () => {
    expect(selectMaterialCardSocialProof()).toEqual({ sold: null, saved: null, isNew: true });
    expect(selectMaterialCardSocialProof(null)).toEqual({ sold: null, saved: null, isNew: true });
    expect(selectMaterialCardSocialProof({})).toEqual({ sold: null, saved: null, isNew: true });
  });

  it("coerces null / undefined / negative / non-finite counts to 0", () => {
    expect(
      selectMaterialCardSocialProof({
        salesCount: null,
        savesCount: undefined,
      }),
    ).toEqual({ sold: null, saved: null, isNew: true });

    expect(selectMaterialCardSocialProof({ salesCount: -5, savesCount: Number.NaN })).toEqual({
      sold: null,
      saved: null,
      isNew: true,
    });

    expect(selectMaterialCardSocialProof({ salesCount: 4, savesCount: -1 })).toEqual({
      sold: 4,
      saved: null,
      isNew: false,
    });
  });

  it("ignores saves when sold already renders", () => {
    expect(selectMaterialCardSocialProof({ salesCount: 12, savesCount: 40 })).toEqual({
      sold: 12,
      saved: null,
      isNew: false,
    });
  });
});
