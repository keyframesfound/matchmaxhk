/**
 * Issue #81, case applications: pure helpers + types.
 *
 * The 1-click Apply-to-staff record lives in the `case_applications` table
 * (RLS-deny, service-role server fns only, see applications.functions.ts).
 * This module holds the SHARED eligibility + note-validation logic so the
 * tutor board UI and the server fns can never drift, and so the vitest suite
 * can exercise the rules without a database:
 *   - canApplyToCase: the single gate both surfaces call.
 *   - caseGenderMismatch: the exact rule the WhatsApp Apply button has dimmed
 *     on since #423, factored out of the detail page so in-app Apply blocks
 *     with the same reason.
 * No supabase imports here (contact-filter is pure).
 */

import { contactFilterError, hasContactDetails } from "@/lib/contact-filter";

/** The staff triage states stored on case_applications.status. */
export const APPLICATION_STATUS_TUPLE = ["new", "reviewed", "shortlisted", "rejected"] as const;

export type CaseApplicationStatus = (typeof APPLICATION_STATUS_TUPLE)[number];

export const APPLICATION_STATUSES: CaseApplicationStatus[] = [...APPLICATION_STATUS_TUPLE];

export function isApplicationStatus(value: unknown): value is CaseApplicationStatus {
  return typeof value === "string" && APPLICATION_STATUSES.includes(value as CaseApplicationStatus);
}

/** case_applications row (local type, the table is not in the generated DB types). */
export type CaseApplicationRow = {
  id: string;
  case_id: string;
  tutor_id: string;
  account_id: string | null;
  note: string | null;
  status: CaseApplicationStatus;
  created_at: string;
  updated_at: string;
};

/** Admin listing row: the application joined with the applying tutor's card. */
export type CaseApplicationAdminRow = CaseApplicationRow & {
  tutors: {
    tutor_code: string | null;
    display_name: string | null;
    subjects: string[] | null;
    verification_tier: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Eligibility (#81): the ONE Apply gate
// ---------------------------------------------------------------------------

/** Stable reason tokens, the UI maps them to i18n copy, server re-checks them. */
export type ApplicationBlockReason =
  | "CASE_NOT_ON_BOARD"
  | "CASE_CLOSED"
  | "NO_TUTOR_PROFILE"
  | "GENDER_MISMATCH"
  | "SCREENING_CONFIRM_REQUIRED";

/** Case fields the eligibility check needs (works for board items and DB rows). */
export type ApplyEligibilityCase = {
  boardPublishedAt: string | null;
  status: string;
  preferredGender: "any" | "male" | "female";
  /** Centre cases require the confirm/clarify radio before Apply (#412 E). */
  centre?: boolean;
  /** Whether the tutor confirmed the centre screening (omit elsewhere). */
  screeningConfirmed?: boolean;
};

/** The applying tutor's card, narrowed to what eligibility reads. */
export type ApplyTutorProfile = {
  gender: string | null;
} | null;

/**
 * The #423 WhatsApp-button dim rule, factored out (#81): a HARD preferred
 * gender contradicted by the tutor's own profile gender. Guests and tutors
 * without a recorded gender never mismatch.
 */
export function caseGenderMismatch(
  preferredGender: "any" | "male" | "female",
  tutorGender: string | null | undefined,
): boolean {
  const gender = (tutorGender ?? "").trim().toLowerCase();
  if (preferredGender === "any" || !gender) return false;
  return (
    (preferredGender === "female" && gender === "male") ||
    (preferredGender === "male" && gender === "female")
  );
}

/** Board statuses that take a case off the apply-able set. */
const CASE_CLOSED_STATUSES = new Set([
  "matched",
  "closed",
  "rejected",
  "compliance_hold",
  // #449: the failed match enters the desk-driven rematch pivot; the
  // rematch itself is a NEW case.
  "failed_trial_pivot",
]);

/**
 * The single Apply gate, evaluated in the order the issue lists: on-board →
 * open status → tutor card → gender → centre screening. `duplicate` is
 * deliberately absent, UNIQUE (case_id, tutor_id) in the DB plus the
 * `alreadyApplied` flag on the board cover it.
 */
export function canApplyToCase(
  caseRow: ApplyEligibilityCase,
  tutorProfile: ApplyTutorProfile,
): { ok: true } | { ok: false; reason: ApplicationBlockReason } {
  if (!caseRow.boardPublishedAt) return { ok: false, reason: "CASE_NOT_ON_BOARD" };
  if (CASE_CLOSED_STATUSES.has(caseRow.status)) return { ok: false, reason: "CASE_CLOSED" };
  if (!tutorProfile) return { ok: false, reason: "NO_TUTOR_PROFILE" };
  if (caseGenderMismatch(caseRow.preferredGender, tutorProfile.gender)) {
    return { ok: false, reason: "GENDER_MISMATCH" };
  }
  if (caseRow.centre === true && caseRow.screeningConfirmed !== true) {
    return { ok: false, reason: "SCREENING_CONFIRM_REQUIRED" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Optional note validation (#81)
// ---------------------------------------------------------------------------

export const APPLICATION_NOTE_MAX = 500;

export type NoteValidation = { ok: true; note: string | null } | { ok: false; error: string };

/**
 * Trim + validate the optional application pitch: ≤500 chars, and the shared
 * contact filter REJECTS (never strips, the tutor can rephrase, #215).
 * Empty/whitespace notes normalise to null.
 */
export function validateApplicationNote(note: string | null | undefined): NoteValidation {
  const trimmed = (note ?? "").trim();
  if (trimmed.length === 0) return { ok: true, note: null };
  if (trimmed.length > APPLICATION_NOTE_MAX) {
    return {
      ok: false,
      error: `Note must be ${APPLICATION_NOTE_MAX} characters or fewer.`,
    };
  }
  if (hasContactDetails(trimmed)) {
    const error = contactFilterError(trimmed);
    return { ok: false, error: error ?? "Note contains contact details." };
  }
  return { ok: true, note: trimmed };
}
