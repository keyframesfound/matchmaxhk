// Issue #796 §2.6, AC-742-4: the Sunday 20:00 HKT weekly learning digest sweep.
// `tasks/weekly-digest.ts` dynamic-imports `runWeeklyDigestSweep` from here:
// Nitro bundles task files separately and cannot resolve the app's `@/` alias
// chain from `tasks/`, so the work lives in src and the task only orchestrates.
//
// One consolidated email per parent, never one per case: every active case the
// parent owns contributes a section, and cases with a quiet week (no verified
// lesson, homework, mastered mistake or recap) contribute nothing. The send
// goes through the #783 cap — `sendTemplateEmail` is marketing mail for
// `weekly-digest`, so `marketingUserId` claims the 7-day slot and a
// `{ sent: false, reason: "capped_or_opted_out" }` result is a normal skip,
// not an error. Transactional mail is untouched by this task.
//
// Reads mirror the card's server fn (weekly-digest.functions.ts) with the same
// bounds; the aggregation itself stays in weekly-digest-logic.ts so the email
// and the card can never disagree about a number.

import { selectRows, selectRowsInRange, type Db, type Row } from "@/features/cases/desk-db";
import { heatmapTopicKey, parseDrawerTopics } from "@/features/cases/heatmap-logic";
import type { DrawerLogRow } from "@/features/cases/super-drawer/super-drawer-logic";
import {
  buildDigestSection,
  selectDigestRecipients,
  type DigestCandidate,
} from "@/features/cases/weekly-digest-email-logic";
import {
  composeWeeklyDigest,
  digestWindow,
  type DigestHomeworkRow,
  type DigestLabels,
  type DigestLessonRow,
  type DigestMistakeRow,
  type WeeklyDigest,
} from "@/features/cases/weekly-digest-logic";
import enLocale from "@/features/i18n/locales/en.json";
import zhLocale from "@/features/i18n/locales/zh-HK.json";

/**
 * Bounded for the Workers subrequest budget (six reads + one send per case),
 * not because a parent could have this many cases. The sweep is sized for a
 * few hundred active cases; raising it needs batching, not just a bigger
 * constant.
 */
const MAX_CASES = 200;

// Same read bounds as the digest card's server fn.
const MAX_LESSONS = 500;
const MAX_LOGS = 500;
const MAX_WINDOW_ROWS = 500;
const MAX_MISTAKES = 1000;
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
  matched_tutor_id: string | null;
  sor_status: string | null;
};

type LessonReadRow = DigestLessonRow & { id: string };

/** The `weekly_digest.*` subtree, mapped onto the copy builder's label keys. */
function digestLabels(copy: typeof enLocale.weekly_digest): DigestLabels {
  return {
    header: copy.copy_header,
    case: copy.copy_case,
    lessons: copy.lessons,
    hoursWeek: copy.hours_week,
    hoursTotal: copy.hours_total,
    recap: copy.recap_title,
    homework: copy.homework,
    mistakes: copy.mistakes,
    next: copy.next_lesson,
    mastery: copy.mastery,
    focus: copy.focus,
  };
}

const LABELS = {
  en: digestLabels(enLocale.weekly_digest),
  zh: digestLabels(zhLocale.weekly_digest),
};

/**
 * Active cases with a tutor and a parent: a lead has no tutor to report on, and
 * a case without a parent has no recipient. Legacy cases with a null
 * `sor_status` are still taught, so they are kept; only the two terminal
 * statuses are excluded.
 */
