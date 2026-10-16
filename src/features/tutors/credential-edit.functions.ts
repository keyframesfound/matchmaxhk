import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CREDENTIAL_EDIT_FIELDS,
  MAX_EVIDENCE_BYTES,
  applyCredentialDecision,
  booleanCredentialSnapshot,
  credentialFieldValue,
  isBooleanCredentialField,
  isCredentialEditField,
  isJsonbCredentialField,
  toValueSnapshot,
  validateCredentialEditInput,
  valueSnapshotToText,
  type CredentialEditField,
  type CredentialEditRejection,
} from "@/features/tutors/credential-edits";

/**
 * Issue #284 (P4) — evidence-gated credential changes for verified tutors.
 *
 * Owner path: a tier_2_verified tutor cannot write the locked credential
 * columns directly (tutors_owner_verified_guard raises), so this module gives
 * them a request flow instead — new value + a supporting document. The row
 * lands pending in tutor_credential_edits; the old value stays on the public
 * card until staff approve (service-role swap) or reject (reason stored).
 *
 * Staff path: same shape as the grade queue (admin/grade-review.functions.ts)
 * — assertAdmin from the session, service-role reads, short-lived signed URL
 * for the private credential-evidence bucket, in-app notice to the tutor.
 *
 * tutor_credential_edits is not in the generated Database types yet, so every
 * query uses the repo's untyped-table pattern (from("..." as never) + result
 * cast, as in materials.functions.ts).
 */

// ---------------------------------------------------------------------------
// Pure helpers (tested in tests/tutors/credential-edit-flow.test.ts)
// ---------------------------------------------------------------------------

/** Deterministic JSON so two snapshots with equal content compare equal. */
export function stableSnapshotJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableSnapshotJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableSnapshotJson(v)}`).join(",")}}`;
}

/**
 * Which credential fields did the tutor actually edit? Compare the form the
 * row loaded as (baseline) against the live draft, so server-side payload
 * normalization (trims, has_postgrad nulling postgrad_*) never counts as a
 * change. Both inputs are TutorFormData-like records; `highschool` is simply
 * absent from the form and therefore never reported.
 */
export function changedCredentialFields(
  baseline: Record<string, unknown>,
  next: Record<string, unknown>,
): CredentialEditField[] {
  return CREDENTIAL_EDIT_FIELDS.filter((field) => {
    const before = toValueSnapshot(field, baseline[field] ?? null);
    const after = toValueSnapshot(field, next[field] ?? null);
    return stableSnapshotJson(before) !== stableSnapshotJson(after);
  });
}

/**
 * Parse an approved snapshot back into the tutors column value.
 * `has_postgrad` returns boolean|null so the tutors update is a real boolean.
 */
export function valueSnapshotToColumn(field: CredentialEditField, snapshot: unknown): unknown {
  if (isBooleanCredentialField(field)) return booleanCredentialSnapshot(snapshot);
  if (isJsonbCredentialField(field)) return snapshot ?? null;
  const text = valueSnapshotToText(snapshot);
  return text.length > 0 ? text : null;
}

/** PostgREST unique-violation on tutor_credential_edits_one_open_per_field. */
export function isDuplicatePendingEditError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /tutor_credential_edits_one_open_per_field|duplicate key unique constraint/i.test(
    error.message ?? "",
  );
}

/** Human message for validateCredentialEditInput rejections (server throws). */
export function credentialEditRejectionsMessage(rejections: CredentialEditRejection[]): string {
  const parts = rejections.map((rejection) => {
    switch (rejection.code) {
      case "unknown_field":
        return "Unknown credential field.";
      case "empty_value":
        return "Enter the new value before submitting.";
      case "evidence_required":
        return "Attach a supporting document for this change.";
      case "evidence_too_large":
        return "Documents must be 10 MB or smaller.";
      case "evidence_bad_type":
        return "Upload a PDF or an image (JPG, PNG, WebP).";
    }
  });
  return parts.join(" ") || "This change could not be validated.";
}

/** Storage path in the private credential-evidence bucket (<tutorId>/<uuid>-<file>). */
export function credentialEvidencePath(tutorId: string, filename: string): string {
  const safeName =
    filename
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .replace(/\.{2,}/g, ".")
      .slice(-120) || "evidence";
  return `${tutorId}/${crypto.randomUUID()}-${safeName}`;
}

// ---------------------------------------------------------------------------
// Owner server fns
// ---------------------------------------------------------------------------

const evidenceFileSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(MAX_EVIDENCE_BYTES),
  content: z.string().min(1),
});

export type SubmitCredentialEditResult =
  | { ok: true; id: string; field: string; status: "pending" }
  | { ok: false; reason: "already_under_review"; field: string };

export const submitCredentialEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tutorId: z.string().uuid(),
        field: z.string(),
        newValue: z.unknown(),
        file: evidenceFileSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SubmitCredentialEditResult> => {
    const { field } = data;
    if (!isCredentialEditField(field)) {
      throw new Error(credentialEditRejectionsMessage([{ code: "unknown_field", field }]));
    }

    const rejections = validateCredentialEditInput({
      field,
      newValue: data.newValue,
      evidence: { name: data.file.filename, size: data.file.size, type: data.file.contentType },
    });
    if (rejections.length > 0) throw new Error(credentialEditRejectionsMessage(rejections));

    const bytes = Buffer.from(data.file.content, "base64");
    if (bytes.length === 0 || bytes.length !== data.file.size) {
      throw new Error("Invalid file data.");
    }
    if (bytes.length > MAX_EVIDENCE_BYTES) {
      throw new Error("Documents must be 10 MB or smaller.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tutorRow, error: tutorError } = (await supabaseAdmin
      .from("tutors")
      .select(`id, user_id, verification_tier, ${field}`)
      .eq("id", data.tutorId)
      .limit(1)
      .maybeSingle()) as unknown as {
      data: Record<string, unknown> | null;
      error: { message: string } | null;
    };
    if (tutorError) throw new Error(tutorError.message);
    const tutor = tutorRow;
    if (!tutor || tutor.user_id !== context.userId) throw new Error("Forbidden");
    if (tutor.verification_tier !== "tier_2_verified") {
      // Tier-1 tutors edit these columns directly; the queue is verified-only.
      throw new Error("Only verified tutors submit credential changes for review.");
    }

    const newValueSnap = toValueSnapshot(field, data.newValue);
    const oldValueSnap = toValueSnapshot(field, credentialFieldValue(tutor, field));
    if (stableSnapshotJson(newValueSnap) === stableSnapshotJson(oldValueSnap)) {
      throw new Error("That is already the value on your card.");
    }

    const path = credentialEvidencePath(data.tutorId, data.file.filename);
    const { error: uploadError } = await supabaseAdmin.storage
      .from("credential-evidence")
      .upload(path, new Uint8Array(bytes), {
        contentType: data.file.contentType,
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    // One open edit per (tutor, field) — the partial unique index rejects a
    // second pending row. Roll the document back and say so friendly.
    const { data: inserted, error: insertError } = (await supabaseAdmin
      .from("tutor_credential_edits" as never)
      .insert({
        tutor_id: data.tutorId,
        field,
        old_value: oldValueSnap,
        new_value: newValueSnap,
        evidence_path: path,
      } as never)
      .select("id, status")
      .single()) as unknown as {
      data: { id: string; status: string } | null;
      error: { message: string; code?: string } | null;
    };
    if (insertError || !inserted) {
      await supabaseAdmin.storage.from("credential-evidence").remove([path]);
      if (isDuplicatePendingEditError(insertError)) {
        return { ok: false, reason: "already_under_review", field };
      }
      throw new Error(insertError?.message ?? "Could not submit the change.");
    }

    return {
      ok: true,
      id: inserted.id,
      field,
      status: "pending",
    };
  });

// ---------------------------------------------------------------------------
// Staff server fns (shape copied from admin/grade-review.functions.ts)
// ---------------------------------------------------------------------------

async function assertAdmin(supabase: unknown, userId: string) {
  const roles: Array<"admin" | "super_admin"> = ["admin", "super_admin"];
  const client = supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  for (const role of roles) {
    const { data } = await client.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("Forbidden");
}

export type CredentialEditQueueRow = {
  id: string;
  tutor_id: string;
  tutor_code: string | null;
  tutor_name: string | null;
  field: string;
  /** jsonb snapshots, typed as plain JSON so TanStart can serialize them. */
  old_value: CredentialSnapshotValue;
  new_value: CredentialSnapshotValue;
  created_at: string;
};

/** Anything Postgres jsonb can hold (server fns may only return serializable values). */
export type CredentialSnapshotValue =
  | string
  | number
  | boolean
  | null
  | CredentialSnapshotValue[]
  | { [key: string]: CredentialSnapshotValue };

/** Pending credential edits, oldest first. Service-role read; staff-gated. */
export const fetchCredentialEditQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = (await supabaseAdmin
      .from("tutor_credential_edits" as never)
      .select(
        "id, tutor_id, field, old_value, new_value, created_at, tutors(tutor_code, display_name)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200)) as unknown as {
      data:
        | {
            id: string;
            tutor_id: string;
            field: string;
            old_value: unknown;
            new_value: unknown;
            created_at: string;
            tutors: { tutor_code: string | null; display_name: string | null } | null;
          }[]
        | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    return (data ?? []).map((source): CredentialEditQueueRow => ({
      id: source.id,
      tutor_id: source.tutor_id,
      tutor_code: source.tutors?.tutor_code ?? null,
      tutor_name: source.tutors?.display_name ?? null,
      field: source.field,
      old_value: source.old_value as CredentialSnapshotValue,
      new_value: source.new_value as CredentialSnapshotValue,
      created_at: source.created_at,
    }));
  });

/** Short-lived signed URL for the staff-only evidence view. */
export const getCredentialEvidenceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ editId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = (await supabaseAdmin
      .from("tutor_credential_edits" as never)
      .select("evidence_path")
      .eq("id", data.editId)
      .maybeSingle()) as unknown as {
      data: { evidence_path: string } | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    const filePath = row?.evidence_path;
    if (!filePath) throw new Error("No evidence document for this edit.");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("credential-evidence")
      .createSignedUrl(filePath, 600);
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message ?? "Could not create the document link.");
    }
    return { url: signed.signedUrl };
  });

