/**
 * Issue #449 — Failed-Trial Pivot backend (`createRematchCase`).
 *
 * Makes the existing free rematch INSTANT: from a failed case the desk
 * creates the replacement case with one call — no re-intake, no re-asking
 * the five questions — and gets the next ≤2 tutor codes loaded from the
 * original criteria (failed tutor excluded).
 *
 *   failed case (status failed_trial_pivot, set via the admin board status
 *   controls) → NEW case: criteria copied, priority_tier=P1,
 *   replacement_of_case_id=failed.id, off the public board, no matched
 *   tutor, fresh funnel status `new`.
 *
 * Ownership split (CEO lock 2026-10-24): this file supplies the HANDLER —
 * the Pivot button / next-2 loader chrome consumes it from #454. Fee stays
 * Milestone 4B / Edge Case 1: invoice 1.0× Lesson 1 on the FAILED case via
 * the existing fee panel (skip if already invoiced/paid, HK$0 when no L1);
 * the successful rematch takes the standard 1.5-lesson fee on the NEW case.
 *
 * Idempotency: the partial unique index `tutoring_cases_one_rematch_per_failed`
 * (20261101020000) guarantees one rematch per failed case — a double click
 * or a retried call returns the existing rematch (`existing: true`) instead
 * of spawning duplicates.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;

/** Criteria copied onto the rematch (subject/time/budget/language + desk fields). */
const COPIED_COLUMNS = [
  "parent_id",
  "who_for",
  "student_gender",
  "subjects",
  "exam_system",
  "student_level",
  "student_grade_current",
  "academic_tier",
  "uni_field",
  "uni_name",
  "uni_program",
  "uni_course_codes",
  "kindergarten_focus",
  "requester_type",
  "support_type",
  "specific_component",
  "target_pathway",
  "target_school",
  "interview_test",
  "school_type",
  "tutor_background",
  "language_of_instruction",
  "tags",
  "sen_required",
  "sen_categories",
  "sen_details",
  "district",
  "mode",
  "sessions_per_week",
  "session_length_minutes",
  "budget_currency",
  "budget_min",
  "budget_max",
  "student_count",
  "rate_unit",
  "class_format_preference",
  "contact_name",
  "contact_phone",
  "desk_language",
  "organisation_id",
  "title",
  "description",
] as const;

async function requireStaff(db: Db, userId: string): Promise<void> {
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

export type RematchNextTutor = {
  id: string;
  tutor_code: string;
  display_name: string;
  score: number;
};

export type CreateRematchResult = {
  caseId: string;
  caseCode: string;
  /** true when the rematch already existed (idempotent replay). */
  existing: boolean;
  failedCaseCode: string;
  nextTutors: RematchNextTutor[];
};

export const createRematchCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ failedCaseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CreateRematchResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireStaff(db, context.userId);

    // Idempotency pre-check: a rematch for this failed case already exists.
    const { data: existingRows } = await db
      .from<Row>("tutoring_cases")
      .select("id, case_code")
      .eq("replacement_of_case_id", data.failedCaseId)
      .limit(1);
    const existing = (existingRows ?? [])[0];

    const { data: failedRows, error: failedError } = await db
      .from<Row>("tutoring_cases")
      .select(`id, case_code, status, ${COPIED_COLUMNS.join(", ")}, package_type, is_short_case`)
      .eq("id", data.failedCaseId)
      .limit(1);
    if (failedError) throw new Error(failedError.message ?? "failed case read error");
    const failed = (failedRows ?? [])[0];
    if (!failed) throw new Error("Case not found");
    if (failed.status !== "failed_trial_pivot") {
      throw new Error(
        "Only a failed-trial pivot case can be rematched — set the case status to Failed-trial pivot first.",
      );
    }

    if (existing) {
      return {
        caseId: String(existing.id),
        caseCode: String(existing.case_code),
        existing: true,
        failedCaseCode: String(failed.case_code),
        nextTutors: [],
      };
    }

    // #449 fee rule: the rematch case takes the STANDARD 1.5-lesson fee on
    // completion, so short-case fee math must not ride along. Pro-bono stays
    // pro-bono (HK$0 admin either way); the desk re-flags short-term on the
    // new case via the Short-Case panel when it really is one.
    const packageType = failed.package_type === "pro_bono" ? "pro_bono" : "ongoing_1_5";

    const insertRow: Record<string, unknown> = {
      status: "new",
      priority_tier: "P1",
      source: "rematch",
      replacement_of_case_id: failed.id,
      board_published_at: null,
      matched_tutor_id: null,
      package_type: packageType,
      is_short_case: false,
      scheduled_lesson_count: null,
    };
    for (const col of COPIED_COLUMNS) insertRow[col] = failed[col] ?? null;

    const { data: created, error: insertError } = await db
      .from<Row>("tutoring_cases")
      .insert(insertRow)
      .select("id, case_code")
      .single();
    if (insertError) {
      // Lost a race against another desk member's pivot: converge on their
      // rematch case (unique index tutoring_cases_one_rematch_per_failed).
      if ((insertError as { code?: string }).code === "23505") {
        const { data: winnerRows } = await db
          .from<Row>("tutoring_cases")
          .select("id, case_code")
          .eq("replacement_of_case_id", data.failedCaseId)
          .limit(1);
        const winner = (winnerRows ?? [])[0];
        if (winner) {
          return {
            caseId: String(winner.id),
            caseCode: String(winner.case_code),
            existing: true,
            failedCaseCode: String(failed.case_code),
            nextTutors: [],
          };
        }
      }
      throw new Error(insertError.message ?? "rematch case create failed");
    }

    const { error: auditError } = await db.from<Row>("case_audit").insert({
      case_id: created.id as string,
      actor_id: context.userId,
      from_status: null,
      to_status: "new",
      reason: `Failed-trial pivot rematch of ${String(failed.case_code)} (P1, failed tutor excluded)`,
    });
    if (auditError) {
      // Audit is bookkeeping, not the pivot itself — log and continue.
      console.error("[rematch] audit insert failed:", auditError.message);
    }

    // Next ≤2 from the ORIGINAL criteria — the RPC already excludes the
    // replaced case's tutor for rematch cases (20261101020000).
    const { data: nextRows, error: nextError } = await db.rpc("match_tutors_for_case", {
      _case_id: created.id as string,
      _limit: 2,
    });
    if (nextError) throw new Error(nextError.message ?? "rematch shortlist failed");
    const nextTutors = ((nextRows ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      tutor_code: String(row.tutor_code ?? ""),
      display_name: String(row.display_name ?? ""),
      score: Number(row.score ?? 0),
    }));

    return {
      caseId: String(created.id),
      caseCode: String(created.case_code),
      existing: false,
      failedCaseCode: String(failed.case_code),
      nextTutors,
    };
  });
