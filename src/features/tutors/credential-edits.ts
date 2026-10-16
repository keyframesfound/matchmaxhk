/**
 * Issue #284 (P4) — Verified edits need evidence. Pure state machine + input
 * validation for pending credential changes from verified tutors.
 *
 * DB contract (migration 20261016151000): `tutor_credential_edits` rows carry
 * old_value/new_value as jsonb snapshots; one open edit per (tutor, field);
 * owner has SELECT-only RLS — submit/approve/reject run in service-role
 * server fns, which call these helpers before touching the database.
 *
 * Grade changes are NOT here: tutor_grades (#309) already has its own
 * evidence flow and staff review. This covers the remaining credential
 * columns the owner-verified guard locks.
 */

export const CREDENTIAL_EDIT_FIELDS = [
  "secondary_school",
  "highschool",
  "undergrad_university",
  "undergrad_degree",
  "undergrad_graduation_year",
  "has_postgrad",
  "postgrad_university",
  "postgrad_degree",
  "qualifications_summary",
  "exam_results",
  "achievements",
] as const;

export type CredentialEditField = (typeof CREDENTIAL_EDIT_FIELDS)[number];

/** Columns whose value is a jsonb payload rather than a plain string. */
const JSONB_FIELDS: ReadonlySet<string> = new Set(["exam_results", "achievements"]);

export function isCredentialEditField(value: unknown): value is CredentialEditField {
  return (
    typeof value === "string" &&
    (CREDENTIAL_EDIT_FIELDS as readonly string[]).includes(value)
  );
}

export function isJsonbCredentialField(field: CredentialEditField): boolean {
  return JSONB_FIELDS.has(field);
}

export type CredentialEditStatus = "pending" | "approved" | "rejected";

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024; // 10 MB, per issue #284

const EVIDENCE_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type EvidenceFileMeta = {
  name: string;
  size: number;
  type: string;
};

export type CredentialEditInput = {
  field: CredentialEditField;
  newValue: unknown;
  evidence: EvidenceFileMeta | null;
};

export type CredentialEditRejection =
  | { code: "unknown_field"; field: string }
  | { code: "empty_value"; field: CredentialEditField }
  | { code: "evidence_required"; field: CredentialEditField }
  | { code: "evidence_too_large"; field: CredentialEditField; size: number }
  | { code: "evidence_bad_type"; field: CredentialEditField; type: string };

export type ValidatedCredentialEdit = {
  field: CredentialEditField;
  /** jsonb snapshot for new_value (strings boxed as {text: string}). */
  newValueJson: unknown;
};

/**
 * Validate a credential-edit submission. Returns every rejection found (the
 * UI can show them all); an empty array means the server fn may proceed.
 * Evidence is mandatory for every field — that is the point of the issue.
 */
export function validateCredentialEditInput(
  input: CredentialEditInput,
): CredentialEditRejection[] {
  const rejections: CredentialEditRejection[] = [];

  if (!isCredentialEditField(input.field)) {
    return [{ code: "unknown_field", field: String(input.field) }];
  }

  if (isEmptyValue(input.newValue)) {
    rejections.push({ code: "empty_value", field: input.field });
  }

  if (!input.evidence) {
    rejections.push({ code: "evidence_required", field: input.field });
  } else {
    if (input.evidence.size > MAX_EVIDENCE_BYTES) {
      rejections.push({
        code: "evidence_too_large",
        field: input.field,
        size: input.evidence.size,
      });
    }
    if (!EVIDENCE_MIME_TYPES.has(input.evidence.type)) {
      rejections.push({
        code: "evidence_bad_type",
        field: input.field,
        type: input.evidence.type,
      });
    }
  }

  return rejections;
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/** Box a field's new value into its jsonb snapshot shape. */
export function toValueSnapshot(field: CredentialEditField, value: unknown): unknown {
  if (isJsonbCredentialField(field)) return value ?? null;
  return { text: value == null ? "" : String(value) };
}

/** Read a jsonb snapshot back into the display string for staff/UI. */
export function valueSnapshotToText(snapshot: unknown): string {
  if (snapshot == null) return "";
  if (typeof snapshot === "string") return snapshot;
  if (typeof snapshot === "object" && "text" in (snapshot as Record<string, unknown>)) {
    return String((snapshot as Record<string, unknown>).text ?? "");
  }
  return JSON.stringify(snapshot);
}

export type CredentialEditDecision = "approve" | "reject";

export type CredentialDecisionResult =
  | { ok: true; status: "approved" | "rejected"; reviewedAt: string }
  | { ok: false; reason: "not_pending" | "reject_needs_reason" };

/**
 * Transition a pending edit to its staff decision. Approve swaps the value in
 * (the server fn writes tutors.<field> = new_value); reject keeps the old
 * value and MUST carry a staff reason. Non-pending rows are terminal.
 */
export function applyCredentialDecision(
  edit: { status: string },
  decision: CredentialEditDecision,
  staffReason: string | null,
  now: () => Date = () => new Date(),
): CredentialDecisionResult {
  if (edit.status !== "pending") return { ok: false, reason: "not_pending" };
  if (decision === "reject" && !(staffReason && staffReason.trim())) {
    return { ok: false, reason: "reject_needs_reason" };
  }
  return {
    ok: true,
    status: decision === "approve" ? "approved" : "rejected",
    reviewedAt: now().toISOString(),
  };
}

/**
 * Map a tutors row to the old_value snapshot for `field` at submit time, so
 * staff see exactly what the public card shows today. Unknown fields throw —
 * call only after isCredentialEditField.
 */
export function credentialFieldValue(tutor: Record<string, unknown>, field: CredentialEditField): unknown {
  return tutor[field] ?? null;
}
