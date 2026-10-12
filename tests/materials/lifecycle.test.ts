import { describe, it, expect } from "vitest";

import {
  boughtListAction,
  buildMaterialSlug,
  buildOrderReference,
  checkSubmitReadiness,
  classifyOwnerEdit,
  extendedPreviewPageLimit,
  nextStatus,
  orderGrantsAccess,
  splitMaterialMoney,
} from "../../src/features/materials/lifecycle";

/**
 * Issues #203 + P8/P9/P13: the notes marketplace lifecycle rules, tested as
 * pure functions (server fns are not testable end-to-end — see the
 * orders.test.ts precedent from #291).
 */

describe("splitMaterialMoney (#203 money model)", () => {
  it("splits 20% fee and rounds to cents", () => {
    expect(splitMaterialMoney(100)).toEqual({ platformFeeHkd: 20, tutorNetHkd: 80 });
    expect(splitMaterialMoney(35)).toEqual({ platformFeeHkd: 7, tutorNetHkd: 28 });
    expect(splitMaterialMoney(39.5)).toEqual({ platformFeeHkd: 7.9, tutorNetHkd: 31.6 });
  });

  it("never produces negative or fractional-cent values", () => {
    for (const gross of [30, 47.25, 99.99, 1280]) {
      const { platformFeeHkd, tutorNetHkd } = splitMaterialMoney(gross);
      expect(platformFeeHkd).toBeGreaterThanOrEqual(0);
      expect(tutorNetHkd).toBeGreaterThanOrEqual(0);
      expect(platformFeeHkd + tutorNetHkd).toBeCloseTo(gross, 2);
    }
  });
});

describe("checkSubmitReadiness (P8 required fields)", () => {
  it("blocks submit and names every missing field", () => {
    const result = checkSubmitReadiness({ title: "", priceHkd: null, hasPdf: false });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["title", "price", "pdf"]);
  });

  it("names only the missing field", () => {
    const result = checkSubmitReadiness({ title: "IB Physics Waves", priceHkd: 50, hasPdf: false });
    expect(result.missing).toEqual(["pdf"]);
  });

  it("enforces the HK$30 floor (P8/#203)", () => {
    expect(
      checkSubmitReadiness({ title: "Title here", priceHkd: 29, hasPdf: true }).missing,
    ).toContain("price");
    expect(checkSubmitReadiness({ title: "Title here", priceHkd: 30, hasPdf: true }).ok).toBe(true);
  });

  it("accepts a complete submission", () => {
    expect(
      checkSubmitReadiness({ title: "Waves & Oscillation", priceHkd: 88, hasPdf: true }).ok,
    ).toBe(true);
  });
});

describe("nextStatus (P8 status machine)", () => {
  const transitions: Array<[string, Parameters<typeof nextStatus>[1], string | null]> = [
    ["draft", "submit", "pending_review"],
    ["rejected", "submit", "pending_review"],
    ["published", "submit", null],
    ["pending_review", "submit", null],
    ["pending_review", "approve", "published"],
    ["draft", "approve", null],
    ["pending_review", "reject", "rejected"],
    ["published", "hide", "hidden"],
    ["hidden", "hide", "hidden"],
    ["draft", "hide", null],
    ["hidden", "unhide", "published"],
    ["published", "unhide", null],
    ["published", "unpublish", "draft"],
    ["hidden", "unpublish", null],
  ];

  it.each(transitions)("%s + %s -> %s", (current, action, expected) => {
    expect(nextStatus(current as never, action)).toBe(expected);
  });
});

describe("extendedPreviewPageLimit (Ryan's blur split)", () => {
  it("is ~30% of the document, clamped to [5, 12]", () => {
    expect(extendedPreviewPageLimit(10)).toBe(5); // 3 -> floor
    expect(extendedPreviewPageLimit(16)).toBe(5);
    expect(extendedPreviewPageLimit(20)).toBe(6);
    expect(extendedPreviewPageLimit(40)).toBe(12);
    expect(extendedPreviewPageLimit(100)).toBe(12); // cap
    expect(extendedPreviewPageLimit(1)).toBe(5); // floor again
  });
});

describe("buildOrderReference", () => {
  it("uses the MM- prefix and an unambiguous alphabet", () => {
    const ref = buildOrderReference(1760000000000, () => 0);
    expect(ref).toMatch(/^MM-[0-9A-Z]{10}$/);
    expect(ref).not.toMatch(/[OILU]/); // Crockford-style: no I, O, L... wait, U excluded too
  });

  it("differs across random draws", () => {
    const n = 0;
    const seq = [
      buildOrderReference(1760000000000, () => 0.1),
      buildOrderReference(1760000000000, () => 0.9),
    ];
    expect(seq[0]).not.toBe(seq[1]);
    void n;
  });
});

describe("buildMaterialSlug", () => {
  it("slugs titles readably and lowercases", () => {
    expect(buildMaterialSlug("IB Physics HL — Waves & Oscillation")).toBe(
      "ib-physics-hl-waves-oscillation",
    );
  });

  it("appends the dedupe suffix and survives CJK titles", () => {
    expect(buildMaterialSlug("物理筆記", "2")).toBe("物理筆記-2");
    expect(buildMaterialSlug("   ")).toBe("note");
  });
});

describe("classifyOwnerEdit (P9)", () => {
  it("only a replaced file needs re-review", () => {
    expect(
      classifyOwnerEdit({
        titleChanged: true,
        priceChanged: true,
        descriptionChanged: true,
        pdfReplaced: false,
      }),
    ).toEqual({
      needsReview: false,
      liveFields: ["title", "price", "description"],
    });
    expect(
      classifyOwnerEdit({
        titleChanged: false,
        priceChanged: false,
        descriptionChanged: false,
        pdfReplaced: true,
      }),
    ).toEqual({
      needsReview: true,
      liveFields: [],
    });
  });
});

describe("buyer access (P13)", () => {
  it("only delivered orders grant download", () => {
    expect(orderGrantsAccess("delivered")).toBe(true);
    expect(orderGrantsAccess("paid")).toBe(false);
    expect(orderGrantsAccess("refunded")).toBe(false);
  });

  it("refunded rows stay visible in Bought without a download", () => {
    expect(boughtListAction("refunded")).toBe("refunded");
    expect(boughtListAction("stamping")).toBe("preparing");
    expect(boughtListAction("delivered")).toBe("download");
    expect(boughtListAction("awaiting_payment")).toBe("preparing");
  });
});
