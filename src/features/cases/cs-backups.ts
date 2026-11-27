/**
 * #825 §2.1 — CS backup lookalikes, pure half.
 *
 * Staff-only. When a pinged tutor says NO, goes quiet, or a case enters a
 * rematch, the desk asks for up to 3 backups. Eligibility and the base score
 * reuse the shipped #657 wave scorer (scoreTutorForCase), so the desk and the
 * match alerts agree on who fits; the seed-similarity terms reuse the #563
 * get_similar_tutors weights. Nothing here sends anything: the desk queues a
 * wave into the funnel ledger and a human sends the WhatsApp.
 */

import {
  scoreTutorForCase,
  type MatchCase,
  type MatchTutor,
} from "@/features/cases/case-match-waves";

export const CS_BACKUP_LIMIT = 3;
/** AC-CS-2: at most 3 pings may be pending on a case at once. */
export const MAX_PENDING_PINGS = 3;
export const RELAX_RATE_PCT = 0.15;
/** AC-CS-3: 3 unanswered pings in a row inside 30 days = ghosting. */
export const GHOST_STREAK = 3;
export const GHOST_WINDOW_DAYS = 30;
const FAST_REPLY_BOOST = 5;

export type BackupTutor = MatchTutor & {
  rateHkd: number | null;
  fastResponder: boolean;
  hasApprovedGrades: boolean;
};

export type BackupSeed = {
  rateHkd: number | null;
  targetStudents: string[];
  stations: string[];
  district: string | null;
  lessonMode: string | null;
};

export type BackupRequest = {
  matchCase: MatchCase;
  budgetMaxHkd: number | null;
  seed: BackupSeed | null;
  seedTutorId: string | null;
  rematchReason: string | null;
  relaxRatePct: number;
  includeOnline: boolean;
  /** Seed, prior wave / pinged tutors, decliners, ghosts. */
  excluded: ReadonlySet<string>;
  limit?: number;
};

export type BackupPick = {
  tutorId: string;
  tutorCode: string;
  score: number;
  reasons: string[];
};

const CURRICULA = new Set(["A-Level", "AP", "GCSE", "HKDSE", "IBDP", "IGCSE", "MYP"]);

const offersOnline = (t: MatchTutor) => (t.lessonMode ?? "either") !== "in_person";

/** Rate ceiling for a candidate, or null for no cap. RATE_TOO_HIGH wins over relax. */
export function rateCeiling(
  r: Pick<BackupRequest, "budgetMaxHkd" | "relaxRatePct" | "rematchReason" | "seed">,
): {
  max: number | null;
  strictlyBelow: number | null;
} {
  const strictlyBelow =
    r.rematchReason === "RATE_TOO_HIGH" && r.seed?.rateHkd ? r.seed.rateHkd : null;
  const max =
    r.budgetMaxHkd && r.budgetMaxHkd > 0
      ? r.budgetMaxHkd * (1 + Math.max(0, r.relaxRatePct))
      : null;
  return { max, strictlyBelow };
}

function seedSimilarity(seed: BackupSeed, t: BackupTutor): { points: number; reasons: string[] } {
  const reasons: string[] = [];
  let points = 0;
  const seedCurricula = seed.targetStudents.filter((s) => CURRICULA.has(s));
  if (seedCurricula.length > 0 && t.targetStudents.some((s) => seedCurricula.includes(s))) {
    points += 30;
    reasons.push("Same curriculum");
  }
  if (seed.rateHkd && t.rateHkd) {
    const gap = Math.abs(t.rateHkd - seed.rateHkd);
    if (gap <= seed.rateHkd * 0.15) points += 20;
    else if (gap <= seed.rateHkd * 0.3) points += 10;
  }
  const seedMode = seed.lessonMode ?? "either";
  const mode = t.lessonMode ?? "either";
  if (seedMode === "either" || mode === "either" || seedMode === mode) points += 10;
  const seedAreas = new Set([...seed.stations, ...(seed.district ? [seed.district] : [])]);
  if ([...t.stations, ...(t.district ? [t.district] : [])].some((a) => seedAreas.has(a))) {
    points += 10;
    reasons.push("Same area");
  }
  if (t.hasApprovedGrades) points += 15;
  return { points, reasons };
}

/**
 * AC-CS-1/4/5/6: up to `limit` backups. Subject is never relaxed; Include
 * online lifts the in-person district lock only for online-capable tutors.
 */
