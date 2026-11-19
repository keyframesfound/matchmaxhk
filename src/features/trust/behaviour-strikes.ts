/**
 * Issue #782 §2.5 (was #703) — pure helpers for the private pre-lesson
 * behaviour report and concierge strikes ledger.
 *
 * AC-703-3 [UNVERIFIED]: NO automatic consequences live here. Filing a
 * report or a strike only RECORDS it — no auto-quarantine, no auto-block of
 * rematches or shortlists. Where a strike could affect rematch / shortlist
 * eligibility, the #772 one-active-trial signal is the surface, but the
 * rebuilt #703 thresholds and their reconciliation with #772 / #760 / the
 * #755 quarantine lock await Ryan; flag contradictions rather than guessing.
 * Everything here is counting and labelling only.
 */

export const BEHAVIOUR_SEVERITIES = ["low", "medium", "high"] as const;
export type BehaviourSeverity = (typeof BEHAVIOUR_SEVERITIES)[number];

export const BEHAVIOUR_SUBJECT_PARTIES = ["parent", "tutor"] as const;
export type BehaviourSubjectParty = (typeof BEHAVIOUR_SUBJECT_PARTIES)[number];

export const BEHAVIOUR_CONCERN_MAX = 2000;

export function isBehaviourSeverity(value: unknown): value is BehaviourSeverity {
  return typeof value === "string" && (BEHAVIOUR_SEVERITIES as readonly string[]).includes(value);
}

export function isBehaviourSubjectParty(value: unknown): value is BehaviourSubjectParty {
  return (
    typeof value === "string" && (BEHAVIOUR_SUBJECT_PARTIES as readonly string[]).includes(value)
  );
}

/**
 * A ledger row (or the report it came from) reduced to its subject key:
 * "parent:<uuid>" or "tutor:<uuid>". Rows with no subject captured are
 * keyed as their party with a null id and count separately.
 */
export type StrikeLedgerRow = {
  subject_parent_id: string | null;
  subject_tutor_id: string | null;
};

export function strikeSubjectKey(row: StrikeLedgerRow): string {
  if (row.subject_tutor_id) return `tutor:${row.subject_tutor_id}`;
  if (row.subject_parent_id) return `parent:${row.subject_parent_id}`;
  return "parent:none";
}

/**
 * Strike counts per subject key. Pure counting over the concierge_strikes
 * ledger — ops display only; nothing here gates rematches or shortlists.
 */
export function countStrikesBySubject(rows: readonly StrikeLedgerRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = strikeSubjectKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Strikes recorded against one subject (parent id or tutor id). */
export function strikeCountFor(
  rows: readonly StrikeLedgerRow[],
  subject: { party: BehaviourSubjectParty; id: string | null },
): number {
  const key = subject.id ? `${subject.party}:${subject.id}` : `${subject.party}:none`;
  return countStrikesBySubject(rows)[key] ?? 0;
}
