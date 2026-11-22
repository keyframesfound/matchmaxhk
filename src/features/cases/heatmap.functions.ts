/**
 * Issue #796 §2.1 — Syllabus Topic Mastery Heatmap, server half.
 *
 * Reads every #767 Super-Drawer log for a case, folds the topics together with
 * the #796 §2.2 mistake book's unresolved topic tags (heatmap-logic.ts does the
 * folding), and overlays the parent/student "flag for help" rows from
 * `case_topic_flags` (20261122100000_issue_796_topic_heatmap.sql).
 *
 * #796 §2.1 plan half: `case_topic_plan` (20261122120000_issue_796_case_topic_plan.sql)
 * holds the topics a case intends to cover. Planned topics merge into the cells
 * as never-mastered ("Not Covered") cells; `summary` stays computed from real
 * logs only. Suggestions are DERIVED — tags already logged on other cases that
 * share this case's first subject, never an authored curriculum list — and only
 * topic strings leave the server, never another case's id or learner.
 *
 * Every call re-checks the caller against the case before reading, the flag
 * write allows only the parent or the student owner, and plan writes allow only
 * the matched tutor or Ops. All of it runs on the service role; the tables'
 * revoked grants make the server fns the only door.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import {
  TOPIC_PLAN_MAX,
  buildTopicCells,
  heatmapTopicKey,
  mergePlannedTopics,
  normalizeHeatmapTag,
  parseDrawerTopics,
  rankTopicSuggestions,
  type HeatmapCell,
  type HeatmapSummary,
} from "@/features/cases/heatmap-logic";
import type { DrawerLogRow } from "@/features/cases/super-drawer/super-drawer-logic";

/**
 * Newest N drawer logs are enough for a per-case heatmap. Keeps the read bounded
 * on a long-running case without changing the fold (newest still wins).
 */
const MAX_LOGS = 500;
const MAX_MISTAKES = 1000;
/** Suggestions: newest N logs from at most M sibling cases in the same subject. */
const MAX_SUGGESTION_LOGS = 2000;
const MAX_SUGGESTION_CASES = 500;

type CaseRow = {
  id: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
  subjects: string[] | null;
};

type HeatmapRole = "ops" | "learner" | "tutor";

type HeatmapAccess = {
  kase: CaseRow;
  role: HeatmapRole;
};

export type CaseHeatmapCell = HeatmapCell & { flagged: boolean };

export type CaseHeatmap = {
  canEdit: boolean;
  canFlag: boolean;
  summary: HeatmapSummary;
  cells: CaseHeatmapCell[];
};

