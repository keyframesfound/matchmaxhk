/**
 * Issue #461 Phase A 3b — tutor tuition tracking + staff soft-void.
 * Rules live in tuition.ts; these handlers only load rows, check ownership
 * and write. Every write is audited on case_audit.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, requireAdmin, selectRows } from "@/features/cases/desk-db";
import {
  TUITION_SOURCES,
  TUITION_STATUSES,
  VOID_REASON_MAX,
  tuitionEditError,
  voidLessonError,
} from "@/features/cases/tuition";

type Row = Record<string, unknown>;

type TargetRow = { id: string; case_id: string; status: string; tutor_id: string | null };

export const setTuitionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        source: z.enum(TUITION_SOURCES),
        id: z.string().uuid(),
        status: z.enum(TUITION_STATUSES),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    const tutorId = tutors[0]?.id;
    if (!tutorId) throw new Error("NO_TUTOR_CARD");

    const table = data.source === "lesson" ? "case_lessons" : "tutor_session_logs";
    const rows = await selectRows<TargetRow>(db, table, "id, case_id, status, tutor_id", [
      { col: "id", op: "eq", value: data.id },
    ]);
    const target = rows[0];
    if (!target) throw new Error("LESSON_NOT_FOUND");

    // case_lessons.tutor_id is denormalized at insert; re-check the case's
    // current match so a replaced tutor cannot edit the old lessons.
    const cases = await selectRows<{ matched_tutor_id: string | null }>(
      db,
      "tutoring_cases",
      "matched_tutor_id",
      [{ col: "id", op: "eq", value: target.case_id }],
    );
    const isMine = target.tutor_id === tutorId && cases[0]?.matched_tutor_id === tutorId;
    const error = tuitionEditError({ source: data.source, status: target.status, isMine });
    if (error) throw new Error(error);

    const { error: updateError } = await db
      .from<Row>(table)
      .update({ tuition_status: data.status, tuition_status_at: new Date().toISOString() })
      .eq("id", target.id);
    if (updateError) throw new Error(updateError.message);
    await insertAudit(
      db,
      target.case_id,
      context.userId,
      target.status,
      data.status === "paid" ? "tuition_marked_collected" : "tuition_marked_unpaid",
    );
    return { ok: true };
  });

export const voidLessonAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        lessonId: z.string().uuid(),
        reason: z.string().max(VOID_REASON_MAX),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const rows = await selectRows<{
      id: string;
      case_id: string;
      status: string;
      hold_entry_id: string | null;
    }>(db, "case_lessons", "id, case_id, status, hold_entry_id", [
      { col: "id", op: "eq", value: data.lessonId },
    ]);
    const lesson = rows[0];
    if (!lesson) throw new Error("LESSON_NOT_FOUND");
    const error = voidLessonError({
      status: lesson.status,
      hasManagedHold: lesson.hold_entry_id !== null,
      reason: data.reason,
    });
    if (error) throw new Error(error);

    // Conditional on the status we read, so a concurrent mark/void loses cleanly.
    const { error: updateError, count } = await db
      .from<Row>("case_lessons")
      .update(
        {
          status: "voided",
          voided_at: new Date().toISOString(),
          voided_by: context.userId,
          void_reason: data.reason.trim(),
        },
        { count: "exact" },
      )
      .eq("id", lesson.id)
      .eq("status", lesson.status);
    if (updateError) throw new Error(updateError.message);
    if ((count ?? 0) === 0) throw new Error("LESSON_CHANGED");
    await insertAudit(db, lesson.case_id, context.userId, "voided", data.reason.trim());
    return { ok: true };
  });
