import { contactFilterError } from "@/lib/contact-filter";

/**
 * Issue #309, approved-grade verification.
 *
 * One badge, derived from staff-approved rows in `tutor_grades`. The public
 * card shows APPROVED grade labels only (never the slip file, never a URL);
 * pending/rejected/none rows stay inside the tutor's profile editor and the
 * staff queue. All status transitions live in this module so the server fns
 * and the UI share one state machine (tested in tests/tutors/grades.test.ts).
 */

export type TutorGradeStatus = "none" | "pending" | "approved" | "rejected";

export const TUTOR_GRADE_STATUSES: readonly TutorGradeStatus[] = [
  "none",
  "pending",
  "approved",
  "rejected",
];

export function isTutorGradeStatus(value: unknown): value is TutorGradeStatus {
  return typeof value === "string" && (TUTOR_GRADE_STATUSES as readonly string[]).includes(value);
}

/** Grade slips: PDF or image, max 10 MB (per-grade upload control). */
export const MAX_GRADE_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_GRADE_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const GRADE_SLIP_ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,.webp";

export function isAcceptedGradeFileType(contentType: string): boolean {
  return (ACCEPTED_GRADE_FILE_TYPES as readonly string[]).includes(contentType);
}

/**
 * Client-side pre-check mirroring the upload server fn. Returns the problem
 * code ("hkid" | "type" | "size") or null when the file is acceptable. Takes a
 * structural File subset so tests can build plain objects.
 */
export function gradeFileProblem(file: {
  name: string;
  type: string;
  size: number;
}): "hkid" | "type" | "size" | null {
  if (looksLikeHkid(file.name)) return "hkid";
  if (!isAcceptedGradeFileType(file.type)) return "type";
  if (file.size > MAX_GRADE_FILE_BYTES) return "size";
  return null;
}

/** Staff rejection reasons (fixed list + optional free-text note). */
export const GRADE_REJECTION_REASONS = [
  "name_does_not_match",
  "unreadable",
  "not_a_result_slip",
  "looks_altered",
  "wrong_document",
] as const;
export type GradeRejectionReason = (typeof GRADE_REJECTION_REASONS)[number];

export function isGradeRejectionReason(value: unknown): value is GradeRejectionReason {
  return (
    typeof value === "string" && (GRADE_REJECTION_REASONS as readonly string[]).includes(value)
  );
}

export const GRADE_LABEL_MAX = 120;

/** Public grade labels never carry contact details (same rule as the bio). */
export function gradeLabelError(label: string): string | null {
  return contactFilterError(label);
}

export function normalizeGradeLabel(raw: string): string {
  return raw.trim().slice(0, GRADE_LABEL_MAX);
}

/** Badge derivation: exactly "≥1 approved grade". */
export function countApprovedGrades(grades: readonly { status: TutorGradeStatus }[]): number {
  return grades.filter((grade) => grade.status === "approved").length;
}

export function hasVerifiedBadge(grades: readonly { status: TutorGradeStatus }[]): boolean {
  return countApprovedGrades(grades) >= 1;
}

/**
 * HKID detector, identity cards must never be uploaded as grade slips
 * (client-side message AND server-side rejection in the upload fn). Matches
 * the HKID shape: 1-2 letters + 6 digits + a check digit in parentheses or
 * not, tolerant of spaces. Runs on the file name and any text we control.
 */
const HKID_RE = /(?:^|[^A-Z0-9])[A-Z]{1,2}[\s_-]?\d{6}[\s_-]?[0-9A](?:$|[^A-Z0-9])/i;

export function looksLikeHkid(text: string): boolean {
  // Drop check-digit parentheses so "AB 123456 (7)" matches; the pattern then
  // tolerates single separators inside the number.
  const normalized = text.replace(/[()]/g, "");
  return HKID_RE.test(normalized);
}

/**
 * Edit-after-approval state machine (server-enforced in updateTutorGradeLabel):
 * changing the TEXT of an approved grade sends it back to pending so the badge
 * drops until staff re-approve. Every other status keeps its value, in
 * particular editing a rejected label does not fake a re-review without a new
 * upload.
 */
export function nextStatusAfterLabelEdit(
  current: TutorGradeStatus,
  labelChanged: boolean,
): TutorGradeStatus {
  if (current === "approved" && labelChanged) return "pending";
  return current;
}

/**
 * Upload state machine (server-enforced in uploadTutorGradeSlip): a new slip
 * always (re)enters the staff queue. Uploading onto a pending row keeps it
 * pending; approved rows go back to pending because fresh evidence must be
 * re-checked; none/rejected rows become pending.
 */
export function nextStatusAfterUpload(_current: TutorGradeStatus): TutorGradeStatus {
  return "pending";
}

/**
 * Deleting a grade only changes the badge when the deleted row was approved —
 * the trigger-maintained tutors.approved_grade_labels array recomputes either
 * way; this helper is the UI/test mirror of that rule.
 */
export function badgeSurvivesDelete(
  grades: readonly { id: string; status: TutorGradeStatus }[],
  deletedId: string,
): boolean {
  return hasVerifiedBadge(grades.filter((grade) => grade.id !== deletedId));
}

/** Rejecting one grade never touches other approved rows (helper mirror). */
export function approvedLabelsAfterReview(
  grades: readonly { id: string; label: string; status: TutorGradeStatus }[],
  reviewedId: string,
  nextStatus: Exclude<TutorGradeStatus, "none" | "pending">,
): string[] {
  return grades
    .map((grade) =>
      grade.id === reviewedId ? { ...grade, status: nextStatus as TutorGradeStatus } : grade,
    )
    .filter((grade) => grade.status === "approved")
    .map((grade) => grade.label);
}