export type CaseTopicPlan = {
  /** Planned topics in stored order (oldest first). */
  planned: string[];
  /** Derived topic names only — no case ids, student names or other identity. */
  suggestions: string[];
  /** Tutor or Ops: only these may change the plan. */
  canEdit: boolean;
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
 * Resolve the caller against the case. null = not a party, and the read turns
 * that into a null payload so an unrelated tutor can never tell "exists" from
 * "forbidden".
 */
async function loadAccess(db: Db, caseId: string, userId: string): Promise<HeatmapAccess | null> {
  const cases = await selectRows<CaseRow>(
    db,
    "tutoring_cases",
    "id, parent_id, student_id, matched_tutor_id, subjects",
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

  if (await isOps(db, userId)) return { kase, role: "ops" };
  if (userId === kase.parent_id || userId === studentOwner) return { kase, role: "learner" };
  if (tutorUserId && userId === tutorUserId) return { kase, role: "tutor" };
  return null;
}

const LOG_COLUMNS =
  "id, case_id, lesson_id, logged_by, recap_status, topics, pulse, recap, next_lesson_at, created_at, updated_at";

/** Unresolved mistake rows on the case, counted by normalised topic. */
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

/** Plan rows oldest first — the stored order the plan pill list renders in. */
async function readPlanRows(db: Db, caseId: string): Promise<{ id: string; topic: string }[]> {
  return selectRows<{ id: string; topic: string }>(
    db,
    "case_topic_plan",
    "id, topic",
    [{ col: "case_id", op: "eq", value: caseId }],
    { col: "created_at", asc: true },
  );
}

/**
 * Degraded plan read for the heatmap: the plan is an overlay on logs that
 * already exist, so a failed/missing table must never take the heatmap down.
 * Writes use readPlanRows directly and surface the error.
 */
async function plannedTopicsOrEmpty(db: Db, caseId: string): Promise<string[]> {
  try {
    const rows = await readPlanRows(db, caseId);
    return rows
      .map((row) => normalizeHeatmapTag(row.topic))
      .filter((tag): tag is string => Boolean(tag));
  } catch (e) {
    console.warn(
      "[heatmap] case_topic_plan read failed, using no plan:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

/** Only the matched tutor or Ops may change the plan; parent/student are read-only. */
function requirePlanEdit(access: HeatmapAccess): void {
  if (access.role !== "tutor" && access.role !== "ops") throw new Error("FORBIDDEN");
}

/** The DB trigger raises the literal message 'TOPIC_CAP'; keep that code intact. */
function planWriteError(error: { message: string }): Error {
  if (/TOPIC_CAP/.test(error.message)) return new Error("TOPIC_CAP");
  return new Error(error.message);
}

/**
 * PostgREST array `contains` is not on the shared AdminTable surface, so this one
 * query is cast to the real supabase-js builder (same trick as
 * selectRowsInRange in desk-db.ts).
 */
type SubjectCasesQuery<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}> & {
  contains: (col: string, value: unknown) => SubjectCasesQuery<T>;
  neq: (col: string, value: unknown) => SubjectCasesQuery<T>;
  order: (col: string, opts?: { ascending?: boolean }) => SubjectCasesQuery<T>;
  limit: (n: number) => SubjectCasesQuery<T>;
};

/**
 * Ids of other cases that share the subject. Ids never leave the server: they
 * are only used to scope the log read that feeds `rankTopicSuggestions`.
 */
async function otherCaseIdsInSubject(db: Db, caseId: string, subject: string): Promise<string[]> {
  const query = db
    .from<{ id: string }>("tutoring_cases")
    .select("id") as unknown as SubjectCasesQuery<{
    id: string;
  }>;
  const { data, error } = await query
    .contains("subjects", [subject])
    .neq("id", caseId)
    .order("created_at", { ascending: false })
    .limit(MAX_SUGGESTION_CASES);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * Topic usage on the sibling cases, newest `MAX_SUGGESTION_LOGS` logs only. One
 * sighting per log per topic; spelling variants stay separate so the ranking can
 * pick the most-used one.
 */
async function loggedTagUsage(
  db: Db,
  caseIds: readonly string[],
): Promise<{ tag: string; count: number }[]> {
  if (caseIds.length === 0) return [];
  const rows = await selectRows<{ topics: unknown }>(
    db,
    "case_lesson_logs",
    "topics",
    [{ col: "case_id", op: "in", value: [...caseIds] }],
    { col: "created_at", asc: false, limit: MAX_SUGGESTION_LOGS },
  );
  const counts = new Map<string, { tag: string; count: number }>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const topic of parseDrawerTopics(row.topics)) {
      const key = heatmapTopicKey(topic.tag);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(topic.tag) ?? { tag: topic.tag, count: 0 };
      entry.count += 1;
      counts.set(topic.tag, entry);
    }
  }
  return [...counts.values()];
}

/** Every topic key already on this case's heatmap (logs + unresolved mistakes). */
async function ownHeatmapTopicKeys(db: Db, caseId: string): Promise<Set<string>> {
  const [logs, mistakeCounts] = await Promise.all([
    selectRows<{ topics: unknown }>(
      db,
      "case_lesson_logs",
      "topics",
      [{ col: "case_id", op: "eq", value: caseId }],
      { col: "created_at", asc: false, limit: MAX_LOGS },
    ),
    unresolvedMistakesByTopic(db, caseId),
  ]);
  const keys = new Set<string>();
  for (const row of logs) {
    for (const topic of parseDrawerTopics(row.topics)) {
      const key = heatmapTopicKey(topic.tag);
      if (key) keys.add(key);
    }
  }
  for (const key of Object.keys(mistakeCounts)) keys.add(key);
  return keys;
}

export const fetchCaseHeatmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseHeatmap | null> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) return null;

    // Oldest-first fold happens inside buildTopicCells; read newest-first so the
    // row cap keeps the most recent logs.
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

    const flaggedRows = await selectRows<{ topic: string }>(db, "case_topic_flags", "topic", [
      { col: "case_id", op: "eq", value: data.caseId },
    ]);
    const flaggedKeys = new Set(flaggedRows.map((row) => heatmapTopicKey(row.topic)));

    const { cells, summary } = buildTopicCells(
      logs,
      await unresolvedMistakesByTopic(db, data.caseId),
    );

    // `summary` is computed above from real logs only; planned pills are an
    // overlay so a grey "Not Covered" never dilutes the mastered percentage.
    const mergedCells = mergePlannedTopics(cells, await plannedTopicsOrEmpty(db, data.caseId));

    return {
      // Only the matched tutor (or Ops) can write mastery via the drawer.
      canEdit: access.role === "tutor" || access.role === "ops",
      // "Flag for help" is a parent/student signal — never the tutor or Ops.
      canFlag: access.role === "learner",
      summary,
      cells: mergedCells.map((cell) => ({
        ...cell,
        flagged: flaggedKeys.has(heatmapTopicKey(cell.tag)),
      })),
    };
  });

