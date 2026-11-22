/**
 * Issue #796 §2.6 (was #742) — weekly learning digest, server half.
 *
 * The digest card is for the LEARNER side of the case (parent or student
 * owner). The matched tutor, Ops and any non-party get `null`, so "exists" and
 * "forbidden" stay indistinguishable.
 *
 * Every read runs on the service role and is bounded: the newest 500 lessons
 * and 500 drawer logs (the digest is a week's summary, not an export), plus
 * window-scoped range reads for homework and mastered mistakes. No write path,
 * no email, no cron — #796 §2.6 ships the snapshot only.
 *
 * The window and every derived number live in `weekly-digest-logic.ts`; this
 * file only authorises and reads.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, selectRowsInRange, type Db } from "@/features/cases/desk-db";
import { heatmapTopicKey, parseDrawerTopics } from "@/features/cases/heatmap-logic";
import type { DrawerLogRow } from "@/features/cases/super-drawer/super-drawer-logic";
import {
  composeWeeklyDigest,
  digestWindow,
  type DigestHomeworkRow,
  type DigestLessonRow,
  type DigestMistakeRow,
  type WeeklyDigest,
} from "@/features/cases/weekly-digest-logic";

const MAX_LESSONS = 500;
const MAX_LOGS = 500;
const MAX_WINDOW_ROWS = 500;
const MAX_MISTAKES = 1000;
/** The next-lesson range is effectively unbounded upward; a case is never
 * scheduled past this, and a bounded query keeps the read cheap. */
const FAR_FUTURE_ISO = "9999-12-31T23:59:59.999Z";
const NEXT_LESSON_SCAN = 20;

const LESSON_COLUMNS =
  "id, status, confirmed_by_parent_at, confirmed_by_tutor_at, starts_at, duration_min";
const LOG_COLUMNS =
  "id, case_id, lesson_id, logged_by, recap_status, topics, pulse, recap, next_lesson_at, created_at, updated_at";

type CaseRow = {
  id: string;
  case_code: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
};

/** The digest only reads five lesson columns; `id` exists so merged reads dedupe. */
type LessonReadRow = DigestLessonRow & { id: string };

export type WeeklyDigestPayload = {
  digest: WeeklyDigest;
  caseCode: string;
};

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

/**
 * Learner-only gate. The tutor, Ops and non-parties are resolved to null before
 * any digest row is read.
 */
async function learnerCase(db: Db, caseId: string, userId: string): Promise<CaseRow | null> {
  const rows = await selectRows<CaseRow>(
    db,
    "tutoring_cases",
    "id, case_code, parent_id, student_id, matched_tutor_id",
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

/**
 * Safety net for the next lesson: an ascending range from `now` so a case with
 * more than `MAX_LESSONS` future rows can never lose its next one. Rows that
 * the newest-lesson read already returned are deduped by id on merge.
 */
async function readUpcomingLessons(
  db: Db,
  caseId: string,
  nowIso: string,
): Promise<LessonReadRow[]> {
  const rows = await selectRowsInRange<{ id: string; starts_at: string | null; status: string }>(
    db,
    "case_lessons",
    "id, starts_at, status",
    [
      { col: "case_id", op: "eq", value: caseId },
      { col: "status", op: "in", value: ["planned", "confirmed"] },
    ],
    { col: "starts_at", from: nowIso, to: FAR_FUTURE_ISO, limit: NEXT_LESSON_SCAN },
  );
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    confirmed_by_parent_at: null,
    confirmed_by_tutor_at: null,
    starts_at: row.starts_at,
    duration_min: null,
  }));
}

export const getWeeklyDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<WeeklyDigestPayload | null> => {
    const db = await adminDb();
    const kase = await learnerCase(db, data.caseId, context.userId);
    // Tutor, Ops and non-parties all get null: nothing about the case leaks.
    if (!kase) return null;

    const now = new Date();
    const { startIso, endIso } = digestWindow(now);

    // Newest lessons first so the row cap keeps the week in view; the next
    // lesson also gets its own ascending range, merged below by id.
    const [lessonRows, upcoming, logRows, homework, mistakes, unresolved] = await Promise.all([
      selectRows<LessonReadRow>(
        db,
        "case_lessons",
        LESSON_COLUMNS,
        [{ col: "case_id", op: "eq", value: data.caseId }],
        { col: "starts_at", asc: false, limit: MAX_LESSONS },
      ),
      readUpcomingLessons(db, data.caseId, now.toISOString()),
      selectRows<DrawerLogRow>(
        db,
        "case_lesson_logs",
        LOG_COLUMNS,
        [{ col: "case_id", op: "eq", value: data.caseId }],
        { col: "created_at", asc: false, limit: MAX_LOGS },
      ),
      selectRowsInRange<DigestHomeworkRow>(
        db,
        "case_homework",
        "submitted_at",
        [{ col: "case_id", op: "eq", value: data.caseId }],
        { col: "submitted_at", from: startIso, to: endIso, limit: MAX_WINDOW_ROWS },
      ),
      selectRowsInRange<DigestMistakeRow>(
        db,
        "case_mistakes",
        "status, mastered_at",
        [
          { col: "case_id", op: "eq", value: data.caseId },
          { col: "status", op: "eq", value: "mastered" },
        ],
        { col: "mastered_at", from: startIso, to: endIso, limit: MAX_WINDOW_ROWS },
      ),
      unresolvedMistakesByTopic(db, data.caseId),
    ]);

    const seenLessonIds = new Set(lessonRows.map((row) => row.id));
    const lessons: DigestLessonRow[] = [
      ...lessonRows,
      ...upcoming.filter((row) => !seenLessonIds.has(row.id)),
    ];

    const digest = composeWeeklyDigest({
      now,
      lessons,
      logs: logRows.map((row) => ({ ...row, topics: parseDrawerTopics(row.topics) })),
      homework,
      mistakes,
      unresolvedMistakesByTopic: unresolved,
    });

    if (!digest) return null;
    return { digest, caseCode: kase.case_code };
  });