async function readActiveCases(db: Db): Promise<CaseRow[]> {
  const { data, error } = await db
    .from<CaseRow>("tutoring_cases")
    .select("id, case_code, parent_id, matched_tutor_id, sor_status")
    .or("sor_status.is.null,sor_status.not.in.(closed,replaced)")
    .order("created_at", { ascending: false })
    .limit(MAX_CASES);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((row) => Boolean(row.matched_tutor_id) && Boolean(row.parent_id));
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
 * more than MAX_LESSONS future rows can never lose its next one. Rows the
 * newest-lesson read already returned are deduped by id on merge.
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

/** The card's reads, per case, composed into one digest (null on a quiet week). */
async function readCaseDigest(
  db: Db,
  caseId: string,
  now: Date,
  window: { startIso: string; endIso: string },
): Promise<WeeklyDigest | null> {
  const [lessonRows, upcoming, logRows, homework, mistakes, unresolved] = await Promise.all([
    selectRows<LessonReadRow>(
      db,
      "case_lessons",
      LESSON_COLUMNS,
      [{ col: "case_id", op: "eq", value: caseId }],
      { col: "starts_at", asc: false, limit: MAX_LESSONS },
    ),
    readUpcomingLessons(db, caseId, now.toISOString()),
    selectRows<DrawerLogRow>(
      db,
      "case_lesson_logs",
      LOG_COLUMNS,
      [{ col: "case_id", op: "eq", value: caseId }],
      { col: "created_at", asc: false, limit: MAX_LOGS },
    ),
    selectRowsInRange<DigestHomeworkRow>(
      db,
      "case_homework",
      "submitted_at",
      [{ col: "case_id", op: "eq", value: caseId }],
      { col: "submitted_at", from: window.startIso, to: window.endIso, limit: MAX_WINDOW_ROWS },
    ),
    selectRowsInRange<DigestMistakeRow>(
      db,
      "case_mistakes",
      "status, mastered_at",
      [
        { col: "case_id", op: "eq", value: caseId },
        { col: "status", op: "eq", value: "mastered" },
      ],
      { col: "mastered_at", from: window.startIso, to: window.endIso, limit: MAX_WINDOW_ROWS },
    ),
    unresolvedMistakesByTopic(db, caseId),
  ]);

  const seen = new Set(lessonRows.map((row) => row.id));
  const lessons: DigestLessonRow[] = [
    ...lessonRows,
    ...upcoming.filter((row) => !seen.has(row.id)),
  ];

  return composeWeeklyDigest({
    now,
    lessons,
    logs: logRows.map((row) => ({ ...row, topics: parseDrawerTopics(row.topics) })),
    homework,
    mistakes,
    unresolvedMistakesByTopic: unresolved,
  });
}

/** `auth.users.email` for the case parent; null when the account is gone. */
async function parentEmail(parentId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(parentId);
  if (error) {
    console.warn(`[weekly-digest] user read failed for ${parentId}:`, error.message);
    return null;
  }
  const email = data.user?.email?.trim();
  return email ? email : null;
}

/**
 * Close the case's pending `weekly_digest` fan-out rows. Only called for cases
 * that were actually included in a sent email: a quiet week or a capped parent
 * leaves its rows pending, so nothing is silently dropped. The migration's
 * status check allows pending/processed/failed ('processed' is the completion
 * state), and the cap claim — not this marker — is the real dedupe.
 */
async function markFanoutsDone(
  db: Db,
  caseIds: readonly string[],
  processedAt: string,
): Promise<void> {
  if (caseIds.length === 0) return;
  const { error } = await db
    .from<Row>("case_lesson_fanouts")
    .update({ status: "processed", processed_at: processedAt })
    .in("case_id", [...caseIds])
    .eq("job", "weekly_digest")
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}

/**
 * The sweep itself, kept out of `tasks/` because Nitro bundles task files
 * separately and cannot resolve the app's `@/` alias chain from there — the task
 * dynamic-imports this module instead, exactly like the other scheduled tasks.
 */
export async function runWeeklyDigestSweep(
  db: Db,
  now: Date,
): Promise<{ sent: number; skipped: number; failed: number }> {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const window = digestWindow(now);
  const weekKey = window.startIso.slice(0, 10);
  const processedAt = now.toISOString();

  const cases = await readActiveCases(db);
  const candidates: DigestCandidate[] = [];
  for (const kase of cases) {
    try {
      candidates.push({
        caseId: kase.id,
        caseCode: kase.case_code,
        parentId: kase.parent_id,
        digest: await readCaseDigest(db, kase.id, now, window),
      });
    } catch (err) {
      // One unreadable case must not cost every other parent their digest.
      console.error(`[weekly-digest] digest read failed for ${kase.id}:`, err);
      candidates.push({
        caseId: kase.id,
        caseCode: kase.case_code,
        parentId: kase.parent_id,
        digest: null,
      });
    }
  }

  const recipients = selectDigestRecipients(candidates);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const [parentId, entries] of recipients) {
    try {
      const email = await parentEmail(parentId);
      if (!email) {
        skipped += 1;
        continue;
      }

      const sections = entries.map((entry) =>
        buildDigestSection({
          digest: entry.digest,
          caseCode: entry.caseCode,
          labels: LABELS,
        }),
      );

      const result = await sendTemplateEmail("weekly-digest", email, {
        templateData: { sections },
        marketingUserId: parentId,
        idempotencyKey: `weekly-digest:${parentId}:${weekKey}`,
      });

      if (!result.sent) {
        // Capped or opted out: a normal skip. Fan-out rows stay pending.
        skipped += 1;
        continue;
      }

      sent += 1;
      try {
        await markFanoutsDone(
          db,
          entries.map((entry) => entry.caseId),
          processedAt,
        );
      } catch (err) {
        // The email went out; a failed marker must not fail the sweep.
        console.error(`[weekly-digest] fan-out mark failed for ${parentId}:`, err);
      }
    } catch (err) {
      failed += 1;
      console.error(`[weekly-digest] send failed for ${parentId}:`, err);
    }
  }

  console.log(
    `[weekly-digest] cases=${cases.length} parents=${recipients.size} sent=${sent} skipped=${skipped} failed=${failed}`,
  );
  return { sent, skipped, failed };
}
