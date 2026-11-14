import { matchesSubjectQuery } from "../tutors/subjects";

/**
 * #731: may a Marketplace note show "Request this tutor for 1-on-1"?
 * Pure so vitest and the note page share one rule.
 *
 * - Community sellers / own listings / tutors not taking students: hidden.
 * - The viewer already has an active trial or case in this subject with
 *   ANOTHER tutor: hidden (never encourage mid-case tutor shopping).
 * - The active case is with THIS tutor: a "Your Active Tutor" badge.
 */

export type UpsellCase = {
  subject: string | null;
  tutorCode: string | null;
  sorStatus: string | null;
};

export type UpsellDecision = "show" | "current_tutor" | "hidden";

/** Trial being arranged through an active case; draft and ended states excluded. */
const ACTIVE_STATUSES = new Set([
  "introduced",
  "lesson_1_scheduled",
  "lesson_1_done",
  "lesson_2_scheduled",
  "lesson_2_done",
  "fee_invoiced",
  "fee_paid",
  "active",
]);

function sameSubject(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  return matchesSubjectQuery(x, y) || matchesSubjectQuery(y, x);
}

export function decideNoteUpsell(input: {
  isOwner: boolean;
  isCommunitySeller: boolean;
  tutorCode: string | null;
  /** From the tutor's inquiry action: false when full / inactive / paused. */
  tutorTakingStudents: boolean;
  noteSubject: string | null;
  viewerCases: readonly UpsellCase[];
}): UpsellDecision {
  if (input.isOwner || input.isCommunitySeller || !input.tutorCode) return "hidden";
  const code = input.tutorCode.toUpperCase();
  const subject = input.noteSubject ?? "";
  const sameSubjectActive = subject
    ? input.viewerCases.filter(
        (c) =>
          ACTIVE_STATUSES.has(c.sorStatus ?? "") && c.subject && sameSubject(c.subject, subject),
      )
    : [];
  if (sameSubjectActive.some((c) => (c.tutorCode ?? "").toUpperCase() === code)) {
    return "current_tutor";
  }
  if (sameSubjectActive.length > 0) return "hidden";
  return input.tutorTakingStudents ? "show" : "hidden";
}
