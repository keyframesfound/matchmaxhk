/**
 * Issue #796 §2.4 (was #733) — private lesson usefulness pulse, server half.
 *
 * The parent or the student owner answers a one-tap pulse at verified-lesson
 * milestones (5, 10, 15, …) on their own case. The rows never touch
 * `case_reviews`, never publish, and are readable only by Ops:
 *
 *  - a learner (parent or student owner) reads only their OWN due-milestone row;
 *  - a tutor is denied on every path — the read returns null (so "exists" and
 *    "forbidden" are indistinguishable), the write throws, and the Ops list
 *    returns null;
 *  - Ops sees the case list but never an `account_id`.
 *
 * Every call runs on the service role through `asAdminDb`, so the table's
 * revoked grants make these server fns the only door.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db, type Row } from "@/features/cases/desk-db";
import { completedLessonCount } from "@/features/cases/rating-window";
import type { LessonConfirmRow } from "@/features/cases/case-reviews";
import {
  PULSE_VERDICTS,
  duePulseMilestone,
  isPulseVerdict,
  sanitizePulseTags,
  type PulseTag,
  type PulseVerdict,
} from "@/features/cases/usefulness-pulse-logic";

type CaseRow = {
  id: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
};

type PulseRole = "ops" | "learner" | "tutor";

type PulseAccess = {
  kase: CaseRow;
  role: PulseRole;
};

export type UsefulnessPulseAnswer = {
  verdict: PulseVerdict;
  tags: PulseTag[];
  createdAt: string;
};

export type MyUsefulnessPulse = {
  dueMilestone: number | null;
  /** The row for the due milestone only — the card hides once answered. */
  answered: UsefulnessPulseAnswer | null;
};

export type CaseUsefulnessPulseRow = {
  id: string;
  respondentRole: "parent" | "student";
  milestoneLesson: number;
  verdict: PulseVerdict;
  tags: string[];
  flaggedForOps: boolean;
  createdAt: string;
};

type PulseDbRow = {
  id: string;
  respondent_role: string;
  milestone_lesson: number;
  verdict: string;
  tags: string[] | null;
  flagged_for_ops: boolean;
  created_at: string;
};

type MyPulseDbRow = {
  verdict: string;
  tags: string[] | null;
  created_at: string;
};

const PULSE_COLUMNS =
  "id, respondent_role, milestone_lesson, verdict, tags, flagged_for_ops, created_at";

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
 * Resolve the caller against the case. null = not a party, so an unrelated
 * tutor can never tell "exists" from "forbidden".
 */
async function loadAccess(db: Db, caseId: string, userId: string): Promise<PulseAccess | null> {
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

/** Verified-lesson count, via the one rating counter (no second definition). */
async function verifiedLessons(db: Db, caseId: string): Promise<number> {
  const lessons = await selectRows<LessonConfirmRow>(
    db,
    "case_lessons",
    "status, confirmed_by_parent_at, confirmed_by_tutor_at",
    [{ col: "case_id", op: "eq", value: caseId }],
  );
  return completedLessonCount(lessons);
}

export const getMyUsefulnessPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<MyUsefulnessPulse | null> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    // Ops and tutors get null, exactly like a non-party: nothing leaks.
    if (!access || access.role !== "learner") return null;

    const dueMilestone = duePulseMilestone(await verifiedLessons(db, data.caseId));
    if (dueMilestone === null) return { dueMilestone: null, answered: null };

    const rows = await selectRows<MyPulseDbRow>(
      db,
      "case_usefulness_pulses",
      "verdict, tags, created_at",
      [
        { col: "case_id", op: "eq", value: data.caseId },
        { col: "account_id", op: "eq", value: context.userId },
        { col: "milestone_lesson", op: "eq", value: dueMilestone },
      ],
      { col: "created_at", asc: false, limit: 1 },
    );
    const row = rows[0];
    return {
      dueMilestone,
      answered:
        row && isPulseVerdict(row.verdict)
          ? {
              verdict: row.verdict,
              tags: sanitizePulseTags(row.tags),
              createdAt: row.created_at,
            }
          : null,
    };
  });

export const submitUsefulnessPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        verdict: z.enum(PULSE_VERDICTS),
        tags: z.array(z.string()).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    // Ops and the matched tutor can never write a pulse: FORBIDDEN either way.
    if (!access || access.role !== "learner") throw new Error("FORBIDDEN");

    const milestone = duePulseMilestone(await verifiedLessons(db, data.caseId));
    if (milestone === null) throw new Error("NOT_DUE");

    // One row per account per milestone: never overwrite, never touch another
    // account's row.
    const existing = await selectRows<{ id: string }>(db, "case_usefulness_pulses", "id", [
      { col: "case_id", op: "eq", value: data.caseId },
      { col: "account_id", op: "eq", value: context.userId },
      { col: "milestone_lesson", op: "eq", value: milestone },
    ]);
    if (existing.length > 0) throw new Error("ALREADY_ANSWERED");

    // Parent wins when one account is both parent and student owner.
    const respondentRole = access.kase.parent_id === context.userId ? "parent" : "student";

    const row: Row = {
      case_id: data.caseId,
      account_id: context.userId,
      respondent_role: respondentRole,
      milestone_lesson: milestone,
      verdict: data.verdict,
      tags: sanitizePulseTags(data.tags),
    };
    const { error } = await db
      .from<Row>("case_usefulness_pulses")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      // Lost a race against the unique (case, account, milestone) constraint.
      if (error.code === "23505") throw new Error("ALREADY_ANSWERED");
      throw new Error(error.message);
    }

    return { ok: true };
  });

export const listCaseUsefulnessPulses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseUsefulnessPulseRow[] | null> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    // Ops only: the learner and the tutor both get null here.
    if (!access || access.role !== "ops") return null;

    const rows = await selectRows<PulseDbRow>(
      db,
      "case_usefulness_pulses",
      PULSE_COLUMNS,
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "created_at", asc: false },
    );
    // account_id is never selected, so it can never be returned.
    const out: CaseUsefulnessPulseRow[] = [];
    for (const row of rows) {
      if (!isPulseVerdict(row.verdict)) continue;
      out.push({
        id: row.id,
        respondentRole: row.respondent_role === "parent" ? "parent" : "student",
        milestoneLesson: row.milestone_lesson,
        verdict: row.verdict,
        tags: sanitizePulseTags(row.tags),
        flaggedForOps: row.flagged_for_ops === true,
        createdAt: row.created_at,
      });
    }
    return out;
  });
