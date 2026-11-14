import { describe, expect, it } from "vitest";

import {
  caseMatchesSavedSearch,
  tutorMatchesSavedSearch,
} from "../../src/features/search/saved-search-match";

const tutor = {
  subjects: ["IB Physics HL", "IB Math AA HL"],
  target_students: ["Secondary"],
  card_highlights: ["IBDP 42/45"],
  tutor_status: "part_time",
  lesson_mode: "either",
  stations: ["Sha Tin"],
  gender: "female",
  verification_tier: "tier_2_verified",
  tutor_code: "MM-T077",
  display_name: "Chloe",
};

describe("#725 saved-search matcher: tutors", () => {
  it("matches curriculum, subject, status, mode and station", () => {
    expect(
      tutorMatchesSavedSearch(
        {
          category: "IB",
          subject: "Physics",
          status: "part_time",
          mode: "in_person",
          station: "Sha Tin",
        },
        tutor,
      ),
    ).toBe(true);
  });

  it("rejects a missing subject, a wrong status or a wrong gender", () => {
    expect(tutorMatchesSavedSearch({ subject: "Chemistry" }, tutor)).toBe(false);
    expect(tutorMatchesSavedSearch({ status: "examiner" }, tutor)).toBe(false);
    expect(tutorMatchesSavedSearch({ gender: "male" }, tutor)).toBe(false);
  });

  it("honours OR vs must-teach-all subjects", () => {
    expect(
      tutorMatchesSavedSearch({ subject: "Physics", subjects_extra: "Chemistry" }, tutor),
    ).toBe(true);
    expect(
      tutorMatchesSavedSearch(
        { subject: "Physics", subjects_extra: "Chemistry", subject_match: "and" },
        tutor,
      ),
    ).toBe(false);
  });

  it("matches a keyword against code, name and subjects", () => {
    expect(tutorMatchesSavedSearch({ q: "mm-t077" }, tutor)).toBe(true);
    expect(tutorMatchesSavedSearch({ q: "economics" }, tutor)).toBe(false);
  });
});

describe("#725 saved-search matcher: cases", () => {
  const item = {
    subjects: ["Chemistry"],
    exam_system: "DSE",
    district: "Sha Tin",
    mode: "either",
    title: "S5 DSE Chemistry",
    case_code: "MC-1001",
  };

  it("matches the board filters", () => {
    expect(
      caseMatchesSavedSearch(
        { category: "DSE", subject: "Chemistry", district: "Sha Tin", mode: "online" },
        item,
      ),
    ).toBe(true);
  });

  it("rejects another curriculum, district or an online-only clash", () => {
    expect(caseMatchesSavedSearch({ category: "IB" }, item)).toBe(false);
    expect(caseMatchesSavedSearch({ district: "Central" }, item)).toBe(false);
    expect(caseMatchesSavedSearch({ mode: "online" }, { ...item, mode: "in_person" })).toBe(false);
  });
});
