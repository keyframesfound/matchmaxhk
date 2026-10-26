/**
 * Issue #441 — manual risk flags (V1: visibility + audit only).
 *
 * CS marks suspicious cases/tutors before heads-ups or phone unlock. CEO
 * locks this module encodes:
 *   * Detection is MANUAL ONLY — nothing here reads WABA/display-name
 *     metadata or sets a flag by itself; flags never auto-delete or
 *     auto-archive anything (badges + notes, full stop).
 *   * A BLOCKED tutor/case stays listed (stop-marker badge) — no purge from
 *     Top 8 or any queue; blocking never auto-blocks matching or phone
 *     unlock (the paid gate stays fee_marked_paid).
 *   * Authority: any CS sets REVIEW; BLOCKED (set or clear) is an Operator
 *     action. The server fn maps that onto the repo's real roles (#308
 *     precedent): staff/admin/super_admin may REVIEW, only admin/
 *     super_admin may move a flag into or out of BLOCKED — canSetRiskFlag
 *     receives that role result as `operatorAuthority` and is unit-tested
 *     for every transition.
 *
 * Pure vocabulary + rules shared by the case desk (/admin/cases), the tutor
 * admin (/admin/tutors + TutorEditor) and the vitest suite. The strings are
 * i18n KEYS (risk.flag_*); English fallbacks live in RISK_FLAG_LABELS so the
 * UI renders sanely before the integrator lands the locale entries.
 */

export const RISK_FLAGS = ["NONE", "REVIEW", "BLOCKED"] as const;

export type RiskFlag = (typeof RISK_FLAGS)[number];

/** The stored default: new rows (and junk/absent values) mean "no flag". */
export const RISK_FLAG_NONE: RiskFlag = "NONE";

/** Longest risk_note the UI accepts; the DB column is unconstrained text. */
export const RISK_FLAG_NOTE_MAX = 280;

export function isRiskFlag(value: unknown): value is RiskFlag {
  return typeof value === "string" && (RISK_FLAGS as readonly string[]).includes(value);
}

/**
 * Coerce a raw DB value to the flag vocabulary. Pre-migration rows and any
 * junk surface as NONE — the badge disappears instead of crashing a list.
 */
export function normalizeRiskFlag(value: unknown): RiskFlag {
  return isRiskFlag(value) ? value : RISK_FLAG_NONE;
}

/** i18n keys for each flag (both locale files carry risk.flag_*). */
export const RISK_FLAG_LABEL_KEYS: Record<RiskFlag, string> = {
  NONE: "risk.flag_none",
  REVIEW: "risk.flag_review",
  BLOCKED: "risk.flag_blocked",
};

/** English fallbacks passed as t() defaultValue while locales catch up. */
export const RISK_FLAG_LABELS: Record<RiskFlag, string> = {
  NONE: "None",
  REVIEW: "Review",
  BLOCKED: "Blocked",
};

/**
 * Badge styling per flag (warning style for REVIEW, destructive for
 * BLOCKED). NONE is a no-badge state — callers render nothing for it.
 */
export const RISK_FLAG_BADGE_CLASS: Record<RiskFlag, string> = {
  NONE: "",
  REVIEW: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  BLOCKED: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export type RiskAuthorityInput = {
  current: RiskFlag;
  next: RiskFlag;
  /**
   * Does the actor hold Operator authority? TRUE for every /admin user
   * today (Operator-only SOP fallback — see the header note); flip to a
   * real role check when a CS/Operator split ships.
   */
  operatorAuthority: boolean;
};

export type RiskAuthorityResult = { ok: true } | { ok: false; reason: "operator_required" };

/**
 * The authority rule: REVIEW is CS-settable; moving INTO or OUT of BLOCKED
 * needs an Operator (set, confirm, or un-block). Saving the same flag is a
 * no-op and always allowed.
 */
export function canSetRiskFlag(input: RiskAuthorityInput): RiskAuthorityResult {
  if (input.current === input.next) return { ok: true };
  if (input.current === "BLOCKED" || input.next === "BLOCKED") {
    if (!input.operatorAuthority) return { ok: false, reason: "operator_required" };
  }
  return { ok: true };
}

export type RiskPatchInput = {
  next: unknown;
  note?: string | null;
  actorId: string | null;
  /** Injectable for deterministic tests; defaults to now. */
  now?: Date;
};

export type RiskPatch = {
  risk_flag: RiskFlag;
  risk_note: string | null;
  risk_flagged_at: string | null;
  risk_flagged_by: string | null;
};

/**
 * Shape the DB patch for a flag change. A NONE flag clears the note and the
 * audit stamp (the note describes the flag, not the row); setting REVIEW or
 * BLOCKED stamps who/when. Junk `next` normalizes to NONE so a broken
 * client cannot write an out-of-vocabulary value.
 */
export function buildRiskPatch(input: RiskPatchInput): RiskPatch {
  const next = normalizeRiskFlag(input.next);
  if (next === RISK_FLAG_NONE) {
    return { risk_flag: "NONE", risk_note: null, risk_flagged_at: null, risk_flagged_by: null };
  }
  const note = input.note?.trim() ? input.note.trim().slice(0, RISK_FLAG_NOTE_MAX) : null;
  return {
    risk_flag: next,
    risk_note: note,
    risk_flagged_at: (input.now ?? new Date()).toISOString(),
    risk_flagged_by: input.actorId,
  };
}
