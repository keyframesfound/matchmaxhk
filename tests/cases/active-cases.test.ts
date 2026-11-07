import { describe, expect, it } from "vitest";

import {
  projectActiveCases,
  type ActiveCaseRow,
  type PartyVisibility,
} from "@/features/cases/active-cases/active-cases";

const NOW = new Date("2026-11-07T00:00:00Z");
const TUTOR_USER = "tutor-user";
const PARENT_USER = "parent-user";

const row = (over: Partial<ActiveCaseRow> = {}): ActiveCaseRow => ({
  id: "case-1",
  caseCode: "MM-2048",
  sorStatus: "active",
  caseType: "private",
  organisationId: null,
  subjects: ["Chemistry"],
  examSystem: "HKDSE",
  studentLevel: "S5",
  mode: "in_person",
  district: "Sha Tin",
  hourlyRateHkd: 400,
  rateUnit: "hr",
  learnerNickname: "Mia",
  endedAt: null,
  parentUserId: PARENT_USER,
  parentHandle: "mia-mum",
  tutorUserId: TUTOR_USER,
  tutorCode: "MM-T001",
  tutorName: "Kate",
  ...over,
});

const hide = (userId: string): [string, PartyVisibility] => [
  `case-1:${userId}`,
  { show: false, maskRate: false, maskStudent: false, maskDistrict: false },
];
const mask = (userId: string, over: Partial<PartyVisibility>): [string, PartyVisibility] => [
  `case-1:${userId}`,
  { show: true, maskRate: false, maskStudent: false, maskDistrict: false, ...over },
];

const tutorView = (
  rows: ActiveCaseRow[],
  entries: [string, PartyVisibility][] = [],
  owner = false,
) =>
  projectActiveCases(
    rows,
    new Map(entries),
    { side: "tutor", ownerUserId: TUTOR_USER },
    {
      ownerView: owner,
      now: NOW,
    },
  );

describe("projectActiveCases defaults (#633/#635)", () => {
  it("shows a case publicly by default with exact rate and clickable parent", () => {
    const { active, activeCount } = tutorView([row()]);
    expect(activeCount).toBe(1);
    expect(active[0]).toMatchObject({
      rateHkd: 400,
      area: "Sha Tin",
      studentName: "Mia",
      counterparty: { kind: "parent", href: "/u/mia-mum" },
    });
  });

  it("never puts private fields in the public payload", () => {
    const payload = JSON.stringify(tutorView([row()]));
    for (const leaked of ["parent-user", "tutor-user", "case-1", "privacy"]) {
      expect(payload).not.toContain(leaked);
    }
  });

  it("separates active from past and ignores rows that never started", () => {
    const result = tutorView([
      row(),
      row({ id: "case-2", sorStatus: "closed" }),
      row({ id: "case-3", sorStatus: null }),
    ]);
    expect([result.activeCount, result.pastCount]).toEqual([1, 1]);
  });
});

describe("hiding (#635: per-profile, no dual consent)", () => {
  it("removes the card from my public profile but still counts it", () => {
    const { active, activeCount, recent45d } = tutorView([row()], [hide(TUTOR_USER)]);
    expect(active).toHaveLength(0);
    expect(activeCount).toBe(1);
    expect(recent45d).toBe(true);
  });

  it("keeps the other party's card and masks me as a non-clickable verified party", () => {
    const { active } = tutorView([row()], [hide(PARENT_USER)]);
    expect(active).toHaveLength(1);
    expect(active[0].counterparty).toEqual({ kind: "parent", label: null, href: null });
  });

  it("shows the owner their hidden card with a flag and their settings", () => {
    const { active } = tutorView([row()], [hide(TUTOR_USER)], true);
    expect(active[0]).toMatchObject({ hidden: true, caseId: "case-1" });
    expect(active[0].privacy?.show).toBe(false);
  });
});

describe("masks: the strictest party wins on public (#635)", () => {
  it.each([
    [TUTOR_USER, "my"],
    [PARENT_USER, "the other party's"],
  ])("applies %s (%s) masks", (userId) => {
    const { active } = tutorView(
      [row()],
      [mask(userId, { maskRate: true, maskStudent: true, maskDistrict: true })],
    );
    expect(active[0]).toMatchObject({ rateHkd: null, studentName: null, area: null });
  });

  it("does not treat an online case as a masked area", () => {
    const { active } = tutorView([row({ district: null, mode: "online" })]);
    expect(active[0]).toMatchObject({ area: null, areaMasked: false });
  });
});

describe("45-day activity pill (#462)", () => {
  it("stays on for 45 days after the case ended, then turns off", () => {
    const ended = (at: string) => tutorView([row({ sorStatus: "closed", endedAt: at })]).recent45d;
    expect(ended("2026-10-01T00:00:00Z")).toBe(true);
    expect(ended("2026-09-01T00:00:00Z")).toBe(false);
  });
});

describe("parent and centre profiles (#633)", () => {
  it("links the tutor from a parent's profile", () => {
    const { active } = projectActiveCases(
      [row()],
      new Map(),
      { side: "parent", ownerUserId: PARENT_USER },
      { ownerView: false, now: NOW },
    );
    expect(active[0].counterparty).toEqual({
      kind: "tutor",
      label: "Kate",
      href: "/tutors/MM-T001",
    });
  });

  it("marks a case linked to a centre as a centre case", () => {
    const { active } = tutorView([row({ organisationId: "org-1" })]);
    expect(active[0].caseType).toBe("centre");
  });
});
