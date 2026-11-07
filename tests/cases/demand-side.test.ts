import { describe, expect, it } from "vitest";

import {
  buildHouseholdRows,
  demandSideAccess,
  emptyDemandSide,
  sanitizeDemandSide,
  seedDemandSide,
} from "@/features/cases/demand-side/demand-side";

describe("demandSideAccess (#637)", () => {
  const parties = { parentId: "p", studentOwnerId: "s", tutorUserId: "t" };

  it.each([
    ["p", false, "edit"],
    ["s", false, "edit"],
    ["t", false, "read"],
    ["x", true, "edit"],
    ["x", false, null],
  ])("gives %s (admin %s) %s", (userId, isAdmin, expected) => {
    expect(demandSideAccess({ userId, isAdmin, ...parties })).toBe(expected);
  });

  it("gives a parent who is also the tutor edit rights, not read", () => {
    expect(
      demandSideAccess({
        userId: "p",
        isAdmin: false,
        parentId: "p",
        studentOwnerId: null,
        tutorUserId: "p",
      }),
    ).toBe("edit");
  });
});

describe("seedDemandSide (#637)", () => {
  it("hydrates from the case request so parents do not retype", () => {
    const seeded = seedDemandSide(
      {
        description: "Needs help before mocks",
        languageOfInstruction: "en",
        gradeCurrent: "S5",
        createdAt: "2026-12-01T00:00:00Z",
      },
      null,
    );
    expect(seeded).toMatchObject({
      householdNotes: "Needs help before mocks",
      languageMedium: "english",
      currentLevel: "S5",
    });
  });

  it("uses saved household defaults only for cases created after they were saved", () => {
    const defaults = {
      savedAt: "2026-11-01T00:00:00Z",
      primaryGoal: "exam_boost",
      languageMedium: "putonghua",
      householdNotes: "Dog at home",
      feedbackStyle: "weekly",
    };
    const later = seedDemandSide(
      {
        description: null,
        languageOfInstruction: null,
        gradeCurrent: null,
        createdAt: "2026-12-01T00:00:00Z",
      },
      defaults,
    );
    const earlier = seedDemandSide(
      {
        description: null,
        languageOfInstruction: null,
        gradeCurrent: null,
        createdAt: "2026-10-01T00:00:00Z",
      },
      defaults,
    );
    expect(later).toMatchObject({ primaryGoal: "exam_boost", householdNotes: "Dog at home" });
    expect(earlier.primaryGoal).toBeNull();
  });

  it("lets this case's own request win over the saved defaults", () => {
    const seeded = seedDemandSide(
      {
        description: "From the request",
        languageOfInstruction: null,
        gradeCurrent: null,
        createdAt: "2026-12-01T00:00:00Z",
      },
      {
        savedAt: "2026-11-01T00:00:00Z",
        primaryGoal: null,
        languageMedium: null,
        householdNotes: "Default note",
        feedbackStyle: null,
      },
    );
    expect(seeded.householdNotes).toBe("From the request");
  });
});

describe("sanitizeDemandSide (#637)", () => {
  it("strips contact details from free text", () => {
    const clean = sanitizeDemandSide({
      ...emptyDemandSide(),
      householdNotes: "Call me on 91234567 or a@b.com",
      weakTopics: ["Moles, WhatsApp 91234567"],
    });
    expect(clean.householdNotes).not.toMatch(/91234567|a@b\.com/);
    expect(clean.weakTopics.join(" ")).not.toContain("91234567");
  });

  it("trims, dedupes and caps weak topics", () => {
    const clean = sanitizeDemandSide({
      ...emptyDemandSide(),
      weakTopics: [" Moles ", "Moles", "", ...Array.from({ length: 30 }, (_, i) => `T${i}`)],
    });
    expect(clean.weakTopics[0]).toBe("Moles");
    expect(new Set(clean.weakTopics).size).toBe(clean.weakTopics.length);
    expect(clean.weakTopics.length).toBeLessThanOrEqual(12);
  });
});

describe("buildHouseholdRows (#637)", () => {
  const now = new Date("2026-11-07T00:00:00Z");
  const base = {
    caseId: "c1",
    caseCode: "MM-1",
    sorStatus: "active",
    studentName: "Mia",
    subject: "Chemistry",
    tutorName: "Kate",
    primaryGoal: null,
    targetGrade: "5**",
    lessons: [
      { startsAt: "2026-11-10T09:00:00Z", status: "confirmed" },
      { startsAt: "2026-11-09T09:00:00Z", status: "planned" },
      { startsAt: "2026-11-08T09:00:00Z", status: "cancelled" },
      { startsAt: "2026-11-01T09:00:00Z", status: "confirmed" },
    ],
  };

  it("picks the next live lesson and leaves out ended or unstarted cases", () => {
    const rows = buildHouseholdRows(
      [
        base,
        { ...base, caseId: "c2", sorStatus: "closed" },
        { ...base, caseId: "c3", sorStatus: null },
      ],
      now,
    );
    expect(rows.map((row) => row.caseId)).toEqual(["c1"]);
    expect(rows[0].nextLessonAt).toBe("2026-11-09T09:00:00Z");
  });

  it("sorts cases with a sooner lesson first and unscheduled ones last", () => {
    const rows = buildHouseholdRows([{ ...base, caseId: "none", lessons: [] }, base], now);
    expect(rows.map((row) => row.caseId)).toEqual(["c1", "none"]);
  });
});
