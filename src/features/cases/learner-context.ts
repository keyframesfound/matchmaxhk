/**
 * Issue #459 §E: who the tutor is talking to on a case. Reuses the existing
 * cases.who_for column (#437) as the learner_type signal instead of adding a
 * second column: my_child = parent-managed, myself = independent student.
 */

export type WhoFor = "my_child" | "myself" | "someone_else";

export type CaseLearnerContext = "parent" | "independent" | "generic";

const WHO_FOR_VALUES: readonly WhoFor[] = ["my_child", "myself", "someone_else"];

/** Tolerant read: legacy rows predate #437 and carry null. */
export function parseWhoFor(value: unknown): WhoFor | null {
  return WHO_FOR_VALUES.find((option) => option === value) ?? null;
}

export function caseLearnerContext(whoFor: WhoFor | null): CaseLearnerContext {
  if (whoFor === "my_child") return "parent";
  if (whoFor === "myself") return "independent";
  return "generic";
}
