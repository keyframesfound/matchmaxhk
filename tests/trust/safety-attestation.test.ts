import { describe, expect, it } from "vitest";

import {
  allChecksTicked,
  attestationRequired,
  SAFETY_ATTESTATION_VERSION,
  scrcPreferenceApplies,
} from "../../src/features/trust/safety-attestation";

describe("#782 §2.1 Safety Attestation", () => {
  it("requires all three checkboxes", () => {
    expect(allChecksTicked({})).toBe(false);
    expect(allChecksTicked({ clean_record: true, zero_illegal: true })).toBe(false);
    expect(
      allChecksTicked({ clean_record: true, zero_illegal: true, independent_operator: true }),
    ).toBe(true);
  });

  it("gates tutors without a current attestation (AC-755-A1)", () => {
    const tutor = { hasTutorCard: true, isCommunitySellerOnly: false };
    expect(attestationRequired({ ...tutor, acceptedVersions: [] })).toBe(true);
    expect(attestationRequired({ ...tutor, acceptedVersions: ["v0.9"] })).toBe(true);
  });

  it("does not re-prompt after a valid attestation (AC-755-A2)", () => {
    expect(
      attestationRequired({
        hasTutorCard: true,
        isCommunitySellerOnly: false,
        acceptedVersions: [SAFETY_ATTESTATION_VERSION],
      }),
    ).toBe(false);
  });

  it("never gates guests, learners or community-seller-only accounts (AC-755-A3)", () => {
    expect(
      attestationRequired({
        hasTutorCard: false,
        isCommunitySellerOnly: false,
        acceptedVersions: [],
      }),
    ).toBe(false);
    expect(
      attestationRequired({
        hasTutorCard: true,
        isCommunitySellerOnly: true,
        acceptedVersions: [],
      }),
    ).toBe(false);
  });
});

describe("#782 §2.2 SCRC preference", () => {
  it("applies only to face-to-face K-12 requests (AC-755-S2)", () => {
    expect(scrcPreferenceApplies({ academicLevel: "Primary", mode: "offline" })).toBe(true);
    expect(scrcPreferenceApplies({ academicLevel: "Secondary", mode: "both" })).toBe(true);
    expect(scrcPreferenceApplies({ academicLevel: "Kindergarten", mode: "in_person" })).toBe(true);
    expect(scrcPreferenceApplies({ academicLevel: "Secondary", mode: "online" })).toBe(false);
    expect(scrcPreferenceApplies({ academicLevel: "University", mode: "offline" })).toBe(false);
    expect(scrcPreferenceApplies({ academicLevel: "Primary", mode: "" })).toBe(false);
  });
});