const reviewInputSchema = z.object({
  editId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  // Free-text staff reason; required for reject via applyCredentialDecision.
  staffReason: z.string().trim().max(500).optional(),
});

/**
 * Approve/reject one credential edit. Approve swaps the new value into the
 * tutors row (service role bypasses the owner guard) and marks the row
 * approved; reject keeps the old value and stores the staff reason. Either
 * way the tutor gets one in-app notice — best-effort, never fails the action.
 */
export const reviewCredentialEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: rowError } = (await supabaseAdmin
      .from("tutor_credential_edits" as never)
      .select("id, tutor_id, field, old_value, new_value, status")
      .eq("id", data.editId)
      .maybeSingle()) as unknown as {
      data: {
        id: string;
        tutor_id: string;
        field: string;
        old_value: unknown;
        new_value: unknown;
        status: string;
      } | null;
      error: { message: string } | null;
    };
    if (rowError) throw new Error(rowError.message);
    const edit = row;
    if (!edit) throw new Error("Credential edit not found.");
    if (!isCredentialEditField(edit.field)) {
      throw new Error("Credential edit has an unknown field.");
    }

    const staffReason = data.staffReason?.trim() || null;
    const decision = applyCredentialDecision(edit, data.decision, staffReason);
    if (!decision.ok) {
      throw new Error(
        decision.reason === "not_pending"
          ? "This edit was already reviewed."
          : "A rejection reason is required.",
      );
    }

    if (data.decision === "approve") {
      // Swap the approved value in. Service role (auth.uid() IS NULL) passes
      // tutors_owner_verified_guard, so no guard change is needed.
      const columnValue = valueSnapshotToColumn(edit.field, edit.new_value);
      const { error: tutorUpdateError } = (await supabaseAdmin
        .from("tutors")
        .update({ [edit.field]: columnValue } as never)
        .eq("id", edit.tutor_id)) as unknown as { error: { message: string } | null };
      if (tutorUpdateError) throw new Error(tutorUpdateError.message);
    }

    const { error: updateError } = (await supabaseAdmin
      .from("tutor_credential_edits" as never)
      .update({
        status: decision.status,
        staff_reason: data.decision === "reject" ? staffReason : null,
        reviewed_at: decision.reviewedAt,
      } as never)
      .eq("id", edit.id)) as unknown as { error: { message: string } | null };
    if (updateError) throw new Error(updateError.message);

    // In-app notice to the tutor (same shape as the grade review notice).
    const { error: noticeError } = await supabaseAdmin.from("tutor_notices").insert({
      tutor_id: edit.tutor_id,
      kind: decision.status === "approved" ? "credential_approved" : "credential_rejected",
      payload: {
        edit_id: edit.id,
        field: edit.field,
        reason: data.decision === "reject" ? staffReason : null,
      },
    });
    if (noticeError) {
      console.error("[credential-edits] notice insert failed:", noticeError.message);
    }

    return { ok: true as const, status: decision.status };
  });
