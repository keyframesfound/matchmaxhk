/**
 * #783 §2.3 / #717: "3 tutors with open slots" suggestion email, pure half.
 *
 * Deterministic: live open capacity + the shipped #657 eligibility score, no
 * AI re-rank (#22 / #627 stay parked). Never a partial email: fewer than 3
 * qualifying tutors means no send. The 7-day automated cap, the opt-in and the
 * same-subject suppression are enforced again at the send path
 * (sendTemplateEmail / email-policy.ts).
 */

import {
  scoreTutorForCase,
  type MatchCase,
  type MatchTutor,
} from "@/features/cases/case-match-waves";
import { matchesSubjectQuery } from "@/features/tutors/subjects";

export const SUGGESTION_COUNT = 3;
/** #717 §3: at most one suggestion email per parent every 14 days. */
export const SUGGESTION_COOLDOWN_DAYS = 14;
/** #717 §5: a tutor is not suggested to the same parent twice in 30 days. */
export const SUGGESTION_DEDUPE_DAYS = 30;
/** Interests count when saved / updated inside this window. */
export const INTEREST_WINDOW_DAYS = 30;
/** #717 §3: Tuesday and Thursday, 11:00 HKT. */
const SEND_WEEKDAYS = new Set([2, 4]);
const SEND_HOUR_HKT = 11;
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SuggestionInterest = { subject: string; curriculum: string | null };

export type SuggestionTutor = MatchTutor & {
  remainingSlots: number | null;
  rateHkd: number | null;
  displayName: string;
  verified: boolean;
  credential: string | null;
};

export type SuggestionPick = {
  tutorId: string;
  tutorCode: string;
  displayName: string;
  verified: boolean;
  credential: string | null;
  subjects: string[];
  area: string;
  remainingSlots: number;
  rateHkd: number | null;
  reason: string;
};

/** The hourly scheduler only acts in the Tue / Thu 11:00 HKT hour. */
export function isSuggestionSlot(now: Date): boolean {
  const hkt = new Date(now.getTime() + HKT_OFFSET_MS);
  return SEND_WEEKDAYS.has(hkt.getUTCDay()) && hkt.getUTCHours() === SEND_HOUR_HKT;
}

export function cooldownOpen(lastSentAt: string | null, now: Date): boolean {
  if (!lastSentAt) return true;
  const last = Date.parse(lastSentAt);
  return Number.isNaN(last) || now.getTime() - last >= SUGGESTION_COOLDOWN_DAYS * DAY_MS;
}

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Interests from recent tutor saved searches and child profiles, de-duplicated
 * by subject + curriculum, in that order (an explicit search beats a profile).
 */
export function suggestionInterests(input: {
  savedSearches: { scope: string; params: Record<string, unknown>; at: string }[];
  children: { subjects: string[] | null; curriculum: string | null; at: string }[];
  now: Date;
}): SuggestionInterest[] {
  const since = input.now.getTime() - INTEREST_WINDOW_DAYS * DAY_MS;
  const out: SuggestionInterest[] = [];
  const seen = new Set<string>();
  const add = (subject: string, curriculum: string | null) => {
    const key = `${subject.toLowerCase()}|${(curriculum ?? "").toLowerCase()}`;
    if (!subject || seen.has(key)) return;
    seen.add(key);
    out.push({ subject, curriculum: curriculum || null });
  };
  for (const s of input.savedSearches) {
    if (s.scope !== "tutors" || Date.parse(s.at) < since) continue;
    add(clean(s.params.subject), clean(s.params.category) || null);
  }
  for (const c of input.children) {
    if (Date.parse(c.at) < since) continue;
    for (const subject of c.subjects ?? []) add(clean(subject), clean(c.curriculum) || null);
  }
  return out;
}

/** #717 rule: never suggest for a subject the family already has a live match in. */
export function withoutActiveSubjects(
  interests: readonly SuggestionInterest[],
  activeSubjects: readonly string[],
): SuggestionInterest[] {
  return interests.filter(
    (i) =>
      !activeSubjects.some(
        (a) => matchesSubjectQuery(a, i.subject) || matchesSubjectQuery(i.subject, a),
      ),
  );
}

/**
 * Exactly 3 tutors for one interest, or [] (no partial email). Only tutors
 * that accept students with at least one open slot right now, teach the
 * subject, pass the #657 eligibility score, and were not suggested to this
 * parent in the last 30 days.
 */
export function pickSuggestionTutors(
  interest: SuggestionInterest,
  tutors: readonly SuggestionTutor[],
  recentlySent: ReadonlySet<string>,
  parentId: string,
  now: Date,
): SuggestionPick[] {
  const ranked: { pick: SuggestionPick; score: number }[] = [];
  for (const t of tutors) {
    if (recentlySent.has(t.id)) continue;
    if (!t.isAccepting || (t.remainingSlots ?? 0) < 1) continue;
    const taught = t.subjects.find((s) => matchesSubjectQuery(s, interest.subject));
    if (!taught) continue;
    const matchCase: MatchCase = {
      subjects: [taught],
      studentLevel: null,
      academicTier: null,
      examSystem: interest.curriculum,
      district: null,
      mode: null,
      preferredGender: null,
      tutorBackground: null,
      tags: [],
      parentId,
    };
    const score = scoreTutorForCase(matchCase, t, now);
    if (score === null) continue;
    if (interest.curriculum && !t.targetStudents.includes(interest.curriculum)) continue;
    const online = (t.lessonMode ?? "either") !== "in_person";
    ranked.push({
      score,
      pick: {
        tutorId: t.id,
        tutorCode: t.tutorCode,
        displayName: t.displayName || t.tutorCode,
        verified: t.verified,
        credential: t.credential,
        subjects: t.subjects.slice(0, 4),
        area: t.district || t.stations[0] || (online ? "Online" : "Hong Kong"),
        remainingSlots: t.remainingSlots ?? 1,
        rateHkd: t.rateHkd,
        reason: interest.curriculum
          ? `Tutors ${interest.curriculum} ${taught} with open slots`
          : `Tutors ${taught} with open slots`,
      },
    });
  }
  ranked.sort((a, b) => b.score - a.score || a.pick.tutorCode.localeCompare(b.pick.tutorCode));
  return ranked.length >= SUGGESTION_COUNT
    ? ranked.slice(0, SUGGESTION_COUNT).map((r) => r.pick)
    : [];
}

/** Tutor ids suggested to this parent inside the 30-day window. */
export function recentlySuggested(
  log: readonly { tutor_ids: string[]; sent_at: string }[],
  now: Date,
): Set<string> {
  const since = now.getTime() - SUGGESTION_DEDUPE_DAYS * DAY_MS;
  return new Set(
    log.filter((row) => Date.parse(row.sent_at) >= since).flatMap((row) => row.tutor_ids),
  );
}
