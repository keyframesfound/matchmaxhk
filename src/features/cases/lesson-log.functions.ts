/**
 * Issue #796 §2.5 — Lesson Log / 課堂紀錄 timeline, server half.
 *
 * The #767 Super-Drawer writes `case_lesson_logs`; this is the read feed that
 * turns those rows into "Lesson #N" entries for the Case Workspace. Party
 * resolution copies `fetchCaseHeatmap` exactly (same service-role read, same
 * parent / student-owner / matched-tutor / Ops check) and a non-party gets
 * `null` rather than an error, so an unrelated tutor cannot tell "exists" from
 * "forbidden".
 *
 * Returns only the assembled rows: `logged_by`, `recap` and every other column
 * stay server-side.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { parseDrawerTopics } from "@/features/cases/heatmap-logic";
import {
  buildLessonLogRows,
  type LessonLogFeed,
  type LessonLogLesson,
} from "@/features/cases/lesson-log-logic";
import type { DrawerLogRow } from "@/features/cases/super-drawer/super-drawer-logic";

/** Newest N logs is the whole practical timeline; bounded so the read stays cheap. */
const MAX_LOGS = 200;

type CaseRow = {
  id: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
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

/**
 * True when the caller is a party of the case: linked parent, student owner,
 * matched tutor, or Ops/Admin/Staff. Unknown case and non-party both answer
 * false — the feed turns that into a null payload.
 */
async function canReadCaseLogs(db: Db, caseId: string, userId: string): Promise<boolean> {
  const cases = await selectRows<CaseRow>(
    db,
    "tutoring_cases",
    "id, parent_id, student_id, matched_tutor_id",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const kase = cases[0];
  if (!kase) return false;

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

  if (await isOps(db, userId)) return true;
  if (userId === kase.parent_id || userId === studentOwner) return true;
  if (tutorUserId && userId === tutorUserId) return true;
  return false;
}

const LOG_COLUMNS =
  "id, case_id, lesson_id, logged_by, recap_status, topics, pulse, recap, next_lesson_at, created_at, updated_at";

const LESSON_COLUMNS = "id, sequence, starts_at, duration_min";

export const fetchCaseLessonLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<LessonLogFeed | null> => {
    const db = await adminDb();
    if (!(await canReadCaseLogs(db, data.caseId, context.userId))) return null;

    // Newest first so the row cap keeps the most recent lessons.
    const logRows = await selectRows<DrawerLogRow>(
      db,
      "case_lesson_logs",
      LOG_COLUMNS,
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "created_at", asc: false, limit: MAX_LOGS },
    );
    const logs: DrawerLogRow[] = logRows.map((row) => ({
      ...row,
      topics: parseDrawerTopics(row.topics),
    }));

    // Every lesson on the case: the starts_at fallback numbering needs the
    // position among them, not just among the logged ones.
    const lessons = await selectRows<LessonLogLesson>(db, "case_lessons", LESSON_COLUMNS, [
      { col: "case_id", op: "eq", value: data.caseId },
    ]);

    return { rows: buildLessonLogRows(logs, lessons) };
  });
