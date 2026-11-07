/**
 * Issue #673 — academic integrity & prep pre-check (pure).
 *
 * Broad subject tags let a parent request TOK / EE / IA / SBA coursework
 * (the "請槍" ghostwriting ambush) or a one-off session where the tutor is
 * expected to write assessments. When the request touches those terms, the
 * Case Request form requires the 1-click integrity pre-check so the
 * expectation is explicit before a tutor accepts.
 */

const COURSEWORK_TERMS =
  /\b(tok|ee|ia|sba)\b|theory\s+of\s+knowledge|extended\s+essay|internal\s+assessment|coursework|ghostwrit|代寫|代写|槍手|枪手/i;

const ONE_OFF_TERMS = /\bone[-\s]?off|single\s+session|一次性|單次|单次/i;

export type CourseworkPreCheck = {
  /** The request names coursework/assessment terms or a one-off session. */
  required: boolean;
  /** Which trigger fired (for the helper copy). */
  trigger: "coursework" | "one_off" | null;
};

export function courseworkPreCheck(input: {
  subjects: readonly string[];
  specificComponent?: string | null;
  notes?: string | null;
}): CourseworkPreCheck {
  const haystack = [...input.subjects, input.specificComponent ?? "", input.notes ?? ""]
    .filter(Boolean)
    .join(" \n ");
  if (COURSEWORK_TERMS.test(haystack)) return { required: true, trigger: "coursework" };
  if (ONE_OFF_TERMS.test(haystack)) return { required: true, trigger: "one_off" };
  return { required: false, trigger: null };
}
