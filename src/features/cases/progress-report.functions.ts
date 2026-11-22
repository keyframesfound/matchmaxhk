/**
 * Issue #796 §2.6 (was #742), AC-742-3 — Progress Report, server half.
 *
 * The report is for the LEARNER side of the case only: the parent or the
 * student owner. The matched tutor, Ops and any non-party get `null`, so
 * "exists" and "forbidden" stay indistinguishable.
 *
 * Every read runs on the service role and is bounded: the newest 500 lessons,
 * 500 drawer logs and 500 unresolved mistakes. The report is all-time, not a
 * window, so there is no date filter — the row cap is what keeps the read cheap.
 *
 * Every derived figure lives in `progress-report-logic.ts`; this file only
 * authorises and reads. No write path, no email, no cron.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { heatmapTopicKey, parseDrawerTopics } from "@/features/cases/heatmap-logic";
import type { DrawerLogRow } from "@/features/cases/super-drawer/super-drawer-logic";
import {
  buildProgressReport,
  type ProgressLessonRow,
  type ProgressReport,
} from "@/features/cases/progress-report-logic";

const MAX_LESSONS = 500;
const MAX_LOGS = 500;
const MAX_MISTAKES = 500;

const LESSON_COLUMNS =
  "id, status, confirmed_by_parent_at, confirmed_by_tutor_at, starts_at, duration_min";
const LOG_COLUMNS =
  "id, case_id, lesson_id, logged_by, recap_status, topics, pulse, recap, next_lesson_at, created_at, updated_at";

type CaseRow = {
  id: string;
  case_code: string;
  learner_nickname: string | null;
  subjects: string[] | null;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
};

/** The report reads five lesson columns; `id` only exists so the read is typed. */
type LessonReadRow = ProgressLessonRow & { id: string };

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

/**
 * Learner-only gate. The tutor, Ops and non-parties are resolved to null before
 * a single report row is read. A case parent is a learner; the student owner
 * (students.owner_user_id) is the other.
 */
async function learnerCase(db: Db, caseId: string, userId: string): Promise<CaseRow | null> {
  const rows = await selectRows<CaseRow>(
    db,
    "tutoring_cases",
    "id, case_code, learner_nickname, subjects, parent_id, student_id, matched_tutor_id",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const kase = rows[0];
  if (!kase) return null;
  if (userId === kase.parent_id) return kase;

  if (!kase.student_id) return null;
  const student = (
    await selectRows<{ owner_user_id: string | null }>(db, "students", "owner_user_id", [
      { col: "id", op: "eq", value: kase.student_id },
    ])
  )[0];
  return student?.owner_user_id === userId ? kase : null;
}

/** Tutor display name, falling back to the public tutor code. Never a uuid. */
async function tutorNameFor(db: Db, tutorId: string | null): Promise<string | null> {
  if (!tutorId) return null;
  const rows = await selectRows<{ display_name: string | null; tutor_code: string | null }>(
    db,
    "tutors",
    "display_name, tutor_code",
    [{ col: "id", op: "eq", value: tutorId }],
  );
  const tutor = rows[0];
  const name = tutor?.display_name?.trim();
  if (name) return name;
  const code = tutor?.tutor_code?.trim();
  return code ? code : null;
}

/** Unresolved mistake counts by topic key — the heatmap's weak-by-mistakes input. */
async function unresolvedMistakesByTopic(db: Db, caseId: string): Promise<Record<string, number>> {
  const rows = await selectRows<{ topic_tag: string | null }>(
    db,
    "case_mistakes",
    "topic_tag",
    [
      { col: "case_id", op: "eq", value: caseId },
      { col: "status", op: "eq", value: "unresolved" },
    ],
    { col: "created_at", asc: false, limit: MAX_MISTAKES },
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = heatmapTopicKey(row.topic_tag);
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export const getCaseProgressReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<ProgressReport | null> => {
    const db = await adminDb();
    const kase = await learnerCase(db, data.caseId, context.userId);
    // Tutor, Ops and non-parties all get null: nothing about the case leaks.
    if (!kase) return null;

    // Newest first: the cap keeps the recent history, which is what a report
    // reader cares about on an extreme case.
    const [lessonRows, logRows, unresolved, tutorName] = await Promise.all([
      selectRows<LessonReadRow>(
        db,
        "case_lessons",
        LESSON_COLUMNS,
        [{ col: "case_id", op: "eq", value: data.caseId }],
        { col: "starts_at", asc: false, limit: MAX_LESSONS },
      ),
      selectRows<DrawerLogRow>(
        db,
        "case_lesson_logs",
        LOG_COLUMNS,
        [{ col: "case_id", op: "eq", value: data.caseId }],
        { col: "created_at", asc: false, limit: MAX_LOGS },
      ),
      unresolvedMistakesByTopic(db, data.caseId),
      tutorNameFor(db, kase.matched_tutor_id),
    ]);

    return buildProgressReport({
      now: new Date(),
      caseCode: kase.case_code,
      studentName: kase.learner_nickname,
      subject: kase.subjects?.[0] ?? null,
      tutorName,
      lessons: lessonRows,
      logs: logRows.map((row) => ({ ...row, topics: parseDrawerTopics(row.topics) })),
      unresolvedMistakesByTopic: unresolved,
    });
  });
