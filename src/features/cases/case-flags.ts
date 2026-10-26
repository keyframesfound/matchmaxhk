/**
 * Issue #254 (F3), staff case flags.
 *
 * A flag is a staff observation on a case: the introduction may have been
 * used without the fee, the fee is unpaid, the parties continued past the
 * managed window, the payer asked to move off-site, or a tutor sent contact
 * details through a profile, note, or post. A flag never auto-charges and
 * never reads private messages, invoice / waive / ban stay manual staff
 * actions (fee desk #259, org policy #376).
 *
 * Pure vocabulary shared by the desk server fns (admin-desk.functions.ts)
 * and the desk UI. The reason strings are the DB CHECK vocabulary; labels
 * live in the locale files under sor.flag_reason_* (the desk is i18n'd).
 */

export const CASE_FLAG_REASONS = [
  "intro_used",
  "fee_unpaid",
  "parties_continued",
  "off_site_request",
  "tutor_shared_contact",
] as const;

export type CaseFlagReason = (typeof CASE_FLAG_REASONS)[number];

export function isCaseFlagReason(value: unknown): value is CaseFlagReason {
  return typeof value === "string" && (CASE_FLAG_REASONS as readonly string[]).includes(value);
}

export const CASE_FLAG_NOTE_MAX = 500;

export type CaseFlagInput = {
  caseId: string;
  actorId: string;
  actorName: string | null;
  reason: unknown;
  note?: string | null;
};

export type CaseFlagRow = {
  case_id: string;
  actor_id: string | null;
  actor_name: string | null;
  reason: CaseFlagReason;
  note: string | null;
};

/**
 * Validate + shape a flag for insert. Throws on a bad reason or an
 * over-long note so a desk bug cannot write junk rows; the case id and
 * actor are required (a flag without a who/where is not evidence).
 */
export function buildCaseFlagRow(input: CaseFlagInput): CaseFlagRow {
  if (!input.caseId) throw new Error("a flag requires a case");
  if (!input.actorId) throw new Error("a flag requires a staff actor");
  if (!isCaseFlagReason(input.reason)) {
    throw new Error(`unknown flag reason: ${String(input.reason)}`);
  }
  const note = input.note?.trim() ? input.note.trim() : null;
  if (note && note.length > CASE_FLAG_NOTE_MAX) {
    throw new Error(`flag note must be at most ${CASE_FLAG_NOTE_MAX} characters`);
  }
  return {
    case_id: input.caseId,
    actor_id: input.actorId,
    actor_name: input.actorName?.trim() || null,
    reason: input.reason,
    note,
  };
}
