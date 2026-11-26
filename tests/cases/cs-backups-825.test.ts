import { describe, expect, it } from "vitest";

import type { MatchCase } from "../../src/features/cases/case-match-waves";
import {
  ghostingTutors,
  isManualOnlyCase,
  pendingPingTutors,
  pickCsBackups,
  queueRoom,
  type BackupRequest,
  type BackupTutor,
  type PingEvent,
} from "../../src/features/cases/cs-backups";

const now = new Date("2026-11-26T04:00:00Z");

const matchCase: MatchCase = {
  subjects: ["Chemistry"],
  studentLevel: null,
  academicTier: null,
  examSystem: "IBDP",
  district: "Sha Tin",
  mode: "in_person",
  preferredGender: "any",
  tutorBackground: null,
  tags: [],
  parentId: "parent-1",
};

let n = 0;
const tutor = (over: Partial<BackupTutor> = {}): BackupTutor => {
  n += 1;
  return {
    id: `t${n}`,
    tutorCode: `MM-T${String(n).padStart(3, "0")}`,
    userId: `u${n}`,
    subjects: ["Chemistry"],
    stations: ["Sha Tin"],
    district: null,
    lessonMode: "either",
    gender: "female",
    tutorStatus: null,
    targetStudents: ["IBDP"],
    profileTags: [],
    isAccepting: true,
    accountStatus: "active",
    hasPhoto: true,
    hasHeadline: true,
    updatedAt: now.toISOString(),
    matchAlertsMuted: false,
    shadowbanned: false,
    rateHkd: 400,
    fastResponder: false,
    hasApprovedGrades: false,
    ...over,
  };
};

const req = (over: Partial<BackupRequest> = {}): BackupRequest => ({
  matchCase,
  budgetMaxHkd: 450,
  seed: null,
  seedTutorId: null,
  rematchReason: null,
  relaxRatePct: 0,
  includeOnline: false,
  excluded: new Set(),
  ...over,
});

describe("#825 pickCsBackups", () => {
  it("AC-CS-1: max 3, subject hard, excludes seed / prior / shadowbanned / suspended", () => {
    const seed = tutor({ id: "seed" });
    const prior = tutor({ id: "prior" });
    const pool = [
      seed,
      prior,
      tutor({ shadowbanned: true }),
      tutor({ accountStatus: "suspended" }),
      tutor({ subjects: ["Physics"] }),
      tutor(),
      tutor(),
      tutor(),
      tutor(),
    ];
    const picks = pickCsBackups(
      req({ seedTutorId: "seed", excluded: new Set(["prior"]) }),
      pool,
      now,
    );
    expect(picks).toHaveLength(3);
    const ids = picks.map((p) => p.tutorId);
    expect(ids).not.toContain("seed");
    expect(ids).not.toContain("prior");
    expect(picks.every((p) => p.reasons[0] === "Same subject")).toBe(true);
    expect(JSON.stringify(picks)).not.toMatch(/Verified/);
  });

  it("AC-CS-4: budget cap, then Relax +15% and Include online widen the pool", () => {
    const pricey = tutor({ rateHkd: 500 }); // 450 * 1.15 = 517.5
    const onlineFar = tutor({ stations: ["Central"], lessonMode: "online" });
    const strict = pickCsBackups(req(), [pricey, onlineFar], now);
    expect(strict).toHaveLength(0);
    const relaxed = pickCsBackups(
      req({ relaxRatePct: 0.15, includeOnline: true }),
      [pricey, onlineFar],
      now,
    );
    expect(relaxed.map((p) => p.tutorId).sort()).toEqual([pricey.id, onlineFar.id].sort());
    expect(relaxed.find((p) => p.tutorId === onlineFar.id)?.reasons).toContain("Online");
  });

  it("AC-CS-5: RATE_TOO_HIGH keeps candidates strictly below the outgoing rate, even when relaxed", () => {
    const seedRate = {
      rateHkd: 400,
      targetStudents: ["IBDP"],
      stations: [],
      district: null,
      lessonMode: "either",
    };
    const same = tutor({ rateHkd: 400 });
    const cheaper = tutor({ rateHkd: 380 });
    const picks = pickCsBackups(
      req({
        seed: seedRate,
        seedTutorId: "seed",
        rematchReason: "RATE_TOO_HIGH",
        relaxRatePct: 0.15,
      }),
      [same, cheaper],
      now,
    );
    expect(picks.map((p) => p.tutorId)).toEqual([cheaper.id]);
  });

  it("AC-CS-6: no seed still ranks against the case and explains why", () => {
    const fast = tutor({ fastResponder: true });
    const picks = pickCsBackups(req(), [tutor(), fast], now);
    expect(picks[0].tutorId).toBe(fast.id);
    expect(picks[0].reasons).toEqual(["Same subject", "Same curriculum", "Rate fit", "Fast reply"]);
  });
});

describe("#825 ledger reads", () => {
  const ev = (
    tutorId: string,
    caseId: string,
    type: PingEvent["type"],
    daysAgo: number,
  ): PingEvent => ({
    tutorId,
    caseId,
    type,
    at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
  });

  it("AC-CS-3: 3 unanswered pings in a row within 30 days is a ghost", () => {
    const events = [
      ev("g", "c1", "tutor_pinged", 20),
      ev("g", "c2", "tutor_pinged", 10),
      ev("g", "c3", "tutor_pinged", 2),
      ev("ok", "c1", "tutor_pinged", 20),
      ev("ok", "c2", "tutor_pinged", 10),
      ev("ok", "c2", "tutor_replied_no", 9),
      ev("ok", "c3", "tutor_pinged", 2),
      ev("old", "c1", "tutor_pinged", 40),
      ev("old", "c2", "tutor_pinged", 35),
      ev("old", "c3", "tutor_pinged", 2),
    ];
    expect([...ghostingTutors(events, now)]).toEqual(["g"]);
  });

  it("AC-CS-2: pending pings cap the queue at 3 concurrent", () => {
    const events = [
      ev("a", "c1", "tutor_pinged", 1),
      ev("b", "c1", "tutor_pinged", 1),
      ev("b", "c1", "tutor_replied_no", 0.5),
      ev("x", "c2", "tutor_pinged", 1),
    ];
    const pending = pendingPingTutors("c1", events, new Set());
    expect([...pending]).toEqual(["a"]);
    expect(queueRoom(pending.size)).toBe(2);
    expect(queueRoom(3)).toBe(0);
    expect(pendingPingTutors("c1", events, new Set(["a"])).size).toBe(0);
  });

  it("AC-CS-7: Centre / B2B cases are manual only", () => {
    expect(isManualOnlyCase({ organisation_id: "org", case_type: "centre" })).toBe(true);
    expect(isManualOnlyCase({ organisation_id: null, case_type: "private" })).toBe(false);
  });
});
