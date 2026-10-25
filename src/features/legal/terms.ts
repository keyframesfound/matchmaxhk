/**
 * Issue #214, Terms of Service gates.
 *
 * Single source of truth for the terms version the gated surfaces
 * (signup, note upload, checkout, referral signup, case request, centre
 * partnership) must record. Bump TERMS_VERSION whenever the ToS changes
 * materially; the next acceptance on each surface then records the new
 * version, and stale rows keep their old version string as history.
 *
 * The acceptance ROW is always written server-side by the service-role server
 * fn that owns the gate (terms_acceptances has no client INSERT policy) —
 * these helpers are the shared vocabulary that fn and its UI agree on.
 */

export const TERMS_VERSION = "2026-10-25";

/**
 * Issue #253 (F2): the matching-fee agreement on the case-request form has
 * its own version string, independent of the general ToS. Bump it when the
 * fee rule changes; the checkbox label quotes it verbatim. v2 (issue #444):
 * the admin fee is owed by the self-employed tutor (B2C and B2B/centre) —
 * re-gates case requests recorded at the old fee-2026-10 version.
 */
export const FEE_TERMS_VERSION = "fee-2026-10-v2";

/**
 * Issue #412: the centre-partnership acceptance on the Partner Org join form
 * records version `centre-2026-10` (aligned with #257's partnership terms the
 * representative binds). Independent of the general ToS version.
 */
export const CENTRE_PARTNERSHIP_TERMS_VERSION = "centre-2026-10";

export const TERMS_SURFACES = [
  "signup",
  "note_upload",
  "checkout",
  "referral_signup",
  // Issue #253 (F2): the parent case-request form's matching-fee checkbox.
  "case_request",
  // Issue #412: Partner Org join, authority checkbox + partnership terms.
  "centre_partnership",
] as const;

export type TermsSurface = (typeof TERMS_SURFACES)[number];

export function isTermsSurface(value: unknown): value is TermsSurface {
  return typeof value === "string" && (TERMS_SURFACES as readonly string[]).includes(value);
}

export type TermsAcceptanceInput = {
  userId: string;
  surface: TermsSurface;
  termsVersion?: string;
  /** Optional context row: application id, note draft id, or order id. */
  subjectId?: string | null;
  /** #412 D: request IP at acceptance time (server-captured, best-effort). */
  ipAddress?: string | null;
  /** #412 D: centre-partnership rows, the legal entity the rep bound. */
  legalEntityName?: string | null;
  /** #412 D: exact checkbox label strings shown (audit trail outlives copy). */
  acceptanceDetails?: string[] | null;
};

export type TermsAcceptanceRow = {
  user_id: string;
  surface: TermsSurface;
  terms_version: string;
  subject_id: string | null;
  ip_address?: string | null;
  legal_entity_name?: string | null;
  acceptance_details?: string[] | null;
};

/**
 * Build the row the gate's server fn inserts after its checkbox validation
 * passes. Throws on a bad surface so a caller bug cannot write junk rows.
 */
export function buildTermsAcceptanceRow(input: TermsAcceptanceInput): TermsAcceptanceRow {
  if (!input.userId) throw new Error("terms acceptance requires a signed-in user");
  if (!isTermsSurface(input.surface)) {
    throw new Error(`unknown terms surface: ${String(input.surface)}`);
  }
  return {
    user_id: input.userId,
    surface: input.surface,
    terms_version: input.termsVersion ?? TERMS_VERSION,
    subject_id: input.subjectId ?? null,
    ip_address: input.ipAddress ?? null,
    legal_entity_name: input.legalEntityName ?? null,
    acceptance_details: input.acceptanceDetails ?? null,
  };
}

/**
 * True when `rows` contains an acceptance for `surface` at the CURRENT
 * version. Surfaces gate per action (per order, per draft), so callers that
 * need per-subject freshness pass `subjectId`.
 */
export function hasCurrentAcceptance(
  rows: Array<Pick<TermsAcceptanceRow, "surface" | "terms_version" | "subject_id">>,
  surface: TermsSurface,
  subjectId?: string | null,
): boolean {
  return rows.some(
    (row) =>
      row.surface === surface &&
      row.terms_version === TERMS_VERSION &&
      (subjectId == null || row.subject_id === subjectId),
  );
}
