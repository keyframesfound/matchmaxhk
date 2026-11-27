import { describe, expect, it } from "vitest";

import {
  decideWaveStep,
  isAutoSendable,
  legacyQueueRows,
  type QueueSource,
} from "../../src/features/cases/case-match-waves";
import { nextBackupQueueRows, queueRoom } from "../../src/features/cases/cs-backups";

const pick = (tutorId: string, score: number) => ({ tutorId, score });

describe("#825 AC-CS-2 backup wave queue rows", () => {
  it("continues rank after the case's existing queue max", () => {
    expect(nextBackupQueueRows(4, [pick("t1", 82), pick("t2", 71)])).toEqual([
      { tutorId: "t1", score: 82, rank: 5 },
      { tutorId: "t2", score: 71, rank: 6 },
    ]);
  });

  it("starts at rank 1 when the case has no queue rows yet", () => {
    expect(nextBackupQueueRows(0, [pick("t1", 82)])).toEqual([
      { tutorId: "t1", score: 82, rank: 1 },
    ]);
  });

  it("keeps the order staff picked, not score order", () => {
    const rows = nextBackupQueueRows(0, [pick("low", 40), pick("high", 90)]);
    expect(rows.map((row) => row.tutorId)).toEqual(["low", "high"]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
  });

  it("collapses a tutor picked twice, keeping the first score", () => {
    const rows = nextBackupQueueRows(2, [pick("t1", 88), pick("t2", 70), pick("t1", 99)]);
    expect(rows).toEqual([
      { tutorId: "t1", score: 88, rank: 3 },
      { tutorId: "t2", score: 70, rank: 4 },
    ]);
  });

  it("carries a zero score through unchanged", () => {
    expect(nextBackupQueueRows(0, [pick("t1", 0)])).toEqual([{ tutorId: "t1", score: 0, rank: 1 }]);
  });

  it("plans nothing when the desk picked nobody", () => {
    expect(nextBackupQueueRows(9, [])).toEqual([]);
  });

  it("plans at most the three picks the desk can select", () => {
    const rows = nextBackupQueueRows(0, [pick("t1", 9), pick("t2", 8), pick("t3", 7)]);
    expect(rows).toHaveLength(3);
    expect(queueRoom(0)).toBe(3);
  });
});

describe("#825 AC-CS-2 wave drain predicate", () => {
  const row = (waveNo: number | null, source: QueueSource) => ({ waveNo, source });

  it("lets an un-notified engine row into the next wave", () => {
    expect(isAutoSendable(row(null, "engine"))).toBe(true);
  });

  it("never auto-notifies a desk-queued backup", () => {
    expect(isAutoSendable(row(null, "cs_backup"))).toBe(false);
  });

  it("leaves already-notified rows out whatever their source", () => {
    expect(isAutoSendable(row(2, "engine"))).toBe(false);
    expect(isAutoSendable(row(2, "cs_backup"))).toBe(false);
  });
});

describe("#825 AC-CS-2 run exhaustion", () => {
  const now = new Date("2026-11-27T04:00:00Z");
  const remainingOf = (rows: { waveNo: number | null; source: QueueSource }[]) =>
    rows.filter((row) => isAutoSendable(row)).length;

  it("reaches exhausted when only desk-queued backups are left", () => {
    const remaining = remainingOf([
      { waveNo: null, source: "cs_backup" },
      { waveNo: null, source: "cs_backup" },
    ]);
    expect(remaining).toBe(0);
    expect(decideWaveStep({ currentWave: 1, nextWaveAt: null, responses: 0, remaining, now })).toBe(
      "exhausted",
    );
  });

  it("still sends the next wave while an engine row is pending", () => {
    const remaining = remainingOf([
      { waveNo: null, source: "cs_backup" },
      { waveNo: null, source: "engine" },
    ]);
    expect(remaining).toBe(1);
    expect(decideWaveStep({ currentWave: 0, nextWaveAt: null, responses: 0, remaining, now })).toBe(
      "send_next",
    );
  });
});

describe("#825 AC-CS-2 pre-migration queue reads", () => {
  it("maps every legacy row to engine", () => {
    const rows = [
      { id: "q1", tutor_id: "t1", rank: 1, wave_no: null },
      { id: "q2", tutor_id: "t2", rank: 2, wave_no: 3 },
    ];
    const mapped = legacyQueueRows(rows);
    expect(mapped).toEqual([
      { id: "q1", tutor_id: "t1", rank: 1, wave_no: null, source: "engine" },
      { id: "q2", tutor_id: "t2", rank: 2, wave_no: 3, source: "engine" },
    ]);
    expect(mapped.every((row) => row.source === "engine")).toBe(true);
  });
});
