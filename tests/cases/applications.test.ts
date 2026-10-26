// Issue #81 — case-application eligibility + note validation matrix.
// Pure helpers only (applications.ts), no supabase — matches the tests/cases
// suite style (relative imports, plain fixtures).
import { describe, expect, it } from "vitest";

import {
  APPLICATION_NOTE_MAX,
  APPLICATION_STATUSES,
  canApplyToCase,
  caseGenderMismatch,
  isApplicationStatus,
  validateApplicationNote,
} from "../../src/features/cases/applications";

const openCase = {
  boardPublishedAt: "2026-10-20T00:00:00Z",
  status: "new",
  preferredGender: "any" as const,
};

const tutor = { gender: "female" };

describe("canApplyToCase (#81 eligibility matrix)", () => {
  it("allows an open, published case for a tutor with a card", () => {
    expect(canApplyToCase(openCase, tutor)).toEqual({ ok: true });
  });

  it("blocks when the case is not on the board", () => {
    expect(canApplyToCase({ ...openCase, boardPublishedAt: null }, tutor)).toEqual({
      ok: false,
      reason: "CASE_NOT_ON_BOARD",
    });
  });

  it("blocks every taken-off-board status", () => {
    for (const status of ["matched", "closed", "rejected", "compliance_hold"]) {
      expect(canApplyToCase({ ...openCase, status }, tutor)).toEqual({
        ok: false,
        reason: "CASE_CLOSED",
      });
    }
    expect(canApplyToCase({ ...openCase, status: "contacted" }, tutor)).toEqual({ ok: true });
  });

  it("blocks when the tutor has no card (profile null)", () => {
    expect(canApplyToCase(openCase, null)).toEqual({
      ok: false,
      reason: "NO_TUTOR_PROFILE",
    });
  });

  it("blocks a preferred-gender mismatch in both directions (same rule as the WA dim)", () => {
    expect(canApplyToCase({ ...openCase, preferredGender: "female" }, { gender: "male" })).toEqual({
      ok: false,
      reason: "GENDER_MISMATCH",
    });
    expect(canApplyToCase({ ...openCase, preferredGender: "male" }, { gender: "female" })).toEqual({
      ok: false,
      reason: "GENDER_MISMATCH",
    });
  });

  it("never mismatches on any-preference cases or genderless tutors", () => {
    expect(
      canApplyToCase({ ...openCase, preferredGender: "female" }, { gender: "female" }),
    ).toEqual({ ok: true });
    expect(canApplyToCase({ ...openCase, preferredGender: "male" }, { gender: null })).toEqual({
      ok: true,
    });
    expect(canApplyToCase(openCase, { gender: null })).toEqual({ ok: true });
  });

  it("is case-insensitive and whitespace-tolerant on the tutor gender", () => {
    expect(
      canApplyToCase({ ...openCase, preferredGender: "female" }, { gender: " Male " }),
    ).toEqual({ ok: false, reason: "GENDER_MISMATCH" });
  });

  it("gates centre cases on the screening confirm radio", () => {
    const centreCase = { ...openCase, centre: true };
    expect(canApplyToCase(centreCase, tutor)).toEqual({
      ok: false,
      reason: "SCREENING_CONFIRM_REQUIRED",
    });
    expect(canApplyToCase({ ...centreCase, screeningConfirmed: true }, tutor)).toEqual({
      ok: true,
    });
    // Parent cases ignore the screening flags entirely.
    expect(canApplyToCase({ ...openCase, screeningConfirmed: false }, tutor)).toEqual({
      ok: true,
    });
  });

  it("checks gates in order: on-board → status → profile → gender → screening", () => {
    expect(
      canApplyToCase(
        { boardPublishedAt: null, status: "matched", preferredGender: "female" },
        null,
      ),
    ).toEqual({ ok: false, reason: "CASE_NOT_ON_BOARD" });
    expect(
      canApplyToCase({ ...openCase, status: "matched", preferredGender: "female" }, null),
    ).toEqual({ ok: false, reason: "CASE_CLOSED" });
    expect(canApplyToCase({ ...openCase, preferredGender: "female", centre: true }, null)).toEqual({
      ok: false,
      reason: "NO_TUTOR_PROFILE",
    });
    expect(
      canApplyToCase({ ...openCase, preferredGender: "female", centre: true }, { gender: "male" }),
    ).toEqual({ ok: false, reason: "GENDER_MISMATCH" });
  });
});

describe("caseGenderMismatch (#423 dim rule, factored for #81)", () => {
  it("mirrors the WhatsApp-button rule", () => {
    expect(caseGenderMismatch("female", "male")).toBe(true);
    expect(caseGenderMismatch("male", "female")).toBe(true);
    expect(caseGenderMismatch("female", "female")).toBe(false);
    expect(caseGenderMismatch("any", "male")).toBe(false);
    expect(caseGenderMismatch("female", null)).toBe(false);
    expect(caseGenderMismatch("female", undefined)).toBe(false);
    expect(caseGenderMismatch("female", "")).toBe(false);
    // Unknown tokens are not a known contradiction.
    expect(caseGenderMismatch("female", "prefer_not_to_say")).toBe(false);
  });
});

describe("validateApplicationNote (#81 note rules)", () => {
  it("normalises empty/whitespace notes to null", () => {
    expect(validateApplicationNote(null)).toEqual({ ok: true, note: null });
    expect(validateApplicationNote(undefined)).toEqual({ ok: true, note: null });
    expect(validateApplicationNote("   ")).toEqual({ ok: true, note: null });
  });

  it("trims and passes a clean note through", () => {
    expect(validateApplicationNote("  I can start next week.  ")).toEqual({
      ok: true,
      note: "I can start next week.",
    });
  });

  it("rejects notes over the 500-char cap", () => {
    expect(APPLICATION_NOTE_MAX).toBe(500);
    expect(validateApplicationNote("a".repeat(500)).ok).toBe(true);
    const long = validateApplicationNote("a".repeat(501));
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toContain("500");
  });

  it("rejects contact details with the shared filter copy", () => {
    const phone = validateApplicationNote("Reach me on 9123 4567 anytime.");
    expect(phone.ok).toBe(false);
    if (!phone.ok) expect(phone.error).toContain("No contact details");

    const channel = validateApplicationNote("Ping me on WhatsApp please");
    expect(channel.ok).toBe(false);
    if (!channel.ok) expect(channel.error).toContain("WhatsApp");

    const email = validateApplicationNote("email me at tutor@example.com");
    expect(email.ok).toBe(false);
  });
});

describe("application status tokens", () => {
  it("exposes exactly the DB CHECK set, in triage order", () => {
    expect(APPLICATION_STATUSES).toEqual(["new", "reviewed", "shortlisted", "rejected"]);
  });

  it("validates status tokens", () => {
    expect(isApplicationStatus("shortlisted")).toBe(true);
    expect(isApplicationStatus("approved")).toBe(false);
    expect(isApplicationStatus(42)).toBe(false);
    expect(isApplicationStatus(null)).toBe(false);
  });
});