/**
 * The plan editor's read: planned pills plus derived suggestions. Suggestions are
 * topics other cases in the same subject already logged — no curriculum tables,
 * and only topic strings leave the server (never ids, learners, or case identity).
 */
export const getCaseTopicPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseTopicPlan | null> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) return null;

    const planned = await plannedTopicsOrEmpty(db, data.caseId);
    const subject = (access.kase.subjects ?? [])
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .find((value) => value.length > 0);

    let suggestions: string[] = [];
    if (subject) {
      const [siblingCaseIds, ownKeys] = await Promise.all([
        otherCaseIdsInSubject(db, data.caseId, subject),
        ownHeatmapTopicKeys(db, data.caseId),
      ]);
      suggestions = rankTopicSuggestions({
        loggedTags: await loggedTagUsage(db, siblingCaseIds),
        exclude: [...planned, ...ownKeys],
      });
    }

    return {
      planned,
      suggestions,
      canEdit: access.role === "tutor" || access.role === "ops",
    };
  });

/**
 * Plan writes take the raw topic and let `normalizeHeatmapTag` be the single
 * authority on what is usable (# strip, trim, 1..80) so an empty pill reports
 * `TOPIC_REQUIRED` instead of a generic validation error.
 */
const plainTopicInput = z.object({ caseId: z.string().uuid(), topic: z.string().max(200) });

export const addCasePlannedTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => plainTopicInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) throw new Error("CASE_NOT_FOUND");
    requirePlanEdit(access);

    const topic = normalizeHeatmapTag(data.topic);
    if (!topic) throw new Error("TOPIC_REQUIRED");
    const key = heatmapTopicKey(topic);

    const existing = await readPlanRows(db, data.caseId);
    // Idempotent: a differently-cased duplicate of a planned topic is a no-op.
    if (existing.some((row) => heatmapTopicKey(row.topic) === key)) return { ok: true };
    if (existing.length >= TOPIC_PLAN_MAX) throw new Error("TOPIC_CAP");

    const { error } = await db
      .from<{ id: string }>("case_topic_plan")
      .insert({ case_id: data.caseId, topic, added_by: context.userId });
    if (error) throw planWriteError(error);

    return { ok: true };
  });

export const removeCasePlannedTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => plainTopicInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) throw new Error("CASE_NOT_FOUND");
    requirePlanEdit(access);

    const key = heatmapTopicKey(data.topic);
    if (!key) return { ok: true };

    const existing = await readPlanRows(db, data.caseId);
    const match = existing.find((row) => heatmapTopicKey(row.topic) === key);
    if (!match) return { ok: true };

    const { error } = await db.from<{ id: string }>("case_topic_plan").delete().eq("id", match.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const flagCaseTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        topic: z.string().trim().min(1).max(80),
        flagged: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) throw new Error("CASE_NOT_FOUND");
    if (access.role !== "learner") throw new Error("FORBIDDEN");

    const topic = normalizeHeatmapTag(data.topic);
    if (!topic) throw new Error("INVALID_TOPIC");
    const key = heatmapTopicKey(topic);

    // Compare case-insensitively so "Algebra" and "algebra" are one flag.
    const existing = await selectRows<{ id: string; topic: string }>(
      db,
      "case_topic_flags",
      "id, topic",
      [{ col: "case_id", op: "eq", value: data.caseId }],
    );
    const match = existing.find((row) => heatmapTopicKey(row.topic) === key);

    if (data.flagged) {
      if (!match) {
        const { error } = await db
          .from<{ id: string }>("case_topic_flags")
          .upsert(
            { case_id: data.caseId, topic, flagged_by: context.userId },
            { onConflict: "case_id,topic" },
          );
        if (error) throw new Error(error.message);
      } else if (match.topic !== topic) {
        // Same topic, newer casing: keep one row, refresh the display spelling.
        const { error } = await db
          .from<{ id: string }>("case_topic_flags")
          .update({ topic })
          .eq("id", match.id);
        if (error) throw new Error(error.message);
      }
    } else if (match) {
      const { error } = await db
        .from<{ id: string }>("case_topic_flags")
        .delete()
        .eq("id", match.id);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
