/**
 * Issue #785 AC-735-2b — post-lesson coaching comment, server half.
 *
 * Party-gated reads on the service role; the matched tutor (or Ops) writes, and
 * only after the lesson has started. A learner's write is refused with
 * FORBIDDEN before any lesson lookup, so it cannot be used to probe lesson ids.
 *
 * Reads return only what the panel renders: lesson number, start time, comment
 * text and when it was written. `coaching_comment_by` never leaves the server.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db, type Row } from "@/features/cases/desk-db";
import {
  COACHING_FEED_LIMIT,
  canWriteCoachingComment,
  coachingLessonNumber,
  lessonStarted,
  normaliseCoachingComment,
} from "@/features/cases/coaching-comment";

type CaseRow = {
  id: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
};

type Access = { role: "ops" | "learner" | "tutor" };

export type CoachingCommentRow = {
  lessonId: string;
  lessonNumber: number;
  startsAt: string;
  comment: string | null;
  updatedAt: string | null;
};

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

async function isOps(db: Db, userId: string): Promise<boolean> {
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

/** Party resolution, same shape as the lesson-log feed: null = not a party. */
async function loadAccess(db: Db, caseId: string, userId: string): Promise<Access | null> {
  const cases = await selectRows<CaseRow>(
    db,
    "tutoring_cases",
    "id, parent_id, student_id, matched_tutor_id",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const kase = cases[0];
  if (!kase) return null;

  const studentOwner = kase.student_id
    ? ((
        await selectRows<{ owner_user_id: string | null }>(db, "students", "owner_user_id", [
          { col: "id", op: "eq", value: kase.student_id },
        ])
      )[0]?.owner_user_id ?? null)
    : null;

  const tutorUserId = kase.matched_tutor_id
    ? ((
        await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
          { col: "id", op: "eq", value: kase.matched_tutor_id },
        ])
      )[0]?.user_id ?? null)
    : null;

  if (await isOps(db, userId)) return { role: "ops" };
  if (userId === kase.parent_id || userId === studentOwner) return { role: "learner" };
  if (tutorUserId && userId === tutorUserId) return { role: "tutor" };
  return null;
}

type LessonRow = {
  id: string;
  sequence: number | null;
  starts_at: string | null;
  coaching_comment: string | null;
  coaching_comment_at: string | null;
};

const LESSON_COLUMNS = "id, sequence, starts_at, coaching_comment, coaching_comment_at";

export const listCoachingComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CoachingCommentRow[] | null> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) return null;

    // Every lesson: the numbering fallback needs positions across the whole case.
    const lessons = await selectRows<LessonRow>(db, "case_lessons", LESSON_COLUMNS, [
      { col: "case_id", op: "eq", value: data.caseId },
    ]);
    const numbers = coachingLessonNumber(lessons);
    const now = new Date();

    return lessons
      .filter((lesson) => lessonStarted(lesson.starts_at, now))
      .sort((a, b) => {
        const at = a.starts_at ? Date.parse(a.starts_at) : 0;
        const bt = b.starts_at ? Date.parse(b.starts_at) : 0;
        return bt - at;
      })
      .slice(0, COACHING_FEED_LIMIT)
      .map((lesson) => ({
        lessonId: lesson.id,
        lessonNumber: numbers.get(lesson.id) ?? 0,
        startsAt: lesson.starts_at as string,
        comment: lesson.coaching_comment,
        updatedAt: lesson.coaching_comment_at,
      }));
  });

export const setCoachingComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        lessonId: z.string().uuid(),
        text: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ savedAt: string | null }> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) throw new Error("CASE_NOT_FOUND");

    const ops = await isOps(db, context.userId);
    if (!canWriteCoachingComment(access.role === "tutor" ? "tutor" : "parent", ops)) {
      throw new Error("FORBIDDEN");
    }

    const lessons = await selectRows<Pick<LessonRow, "id" | "starts_at">>(
      db,
      "case_lessons",
      "id, starts_at",
      [
        { col: "id", op: "eq", value: data.lessonId },
        { col: "case_id", op: "eq", value: data.caseId },
      ],
    );
    const lesson = lessons[0];
    if (!lesson) throw new Error("LESSON_NOT_FOUND");
    if (!lessonStarted(lesson.starts_at, new Date())) throw new Error("LESSON_NOT_STARTED");

    const normalised = normaliseCoachingComment(data.text);
    if (!normalised.ok) throw new Error(normalised.code);

    const savedAt = normalised.text ? new Date().toISOString() : null;
    const { error } = await db
      .from<Row>("case_lessons")
      .update({
        coaching_comment: normalised.text,
        coaching_comment_by: normalised.text ? context.userId : null,
        coaching_comment_at: savedAt,
      })
      .eq("id", data.lessonId)
      .eq("case_id", data.caseId);
    if (error) throw new Error(error.message);

    return { savedAt };
  });
