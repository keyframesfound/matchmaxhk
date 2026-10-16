import { describe, expect, it } from "vitest";

import {
  TERMS_SURFACES,
  TERMS_VERSION,
  buildTermsAcceptanceRow,
  hasCurrentAcceptance,
  isTermsSurface,
} from "../../src/features/legal/terms";

describe("buildTermsAcceptanceRow", () => {
  it("builds a row at the current version with null subject", () => {
    expect(
      buildTermsAcceptanceRow({ userId: "u1", surface: "signup" }),
    ).toEqual({
      user_id: "u1",
      surface: "signup",
      terms_version: TERMS_VERSION,
      subject_id: null,
    });
  });

  it("keeps the subject id when the gate carries one", () => {
    expect(
      buildTermsAcceptanceRow({
        userId: "u1",
        surface: "checkout",
        subjectId: "order-1",
      }).subject_id,
    ).toBe("order-1");
  });

  it("throws on an anonymous user", () => {
    expect(() =>
      buildTermsAcceptanceRow({ userId: "", surface: "signup" }),
    ).toThrow(/signed-in user/);
  });

  it("throws on an unknown surface", () => {
    expect(() =>
      buildTermsAcceptanceRow({ userId: "u1", surface: "blog_comment" as never }),
    ).toThrow(/unknown terms surface/);
  });

  it("covers exactly the four gated surfaces", () => {
    expect([...TERMS_SURFACES]).toEqual([
      "signup",
      "note_upload",
      "checkout",
      "referral_signup",
    ]);
    expect(isTermsSurface("note_upload")).toBe(true);
    expect(isTermsSurface("NO_UPLOAD")).toBe(false);
  });
});

describe("hasCurrentAcceptance", () => {
  it("matches surface and current version", () => {
    const rows = [
      { surface: "signup" as const, terms_version: TERMS_VERSION, subject_id: null },
      { surface: "checkout" as const, terms_version: "2026-09-01", subject_id: null },
    ];
    expect(hasCurrentAcceptance(rows, "signup")).toBe(true);
    expect(hasCurrentAcceptance(rows, "checkout")).toBe(false);
    expect(hasCurrentAcceptance(rows, "note_upload")).toBe(false);
  });

  it("respects the subject when one is required", () => {
    const rows = [
      {
        surface: "checkout" as const,
        terms_version: TERMS_VERSION,
        subject_id: "order-1",
      },
    ];
    expect(hasCurrentAcceptance(rows, "checkout", "order-1")).toBe(true);
    expect(hasCurrentAcceptance(rows, "checkout", "order-2")).toBe(false);
    // No subject required → any row for the surface at the current version.
    expect(hasCurrentAcceptance(rows, "checkout")).toBe(true);
  });
});
