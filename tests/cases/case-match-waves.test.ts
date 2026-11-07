import { describe, expect, it } from "vitest";

import {
  caseMatchFingerprint,
  decideWaveStep,
  MAX_WAVES,
  rankTutorsForCase,
  scoreTutorForCase,
  waveWindowEndsAt,
  type MatchCase,
  type MatchTutor,
} from "@/features/cases/case-match-waves";

const NOW = new Date("2026-11-07T04:00:00Z"); // 12:00 HKT

const baseCase: MatchCase = {
  subjects: ["Chemistry"],
  studentLevel: "S5",
  academicTier: null,
  examSystem: "HKDSE",
  district: "Sha Tin",
  mode: "in_person",
  preferredGender: "any",
  tutorBackground: "any",
  tags: [],
  parentId: "parent-1",
};

const baseTutor: MatchTutor = {
  id: "t1",
  tutorCode: "MM-T001",
  userId: "user-1",
  subjects: ["chemistry"],
  stations: ["Sha Tin"],
  district: null,
  lessonMode: "either",
  gender: "female",
  tutorStatus: "uni_undergrad",
  targetStudents: [],
  profileTags: [],
  isAccepting: true,
  accountStatus: "active",
  hasPhoto: true,
  hasHeadline: true,
  updatedAt: "2026-11-01T00:00:00Z",
  matchAlertsMuted: false,
  shadowbanned: false,
};

const tutor = (over: Partial<MatchTutor>): MatchTutor => ({ ...baseTutor, ...over });
const score = (t: Partial<MatchTutor>, c: Partial<MatchCase> = {}) =>
  scoreTutorForCase({ ...baseCase, ...c }, tutor(t), NOW);

describe("scoreTutorForCase hard filters (#657)", () => {
  it("rejects a tutor who does not teach the subject", () => {
    expect(score({ subjects: ["Physics"] })).toBeNull();
  });

  it("rejects an online-only tutor for an in-person case", () => {
    expect(score({ lessonMode: "online" })).toBeNull();
  });

  it("rejects an in-person tutor who covers other areas", () => {
    expect(score({ stations: ["Central"] })).toBeNull();
  });

  it("lets a tutor with no stored area through, since only known data excludes", () => {
    expect(score({ stations: [] })).not.toBeNull();
  });

  it("rejects a gender mismatch when the parent set a preference", () => {
    expect(score({ gender: "male" }, { preferredGender: "female" })).toBeNull();
  });

  it("rejects a tutor whose target levels exclude the case's stage", () => {
    expect(score({ targetStudents: ["Kindergarten"] }, { academicTier: "university" })).toBeNull();
  });

  it.each([
    ["muted alerts", { matchAlertsMuted: true }],
    ["not accepting", { isAccepting: false }],
    ["no account", { userId: null }],
    ["suspended account", { accountStatus: "suspended" }],
    ["shadowbanned", { shadowbanned: true }],
    ["the case's own parent", { userId: "parent-1" }],
  ])("skips a tutor with %s", (_label, over) => {
    expect(score(over as Partial<MatchTutor>)).toBeNull();
  });
});

describe("scoreTutorForCase soft signals (#657)", () => {
  it("scores subject, mode and area, recent activity", () => {
    expect(score({})).toBe(60);
  });

  it("boosts matching gender, stage and background but never exceeds 100", () => {
    const full = score(
      { targetStudents: ["HKDSE"], gender: "female", tutorStatus: "examiner", profileTags: ["x"] },
      { preferredGender: "female", tutorBackground: "official_examiner", tags: ["x"] },
    );
    expect(full).toBe(95);
  });

  it("takes 10 off an incomplete profile", () => {
    expect(score({ hasPhoto: false })).toBe(50);
  });
});

describe("rankTutorsForCase (#657)", () => {
  it("drops hard fails and sorts by score then tutor code", () => {
    const ranked = rankTutorsForCase(
      baseCase,
      [
        tutor({ id: "b", tutorCode: "MM-T002" }),
        tutor({ id: "a", tutorCode: "MM-T001" }),
        tutor({ id: "top", tutorCode: "MM-T009", targetStudents: ["HKDSE"] }),
        tutor({ id: "no", tutorCode: "MM-T003", subjects: ["Art"] }),
      ],
      NOW,
    );
    expect(ranked.map((r) => r.tutorId)).toEqual(["top", "a", "b"]);
  });
});

describe("waveWindowEndsAt (#657, 4 desk hours in HKT)", () => {
  it("ends 4 hours later inside desk hours", () => {
    expect(waveWindowEndsAt(NOW).toISOString()).toBe("2026-11-07T08:00:00.000Z"); // 16:00 HKT
  });

  it("pauses overnight and resumes at 08:00", () => {
    const at2000Hkt = new Date("2026-11-07T12:00:00Z");
    expect(waveWindowEndsAt(at2000Hkt).toISOString()).toBe("2026-11-08T03:00:00.000Z"); // 11:00
  });

  it("starts the clock at 08:00 when sent overnight", () => {
    const at0300Hkt = new Date("2026-11-06T19:00:00Z");
    expect(waveWindowEndsAt(at0300Hkt).toISOString()).toBe("2026-11-07T04:00:00.000Z"); // 12:00
  });
});

describe("decideWaveStep (#657)", () => {
  const due = {
    currentWave: 1,
    nextWaveAt: "2026-11-07T03:00:00Z",
    responses: 0,
    remaining: 6,
    now: NOW,
  };

  it("waits until the window ends", () => {
    expect(decideWaveStep({ ...due, nextWaveAt: "2026-11-07T05:00:00Z" })).toBe("wait");
  });

  it("sends the next wave after a window with no responses", () => {
    expect(decideWaveStep(due)).toBe("send_next");
  });

  it("does not send another wave when a tutor responded", () => {
    expect(decideWaveStep({ ...due, responses: 1 })).toBe("responded");
  });

  it("alerts the desk when the queue runs out or the wave cap is hit", () => {
    expect(decideWaveStep({ ...due, remaining: 0 })).toBe("exhausted");
    expect(decideWaveStep({ ...due, currentWave: MAX_WAVES })).toBe("exhausted");
  });
});

describe("caseMatchFingerprint (#657)", () => {
  it("ignores order but changes when a match key changes", () => {
    const a = caseMatchFingerprint({ ...baseCase, subjects: ["A", "B"] });
    expect(caseMatchFingerprint({ ...baseCase, subjects: ["B", "A"] })).toBe(a);
    expect(
      caseMatchFingerprint({ ...baseCase, subjects: ["A", "B"], district: "Tai Po" }),
    ).not.toBe(a);
  });
});
