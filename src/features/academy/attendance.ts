/**
 * #533 (#530 Phase 1): attendance on the existing case_lessons calendar.
 *
 * Pure rules shared by the tutor hub, the admin desk and tests. The ledger
 * side effects live in the DB trigger case_lessons_managed_ledger
 * (20261031090000); settlementFor mirrors it for previews only.
 *
 * Hybrid lock (#530 §0): attendance works on every lesson. The note gate,
 * credits and the parent WhatsApp summary apply to MANAGED cases only.
 */

export const ATTENDANCE_STATUSES = [
  "present",
  "late",
  "left_early",
  "absent_excused",
  "absent_billable",
] as const;
export type Attendance = (typeof ATTENDANCE_STATUSES)[number];

export type LessonStatus = "done" | "no_show" | "cancelled";
export type Settlement = "CONSUME" | "RELEASE";

/** case_lessons.status an attendance mark moves the lesson to. */
export function lessonStatusFor(attendance: Attendance): LessonStatus {
  switch (attendance) {
    case "absent_billable":
      return "no_show";
    case "absent_excused":
      return "cancelled";
    default:
      return "done";
  }
}

/** Mirror of the trigger: what the held credit becomes. */
export function settlementFor(attendance: Attendance): Settlement {
  return attendance === "absent_excused" ? "RELEASE" : "CONSUME";
}

export const NOTE_MIN_SENTENCES = 2;

/** Sentences ended by . ! ? or their CJK forms; a trailing fragment counts. */
export function countSentences(text: string): number {
  return text
    .split(/[.!?。！？]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3).length;
}

export type NoteGateError = "NOTE_REQUIRED" | "NOTE_SKIP_USED";

/**
 * Soft note gate (#533): managed lessons need a 2-sentence note. A tutor may
 * skip it once per case; an admin can always override. Pure-matching lessons
 * are never gated.
 */
export function noteGateError(input: {
  managed: boolean;
  note: string;
  skipNote: boolean;
  skipAlreadyUsed: boolean;
  adminOverride: boolean;
}): NoteGateError | null {
  if (!input.managed || input.adminOverride) return null;
  if (countSentences(input.note) >= NOTE_MIN_SENTENCES) return null;
  if (!input.skipNote) return "NOTE_REQUIRED";
  return input.skipAlreadyUsed ? "NOTE_SKIP_USED" : null;
}

const ATTENDANCE_PHRASE: Record<Attendance, string> = {
  present: "attended today's lesson",
  late: "attended today's lesson (arrived late)",
  left_early: "attended today's lesson (left early)",
  absent_excused: "was excused from today's lesson",
  absent_billable: "missed today's lesson",
};

/**
 * Parent WhatsApp summary for a managed lesson. Copy-ready for the desk until
 * the #511 WA template hook sends it. Independent Tutor wording only.
 */
export function parentSummaryMessage(input: {
  studentName: string;
  tutorName: string;
  attendance: Attendance;
  note: string;
  creditsLeft: number | null;
}): string {
  const lines = [
    `${input.studentName} ${ATTENDANCE_PHRASE[input.attendance]} with ${input.tutorName}.`,
  ];
  const note = input.note.trim();
  if (note) lines.push(`Tutor's note: ${note}`);
  if (input.creditsLeft !== null) {
    lines.push(
      input.attendance === "absent_excused"
        ? `No credit used. Lessons left: ${input.creditsLeft}.`
        : `Lessons left: ${input.creditsLeft}.`,
    );
  }
  return lines.join("\n");
}

/** Booked share of available minutes, whole %; 0 when nothing is open. */
export function occupancyPct(availableMinutes: number, bookedMinutes: number): number {
  if (availableMinutes <= 0) return 0;
  return Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100));
}

export type BurnEntry = { entry_type: string; held_delta: number | string; created_at: string };

/** Credits consumed in the last `days` days (CONSUME rows; held_delta is negative). */
export function creditBurn(entries: BurnEntry[], now: Date, days = 30): number {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const total = entries
    .filter((e) => e.entry_type === "CONSUME" && new Date(e.created_at).getTime() >= since)
    .reduce((sum, e) => sum - Number(e.held_delta), 0);
  return Math.round(total * 100) / 100;
}
