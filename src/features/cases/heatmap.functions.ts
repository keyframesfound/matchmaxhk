/**
 * Issue #796 §2.1 — Syllabus Topic Mastery Heatmap, server half.
 *
 * Reads every #767 Super-Drawer log for a case, folds the topics together with
 * the #796 §2.2 mistake book's unresolved topic tags (heatmap-logic.ts does the
 * folding), and overlays the parent/student "flag for help" rows from
 * `case_topic_flags` (20261122100000_issue_796_topic_heatmap.sql).
 *
 * Every call re-checks the caller against the case before reading, and the flag
 * write allows only the parent or the student owner. Both run on the service
 * role; the table's revoked grants make the server fn the only door.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import {
  buildTopicCells,
  heatmapTopicKey,
  normalizeHeatmapTag,
  parseDrawerTopics,
  type HeatmapSummary,
} from "@/features/cases/heatmap-logic";
import type { DrawerLogRow, MasteryLevel } from "@/features/cases/super-drawer/super-drawer-logic";

/**
 * Newest N drawer logs are enough for a per-case heatmap. Keeps the read bounded
 * on a long-running case without changing the fold (newest still wins).
 */
const MAX_LOGS = 500;
const MAX_MISTAKES = 1000;

type CaseRow = {
  id: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
};

type HeatmapRole = "ops" | "learner" | "tutor";

type HeatmapAccess = {
  kase: CaseRow;
  role: HeatmapRole;
};

export type CaseHeatmapCell = {
  tag: string;
  mastery: MasteryLevel | null;
  sightings: number;
  weakByMistakes: boolean;
  flagged: boolean;
};

export type CaseHeatmap = {
  canEdit: boolean;
  canFlag: boolean;
  summary: HeatmapSummary;
  cells: CaseHeatmapCell[];
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

    return {
      // Only the matched tutor (or Ops) can write mastery via the drawer.
      canEdit: access.role === "tutor" || access.role === "ops",
      // "Flag for help" is a parent/student signal — never the tutor or Ops.
      canFlag: access.role === "learner",
      summary,
      cells: cells.map((cell) => ({
        tag: cell.tag,
        mastery: cell.mastery,
        sightings: cell.sightings,
        weakByMistakes: cell.weakByMistakes,
        flagged: flaggedKeys.has(heatmapTopicKey(cell.tag)),
      })),
    };
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
