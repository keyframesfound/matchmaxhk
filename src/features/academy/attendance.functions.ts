/**
 * #533 recordAttendance: the one writer of attendance for tutors and admins.
 *
 * The case_lessons_managed_ledger trigger turns the status change into the
 * ledger CONSUME / RELEASE for managed cases; this fn only validates (window,
 * ownership, soft note gate) and returns the parent WhatsApp summary.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, requireAdmin, selectRows, type Db, type Row } from "@/features/cases/desk-db";
import { canMarkDone } from "@/features/cases/sor";
import {
  ATTENDANCE_STATUSES,
  NOTE_MIN_SENTENCES,
  countSentences,
  lessonStatusFor,
  noteGateError,
  parentSummaryMessage,
  type LessonStatus,
} from "@/features/academy/attendance";

type LessonRow = {
  id: string;
  case_id: string;
  status: string;
  starts_at: string;
  attendance: string | null;
  tutoring_cases: {
    matched_tutor_id: string | null;
    managed: boolean | null;
    credit_account_id: string | null;
  } | null;
};

export type AttendanceResult = {
  status: LessonStatus;
  managed: boolean;
  /** Copy-ready parent WhatsApp summary (managed only; #511 hook later). */
  summary: string | null;
};

async function isAdmin(db: Db, userId: string): Promise<boolean> {
  try {
    await requireAdmin(db, userId);
    return true;
  } catch {
    return false;
  }
}

async function tutorIdFor(db: Db, userId: string): Promise<string | null> {
  const rows = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  return rows[0]?.id ?? null;
}

async function skipAlreadyUsed(db: Db, caseId: string, lessonId: string): Promise<boolean> {
  const rows = await selectRows<{ id: string; note_override_by: string | null }>(
    db,
    "case_lessons",
    "id, note_override_by",
    [
      { col: "case_id", op: "eq", value: caseId },
      { col: "note_skipped", op: "eq", value: true },
    ],
  );
  return rows.some((r) => r.id !== lessonId && r.note_override_by === null);
}

async function managedSummary(
  db: Db,
  accountId: string,
  tutorId: string | null,
  attendance: (typeof ATTENDANCE_STATUSES)[number],
  note: string,
): Promise<string> {
  const [accounts, tutors] = await Promise.all([
    selectRows<{ balance: number | string; students: { display_name: string } | null }>(
      db,
      "credit_accounts",
      "balance, students(display_name)",
      [{ col: "id", op: "eq", value: accountId }],
    ),
    tutorId
      ? selectRows<{ display_name: string | null }>(db, "tutors", "display_name", [
          { col: "id", op: "eq", value: tutorId },
        ])
      : Promise.resolve([]),
  ]);
  const account = accounts[0];
  return parentSummaryMessage({
    studentName: account?.students?.display_name ?? "Your child",
    tutorName: tutors[0]?.display_name ?? "the tutor",
    attendance,
    note,
    creditsLeft: account ? Math.floor(Number(account.balance)) : null,
  });
}

const input = z.object({
  lessonId: z.string().uuid(),
  attendance: z.enum(ATTENDANCE_STATUSES),
  note: z.string().max(1000).default(""),
  skipNote: z.boolean().default(false),
  adminOverride: z.boolean().default(false),
});

export const recordAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ context, data }): Promise<AttendanceResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const rows = await selectRows<LessonRow>(
      db,
      "case_lessons",
      "id, case_id, status, starts_at, attendance, tutoring_cases(matched_tutor_id, managed, credit_account_id)",
      [{ col: "id", op: "eq", value: data.lessonId }],
    );
    const lesson = rows[0];
    if (!lesson) throw new Error("LESSON_NOT_FOUND");

    const admin = await isAdmin(db, context.userId);
    if (!admin) {
      const tutorId = await tutorIdFor(db, context.userId);
      if (!tutorId || lesson.tutoring_cases?.matched_tutor_id !== tutorId) {
        throw new Error("LESSON_NOT_FOUND");
      }
      if (data.adminOverride) throw new Error("FORBIDDEN");
      if (!canMarkDone(new Date(lesson.starts_at), new Date())) {
        throw new Error("DONE_WINDOW_CLOSED");
      }
    }
    if (lesson.attendance !== null) throw new Error("ALREADY_MARKED");
    if (lesson.status !== "planned" && lesson.status !== "confirmed") throw new Error("NOT_LIVE");

    const c = lesson.tutoring_cases;
    const managed = Boolean(c?.managed && c.credit_account_id);
    const note = data.note.trim();
    const noteShort = countSentences(note) < NOTE_MIN_SENTENCES;
    const gateError = noteGateError({
      managed,
      note,
      skipNote: data.skipNote,
      skipAlreadyUsed:
        managed && data.skipNote ? await skipAlreadyUsed(db, lesson.case_id, lesson.id) : false,
      adminOverride: data.adminOverride && admin,
    });
    if (gateError) throw new Error(gateError);

    const status = lessonStatusFor(data.attendance);
    const now = new Date().toISOString();
    const patch: Row = {
      status,
      attendance: data.attendance,
      attendance_note: note || null,
      note_skipped: managed && noteShort && data.skipNote,
      note_override_by: managed && noteShort && data.adminOverride && admin ? context.userId : null,
      attendance_marked_at: now,
      attendance_marked_by: context.userId,
    };
    if (status === "done") {
      patch.marked_done_by = context.userId;
      patch.done_at = now;
    }
    const { error } = await db.from<Row>("case_lessons").update(patch).eq("id", lesson.id);
    if (error) {
      // Trigger codes (NOTE_SKIP_USED, INSUFFICIENT_CREDITS) pass through as-is.
      throw new Error(error.message);
    }
    await insertAudit(
      db,
      lesson.case_id,
      context.userId,
      `lesson_${status}`,
      `[#533] ${data.attendance}`,
    );

    return {
      status,
      managed,
      summary:
        managed && c?.credit_account_id
          ? await managedSummary(db, c.credit_account_id, c.matched_tutor_id, data.attendance, note)
          : null,
    };
  });
