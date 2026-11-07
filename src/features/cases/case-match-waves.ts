// Issue #657: ranked waves of 3 for case match alerts. Pure so the bus tick,
// the desk panel and vitest share one definition of who matches and when the
// next wave is due. Hard keys only exclude when both sides hold data.

import { normalizeProfileTag } from "@/features/tutors/profile-tags";
import { caseAcademicTier, tutorTierMembership } from "@/features/tutors/verticals";

export const WAVE_SIZE = 3;
export const MAX_WAVES = 5;
const WAVE_WINDOW_MS = 4 * 60 * 60 * 1000;
const DESK_OPEN_HOUR = 8;
const DESK_CLOSE_HOUR = 21;
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RECENT_ACTIVITY_MS = 30 * DAY_MS;

export type MatchCase = {
  subjects: string[];
  studentLevel: string | null;
  academicTier: string | null;
  examSystem: string | null;
  district: string | null;
  mode: string | null;
  preferredGender: string | null;
  tutorBackground: string | null;
  tags: string[];
  parentId: string | null;
};

export type MatchTutor = {
  id: string;
  tutorCode: string;
  userId: string | null;
  subjects: string[];
  stations: string[];
  district: string | null;
  lessonMode: string | null;
  gender: string | null;
  tutorStatus: string | null;
  targetStudents: string[];
  profileTags: string[];
  isAccepting: boolean;
  accountStatus: string | null;
  hasPhoto: boolean;
  hasHeadline: boolean;
  updatedAt: string | null;
  matchAlertsMuted: boolean;
  shadowbanned: boolean;
};

export type RankedTutor = { tutorId: string; tutorCode: string; score: number };

const lower = (value: string) => value.trim().toLowerCase();

function isReachable(c: MatchCase, t: MatchTutor): boolean {
  return (
    Boolean(t.userId) &&
    t.userId !== c.parentId &&
    t.isAccepting &&
    !t.matchAlertsMuted &&
    !t.shadowbanned &&
    (t.accountStatus === null || t.accountStatus === "active")
  );
}

function teachesSubject(c: MatchCase, t: MatchTutor): boolean {
  const taught = new Set(t.subjects.map(lower));
  return c.subjects.some((subject) => taught.has(lower(subject)));
}

function stageFits(c: MatchCase, t: MatchTutor): boolean {
  const tier = caseAcademicTier(c.academicTier, c.studentLevel);
  return !tier || tutorTierMembership(t.targetStudents).has(tier);
}

function stageBonus(c: MatchCase, t: MatchTutor): number {
  const exam = lower(c.examSystem ?? "");
  return exam && t.targetStudents.some((target) => lower(target) === exam) ? 20 : 0;
}

/** Null when the mode or area rules the tutor out, else the mode+area points. */
function modeAreaScore(c: MatchCase, t: MatchTutor): number | null {
  const offers = t.lessonMode ?? "either";
  if (c.mode === "online") return offers === "in_person" ? null : 15;
  if (c.mode !== "in_person") return 15;
  if (offers === "online") return null;
  if (!c.district) return 15;
  const areas = [...t.stations, ...(t.district ? [t.district] : [])];
  if (areas.length === 0) return 0;
  return areas.includes(c.district) ? 15 : null;
}

function genderScore(c: MatchCase, t: MatchTutor): number | null {
  const wanted = lower(c.preferredGender ?? "any");
  if (wanted === "any" || wanted === "" || !t.gender) return 0;
  return lower(t.gender) === wanted ? 10 : null;
}

function softBonus(c: MatchCase, t: MatchTutor): number {
  const owned = new Set(t.profileTags.map(normalizeProfileTag));
  const sharesTag = c.tags.some((tag) => owned.has(normalizeProfileTag(tag)));
  const fitsBackground =
    (c.tutorBackground === "official_examiner" && t.tutorStatus === "examiner") ||
    (c.tutorBackground === "uni_student" &&
      (t.tutorStatus === "uni_student" || t.tutorStatus === "uni_undergrad"));
  return sharesTag || fitsBackground ? 5 : 0;
}

/** Score 0 to 100, or null when a hard key or eligibility rule excludes the tutor. */
export function scoreTutorForCase(c: MatchCase, t: MatchTutor, now: Date): number | null {
  if (!isReachable(c, t) || !teachesSubject(c, t) || !stageFits(c, t)) return null;
  const modeArea = modeAreaScore(c, t);
  const gender = genderScore(c, t);
  if (modeArea === null || gender === null) return null;
  const recent =
    t.updatedAt && now.getTime() - Date.parse(t.updatedAt) <= RECENT_ACTIVITY_MS ? 5 : 0;
  const incomplete = t.hasPhoto && t.hasHeadline ? 0 : 10;
  const total = 40 + stageBonus(c, t) + modeArea + gender + softBonus(c, t) + recent - incomplete;
  return Math.max(0, Math.min(100, total));
}

export function rankTutorsForCase(c: MatchCase, tutors: MatchTutor[], now: Date): RankedTutor[] {
  return tutors
    .flatMap((t) => {
      const score = scoreTutorForCase(c, t, now);
      return score === null ? [] : [{ tutorId: t.id, tutorCode: t.tutorCode, score }];
    })
    .sort((a, b) => b.score - a.score || a.tutorCode.localeCompare(b.tutorCode));
}

/** When a wave sent at `from` times out: 4 desk hours, paused overnight in HKT. */
export function waveWindowEndsAt(from: Date): Date {
  let cursor = from.getTime() + HKT_OFFSET_MS;
  let remaining = WAVE_WINDOW_MS;
  while (remaining > 0) {
    const dayStart = Math.floor(cursor / DAY_MS) * DAY_MS;
    const open = dayStart + DESK_OPEN_HOUR * HOUR_MS;
    const close = dayStart + DESK_CLOSE_HOUR * HOUR_MS;
    if (cursor >= close) {
      cursor = dayStart + DAY_MS + DESK_OPEN_HOUR * HOUR_MS;
      continue;
    }
    cursor = Math.max(cursor, open);
    const step = Math.min(remaining, close - cursor);
    cursor += step;
    remaining -= step;
  }
  return new Date(cursor - HKT_OFFSET_MS);
}

export type WaveStep = "wait" | "send_next" | "responded" | "exhausted";

/** What an active run does on this tick. A response is an open or an Apply. */
export function decideWaveStep(input: {
  currentWave: number;
  nextWaveAt: string | null;
  responses: number;
  remaining: number;
  now: Date;
}): WaveStep {
  const { currentWave, nextWaveAt, responses, remaining, now } = input;
  if (nextWaveAt && Date.parse(nextWaveAt) > now.getTime()) return "wait";
  if (currentWave > 0 && responses > 0) return "responded";
  if (currentWave >= MAX_WAVES || remaining === 0) return "exhausted";
  return "send_next";
}

/** Changes only when a key that decides who matches changes. */
export function caseMatchFingerprint(c: MatchCase): string {
  return JSON.stringify([
    [...c.subjects].map(lower).sort(),
    c.studentLevel,
    c.academicTier,
    c.examSystem,
    c.district,
    c.mode,
    c.preferredGender,
  ]);
}