export function pickCsBackups(
  req: BackupRequest,
  tutors: readonly BackupTutor[],
  now: Date,
): BackupPick[] {
  const limit = Math.min(req.limit ?? CS_BACKUP_LIMIT, CS_BACKUP_LIMIT);
  const { max, strictlyBelow } = rateCeiling(req);
  const onlineCase: MatchCase = { ...req.matchCase, mode: "online", district: null };
  const picks: BackupPick[] = [];
  for (const t of tutors) {
    if (t.id === req.seedTutorId || req.excluded.has(t.id)) continue;
    let base = scoreTutorForCase(req.matchCase, t, now);
    let viaOnline = false;
    if (base === null && req.includeOnline && offersOnline(t)) {
      base = scoreTutorForCase(onlineCase, t, now);
      viaOnline = base !== null;
    }
    if (base === null) continue;
    if (max !== null && (t.rateHkd === null || t.rateHkd > max)) continue;
    if (strictlyBelow !== null && (t.rateHkd === null || t.rateHkd >= strictlyBelow)) continue;

    const reasons = ["Same subject"];
    let score = base;
    if (req.seed) {
      const sim = seedSimilarity(req.seed, t);
      score += sim.points;
      reasons.push(...sim.reasons);
    } else if (req.matchCase.examSystem && t.targetStudents.includes(req.matchCase.examSystem)) {
      reasons.push("Same curriculum");
    }
    if (max !== null || strictlyBelow !== null) reasons.push("Rate fit");
    if (viaOnline) reasons.push("Online");
    if (t.fastResponder) {
      score += FAST_REPLY_BOOST;
      reasons.push("Fast reply");
    }
    picks.push({ tutorId: t.id, tutorCode: t.tutorCode, score, reasons });
  }
  return picks
    .sort((a, b) => b.score - a.score || a.tutorCode.localeCompare(b.tutorCode))
    .slice(0, limit);
}

export type PingEvent = {
  caseId: string;
  tutorId: string;
  type: "tutor_pinged" | "tutor_replied_yes" | "tutor_replied_no";
  at: string;
};

/** Pings on this case still waiting for a yes / no (declines also close a ping). */
export function pendingPingTutors(
  caseId: string,
  events: readonly PingEvent[],
  declined: ReadonlySet<string>,
): Set<string> {
  const pending = new Set<string>();
  const sorted = [...events]
    .filter((e) => e.caseId === caseId)
    .sort((a, b) => a.at.localeCompare(b.at));
  for (const e of sorted) {
    if (e.type === "tutor_pinged") pending.add(e.tutorId);
    else pending.delete(e.tutorId);
  }
  for (const id of declined) pending.delete(id);
  return pending;
}

/**
 * AC-CS-3: tutors whose last GHOST_STREAK pings (within the window) all went
 * unanswered on their case. Reads recorded ping / reply events only.
 */
export function ghostingTutors(events: readonly PingEvent[], now: Date): Set<string> {
  const since = now.getTime() - GHOST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = events.filter((e) => Date.parse(e.at) >= since);
  const replied = new Set(
    recent.filter((e) => e.type !== "tutor_pinged").map((e) => `${e.tutorId}:${e.caseId}`),
  );
  const pingsByTutor = new Map<string, PingEvent[]>();
  for (const e of recent) {
    if (e.type !== "tutor_pinged") continue;
    pingsByTutor.set(e.tutorId, [...(pingsByTutor.get(e.tutorId) ?? []), e]);
  }
  const ghosts = new Set<string>();
  for (const [tutorId, pings] of pingsByTutor) {
    const last = pings.sort((a, b) => b.at.localeCompare(a.at)).slice(0, GHOST_STREAK);
    if (last.length === GHOST_STREAK && last.every((p) => !replied.has(`${tutorId}:${p.caseId}`))) {
      ghosts.add(tutorId);
    }
  }
  return ghosts;
}

/** AC-CS-2: how many more pings staff may queue right now. */
export function queueRoom(pendingCount: number): number {
  return Math.max(0, MAX_PENDING_PINGS - pendingCount);
}

export type BackupQueuePick = { tutorId: string; score: number };
export type BackupQueueRow = BackupQueuePick & { rank: number };

/**
 * AC-CS-2: plan the `case_match_queue` rows for the staff's picks. Rank
 * continues after the case's current queue max so the desk reads one ordered
 * ledger; a tutor picked twice is queued once, in first-pick order.
 */
export function nextBackupQueueRows(
  existingMaxRank: number,
  picks: readonly BackupQueuePick[],
): BackupQueueRow[] {
  const seen = new Set<string>();
  const rows: BackupQueueRow[] = [];
  for (const pick of picks) {
    if (seen.has(pick.tutorId)) continue;
    seen.add(pick.tutorId);
    rows.push({
      tutorId: pick.tutorId,
      score: pick.score,
      rank: existingMaxRank + rows.length + 1,
    });
  }
  return rows;
}

/** AC-CS-7: Centre / B2B cases stay manual until #815 is stable. */
export function isManualOnlyCase(c: {
  organisation_id: string | null;
  case_type: string | null;
}): boolean {
  return Boolean(c.organisation_id) || c.case_type === "centre";
}
