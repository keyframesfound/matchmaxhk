import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  GRADE_LABEL_MAX,
  MAX_GRADE_FILE_BYTES,
  gradeLabelError,
  isAcceptedGradeFileType,
  looksLikeHkid,
  nextStatusAfterLabelEdit,
  nextStatusAfterUpload,
  normalizeGradeLabel,
  type TutorGradeStatus,
} from "@/features/tutors/grades";

/**
 * Issue #309, tutor-facing tutor_grades server fns. Row reads go through the
 * RLS "Tutors manage own grades" policy straight from the client; every
 * MUTATION goes through these fns so the state machine (label edit demotes an
 * approved grade to pending, uploads always re-enter review) is enforced
 * server-side, and so slip files touch the private grade-slips bucket only via
 * the service role.
 */

/** The signed-in account's linked tutor card id, via the service role. */
async function getOwnedTutorId(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tutors")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const tutorId = (data as { id: string } | null)?.id;
  if (!tutorId) throw new Error("Your account is not linked to a tutor card.");
  return tutorId;
}

/** Loads a tutor_grades row and asserts it belongs to the linked tutor. */
async function getOwnedGrade(
  userId: string,
  gradeId: string,
): Promise<{ id: string; label: string; status: TutorGradeStatus; file_path: string | null }> {
  const tutorId = await getOwnedTutorId(userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tutor_grades")
    .select("id, tutor_id, label, status, file_path")
    .eq("id", gradeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as {
    id: string;
    tutor_id: string;
    label: string;
    status: TutorGradeStatus;
    file_path: string | null;
  } | null;
  if (!row || row.tutor_id !== tutorId) throw new Error("Grade not found.");
  return row;
}

export const createTutorGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ label: z.string().trim().min(1, "Required").max(GRADE_LABEL_MAX) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const label = normalizeGradeLabel(data.label);
    const labelError = gradeLabelError(label);
    if (labelError) throw new Error(labelError);
    const tutorId = await getOwnedTutorId(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tutor_grades")
      .insert({ tutor_id: tutorId, label, status: "none" } as never)
      .select("id, label, status, file_path, staff_reason, created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not add the grade.");
    return row;
  });

const gradeFileSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(MAX_GRADE_FILE_BYTES),
  content: z.string().min(1),
});

function gradeSlipPath(tutorId: string, gradeId: string, filename: string): string {
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120) || "slip";
  return `${tutorId}/${gradeId}/${Date.now()}-${safeName}`;
}

export const uploadTutorGradeSlip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ gradeId: z.string().uuid(), file: gradeFileSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { file } = data;
    // Identity cards are never valid grade slips, rejected server-side too
    // (the UI shows the same rule client-side before upload).
    if (looksLikeHkid(file.filename)) {
      throw new Error("Do not upload an identity card.");
    }
    if (!isAcceptedGradeFileType(file.contentType)) {
      throw new Error("Upload a PDF or an image (JPG, PNG, WebP).");
    }
    const bytes = Buffer.from(file.content, "base64");
    if (bytes.length === 0 || bytes.length !== file.size) {
      throw new Error("Invalid file data.");
    }
    if (bytes.length > MAX_GRADE_FILE_BYTES) {
      throw new Error("Files must be 10 MB or smaller.");
    }

    const grade = await getOwnedGrade(context.userId, data.gradeId);
    const tutorId = await getOwnedTutorId(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove any previous slip so one grade row holds exactly one document.
    if (grade.file_path) {
      await supabaseAdmin.storage.from("grade-slips").remove([grade.file_path]);
    }

    const path = gradeSlipPath(tutorId, grade.id, file.filename);
    const { error: uploadError } = await supabaseAdmin.storage
      .from("grade-slips")
      .upload(path, new Uint8Array(bytes), {
        contentType: file.contentType,
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    const nextStatus = nextStatusAfterUpload(grade.status);
    const { error: updateError } = await supabaseAdmin
      .from("tutor_grades")
      .update({
        file_path: path,
        status: nextStatus,
        staff_reason: null,
        reviewed_at: null,
      } as never)
      .eq("id", grade.id);
    if (updateError) throw new Error(updateError.message);
    return { ok: true as const, status: nextStatus };
  });

export const updateTutorGradeLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        gradeId: z.string().uuid(),
        label: z.string().trim().min(1, "Required").max(GRADE_LABEL_MAX),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const label = normalizeGradeLabel(data.label);
    const labelError = gradeLabelError(label);
    if (labelError) throw new Error(labelError);

    const grade = await getOwnedGrade(context.userId, data.gradeId);
    // Edit-after-approval: changing the TEXT of an approved grade hides it
    // from the card (back to pending) until staff re-approve. Editing bio,
    // price, photo or stations never touches these rows, so the badge is
    // unaffected by ordinary profile edits.
    const labelChanged = grade.label !== label;
    const nextStatus = nextStatusAfterLabelEdit(grade.status, labelChanged);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tutor_grades")
      .update({ label, status: nextStatus } as never)
      .eq("id", grade.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, status: nextStatus };
  });

export const deleteTutorGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ gradeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const grade = await getOwnedGrade(context.userId, data.gradeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (grade.file_path) {
      const { error: removeError } = await supabaseAdmin.storage
        .from("grade-slips")
        .remove([grade.file_path]);
      if (removeError) {
        console.error("[tutor-grades] slip removal failed:", removeError.message);
      }
    }
    // Deleting the last approved grade drops the badge via the trigger; the
    // card itself stays up.
    const { error } = await supabaseAdmin.from("tutor_grades").delete().eq("id", grade.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const markGradeNoticeRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ noticeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const tutorId = await getOwnedTutorId(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tutor_notices")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("id", data.noticeId)
      .eq("tutor_id", tutorId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
