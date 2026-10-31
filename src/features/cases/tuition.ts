/**
 * Issue #461 Phase A 3b — pure rules for tutor tuition tracking and staff
 * soft-void. Tuition is owed by the family to the tutor (never to MatchMax);
 * only the tutor who taught the lesson marks it paid or unpaid.
 */

export const TUITION_STATUSES = ["unpaid", "paid"] as const;
export type TuitionStatus = (typeof TUITION_STATUSES)[number];

export const TUITION_SOURCES = ["lesson", "session_log"] as const;
export type TuitionSource = (typeof TUITION_SOURCES)[number];

export const VOID_REASON_MIN = 3;
export const VOID_REASON_MAX = 500;

const TAUGHT_STATUSES: Record<TuitionSource, ReadonlySet<string>> = {
  lesson: new Set(["done"]),
  session_log: new Set(["pending", "verified"]),
};

export type TuitionEditError = "NOT_YOUR_LESSON" | "LESSON_NOT_TAUGHT";

export function tuitionEditError(input: {
  source: TuitionSource;
  status: string;
  isMine: boolean;
}): TuitionEditError | null {
  if (!input.isMine) return "NOT_YOUR_LESSON";
  if (!TAUGHT_STATUSES[input.source].has(input.status)) return "LESSON_NOT_TAUGHT";
  return null;
}

export type VoidLessonError = "VOID_REASON_REQUIRED" | "ALREADY_VOIDED" | "MANAGED_LEDGER_LESSON";

/**
 * Staff soft-void: the row is kept for audit and leaves fees, hours and
 * earnings. Managed (#533) lessons carry a credit HOLD, so they are settled
 * through attendance / cancel instead, never voided out from under the ledger.
 */
export function voidLessonError(input: {
  status: string;
  hasManagedHold: boolean;
  reason: string;
}): VoidLessonError | null {
  const reason = input.reason.trim();
  if (reason.length < VOID_REASON_MIN || reason.length > VOID_REASON_MAX) {
    return "VOID_REASON_REQUIRED";
  }
  if (input.status === "voided") return "ALREADY_VOIDED";
  if (input.hasManagedHold) return "MANAGED_LEDGER_LESSON";
  return null;
}
