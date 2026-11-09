import { describe, expect, it } from "vitest";

import {
  isMatchProfileComplete,
  scoreCaseForTutor,
  sortCasesByBestMatch,
  type TutorMatchProfile,
} from "../../src/features/cases/case-best-match";

const ibTutor: TutorMatchProfile = {
  subjects: ["Physics", "Mathematics"],
  targetStudents: ["Secondary", "IB"],
  lessonMode: "either",
  stations: ["Sha Tin"],
  district: null,
  gender: "male",
  tutorStatus: "uni_undergrad",
  profileTags: [],
};

const base = {
  studentLevel: "Senior secondary",
  academicTier: "primary_secondary",
  district: "Sha Tin",
  mode: "either",
  preferredGender: "any",
  tutorBackground: null,
  tags: [],
};

const ibPhysics = { id: "a", ...base, subjects: ["Physics"], examSystem: "IB" };
const primaryEnglish = {
  id: "b",
  ...base,
  studentLevel: "Primary",
  subjects: ["English"],
  examSystem: "Primary School",
};
const kinder = {
  id: "c",
  ...base,
  academicTier: "kindergarten",
  studentLevel: "Kindergarten",
  subjects: ["Phonics"],
  examSystem: null,
};

describe("#699 case best match", () => {
  it("badges a curriculum + subject + stage fit", () => {
    const match = scoreCaseForTutor(ibPhysics, ibTutor);
    expect(match.matched).toBe(true);
    expect(match.score).toBeGreaterThanOrEqual(70);
  });

  it("never badges a case outside the tutor's subjects or stage", () => {
    expect(scoreCaseForTutor(primaryEnglish, ibTutor).matched).toBe(false);
    expect(scoreCaseForTutor(kinder, ibTutor).matched).toBe(false);
  });

  it("orders best match first and keeps every case", () => {
    const { items } = sortCasesByBestMatch([primaryEnglish, kinder, ibPhysics], ibTutor);
    expect(items.map((c) => c.id)[0]).toBe("a");
    expect(items).toHaveLength(3);
  });

  it("falls back to the incoming (latest) order for an incomplete profile", () => {
    const incomplete = { ...ibTutor, targetStudents: [] };
    expect(isMatchProfileComplete(incomplete)).toBe(false);
    const { items } = sortCasesByBestMatch([primaryEnglish, kinder, ibPhysics], incomplete);
    expect(items.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });
});
