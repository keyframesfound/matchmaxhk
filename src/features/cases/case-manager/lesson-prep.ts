/**
 * #785 AC-735-2a: the topic / prep note an upcoming lesson carries.
 *
 * Pure rules shared by the server fn and the Case Workspace banner: how the
 * text is normalised, who may write it, and when it is still editable.
 */

export const LESSON_TOPIC_MAX = 80;
export const LESSON_PREP_NOTE_MAX = 500;

export type LessonPrepValues = { topic: string | null; note: string | null };

export type LessonPrepInput = { topic?: string | null; note?: string | null };

/** Same roles the schedule surface already uses; "parent" covers the learner too. */
export type LessonPrepRole = "tutor" | "parent";

/** Trim, drop a leading markdown `#`, and collapse an empty value to null. */
export function normaliseLessonTopic(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const text = raw
    .trim()
    .replace(/^#+\s*/, "")
    .trim();
  if (text.length === 0) return null;
  if (text.length > LESSON_TOPIC_MAX) throw new Error("TOPIC_TOO_LONG");
  return text;
}

export function normalisePrepNote(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const text = raw.trim();
  if (text.length === 0) return null;
  if (text.length > LESSON_PREP_NOTE_MAX) throw new Error("NOTE_TOO_LONG");
  return text;
}

export function normaliseLessonPrep(input: LessonPrepInput): LessonPrepValues {
  return { topic: normaliseLessonTopic(input.topic), note: normalisePrepNote(input.note) };
}

/** The tutor writes it; Ops may too (same rule as the plan pills). */
export function canWriteLessonPrep(role: LessonPrepRole, isOps: boolean): boolean {
  return role === "tutor" || isOps;
}

/** A past lesson's prep note is a record, not a draft. */
export function lessonStillUpcoming(startsAt: string, now: Date): boolean {
  const at = Date.parse(startsAt);
  return Number.isFinite(at) && at > now.getTime();
}
