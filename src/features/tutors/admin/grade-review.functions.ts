import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GRADE_REJECTION_REASONS, type TutorGradeStatus } from "@/features/tutors/grades";

/**
 * Issue #309, staff grade-review queue server fns. All reads and the signed
 * slip URL go through the service role; there are NO client staff policies on
 * tutor_grades (issue #308 account_blocklist pattern). The file is never
 * public: staff view a short-lived signed URL minted here, admin-gated.
 */

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

export type GradeQueueRow = {
  id: string;
  tutor_code: string | null;
  grade_label: string;
  file_path: string | null;
  has_file: boolean;
  submitted_at: string;
};

/** Pending grade rows, submitted_at asc. */
export const fetchGradeQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tutor_grades")
      .select("id, label, status, file_path, created_at, tutors(tutor_code)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as {
      id: string;
      label: string;
      file_path: string | null;
      created_at: string;
      tutors: { tutor_code: string } | null;
    }[];
    return rows.map(
      (source) =>
        ({
          id: source.id,
          tutor_code: source.tutors?.tutor_code ?? null,
          grade_label: source.label,
          file_path: source.file_path,
          has_file: Boolean(source.file_path),
          submitted_at: source.created_at,
        }) satisfies GradeQueueRow,
    );
  });

/** Short-lived signed URL for the staff-only slip view. */
export const getGradeSlipUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ gradeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tutor_grades")
      .select("file_path")
      .eq("id", data.gradeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const filePath = (row as { file_path: string | null } | null)?.file_path;
    if (!filePath) throw new Error("No slip uploaded for this grade.");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("grade-slips")
      .createSignedUrl(filePath, 600);
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message ?? "Could not create the slip link.");
    }
    return { url: signed.signedUrl };
  });

const reviewInputSchema = z.object({
  gradeId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  // Required for reject, from the fixed staff reason list.
  reason: z.enum(GRADE_REJECTION_REASONS).optional(),
  note: z.string().trim().max(500).optional(),
});

/** Approve/reject one grade; one in-app notice to that tutor. Never touches
 * other rows, rejecting one grade leaves every other approved grade alone. */
export const reviewTutorGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.decision === "reject" && !data.reason) {
      throw new Error("Pick a rejection reason.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: rowError } = await supabaseAdmin
      .from("tutor_grades")
      .select("id, tutor_id, label, status")
      .eq("id", data.gradeId)
      .maybeSingle();
    if (rowError) throw new Error(rowError.message);
    const grade = row as {
      id: string;
      tutor_id: string;
      label: string;
      status: TutorGradeStatus;
    } | null;
    if (!grade) throw new Error("Grade not found.");

    const nextStatus: TutorGradeStatus = data.decision === "approve" ? "approved" : "rejected";
    const staffReason =
      data.decision === "reject"
        ? [data.reason, data.note].filter(Boolean).join(", ") || null
        : null;

    const { error: updateError } = await supabaseAdmin
      .from("tutor_grades")
      .update({
        status: nextStatus,
        staff_reason: staffReason,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", grade.id);
    if (updateError) throw new Error(updateError.message);

    // Minimal in-app notice (no WhatsApp, no email), deep-linking the tutor to
    // the grade row in the profile editor.
    const { error: noticeError } = await supabaseAdmin.from("tutor_notices").insert({
      tutor_id: grade.tutor_id,
      kind: data.decision === "approve" ? "grade_approved" : "grade_rejected",
      payload: {
        grade_id: grade.id,
        label: grade.label,
        reason: data.reason ?? null,
        note: data.note ?? null,
      },
    });
    if (noticeError) {
      // The review itself landed; a missed notice must not fail the action.
      console.error("[grade-review] notice insert failed:", noticeError.message);
    }

    return { ok: true as const, status: nextStatus };
  });
