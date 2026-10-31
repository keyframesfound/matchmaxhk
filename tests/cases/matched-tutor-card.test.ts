import { describe, expect, it } from "vitest";

import { matchedTutorCard, tutorInitials } from "../../src/features/cases/parent/matched-tutor";

/**
 * Issue #529 bait-and-switch card: the parent sees who was matched (name,
 * photo, university, rate, student count) so the person at the door can be
 * checked against the profile.
 */
describe("matchedTutorCard", () => {
  const tutor = {
    tutor_code: "T1234",
    display_name: "  Chan Tai Man ",
    photo_url: "https://cdn.example/t.jpg",
    undergrad_university: "HKU",
  };

  it("builds the card from the matched tutor and the case's locked terms", () => {
    expect(matchedTutorCard({ tutor, hourlyRateHkd: 400, studentCount: 1 })).toEqual({
      tutorCode: "T1234",
      displayName: "Chan Tai Man",
      initials: "CT",
      photoUrl: "https://cdn.example/t.jpg",
      university: "HKU",
      hourlyRateHkd: 400,
      studentCount: 1,
    });
  });

  it("is null without a matched tutor", () => {
    expect(matchedTutorCard({ tutor: null, hourlyRateHkd: 400, studentCount: 1 })).toBeNull();
  });

  it("drops blank fields and bad numbers instead of showing junk", () => {
    const card = matchedTutorCard({
      tutor: { ...tutor, photo_url: " ", undergrad_university: "" },
      hourlyRateHkd: 0,
      studentCount: null,
    });
    expect(card?.photoUrl).toBeNull();
    expect(card?.university).toBeNull();
    expect(card?.hourlyRateHkd).toBeNull();
    expect(card?.studentCount).toBe(1);
  });

  it("accepts the embed as a one-row array", () => {
    expect(
      matchedTutorCard({ tutor: [tutor], hourlyRateHkd: 380, studentCount: 2 })?.studentCount,
    ).toBe(2);
  });
});

describe("tutorInitials", () => {
  it("takes up to two initials", () => {
    expect(tutorInitials("Chan Tai Man")).toBe("CT");
    expect(tutorInitials("amy")).toBe("A");
    expect(tutorInitials("陳大文")).toBe("陳");
    expect(tutorInitials("  ")).toBe("?");
  });
});
