/**
 * Issue #653: Progress & Grades, server half. Every call goes through partyCase,
 * so only the case's tutor and parent can read or log scores. Setting a target
 * writes through to the #637 Demand-Side row. Ended cases are read-only.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db, type Row } from "@/features/cases/desk-db";
import { partyCase, type PartyRole } from "@/features/cases/case-schedule.functions";
import { seededDemandRow } from "@/features/cases/demand-side/demand-side.functions";
import {
  ASSESSMENT_CATEGORIES,
  ASSESSMENT_NAME_MAX,
  ASSESSMENT_NOTE_MAX,
  GRADE_LABEL_MAX,
  TARGET_GRADE_MAX,
  assessmentError,
  cumulativeHours,
  homeworkScoreEntries,
  sortAssessments,
  type AssessmentCategory,
  type AssessmentScore,
  type GradebookCategory,
  type HoursPoint,
} from "@/features/cases/case-progress";
import { homeworkTextError, isUndefinedColumn } from "@/features/cases/homework";

const ENDED_STATUSES = new Set(["closed", "replaced"]);

export type AssessmentEntry = AssessmentScore & {
  id: string;
  name: string;
  category: GradebookCategory;
  gradeLabel: string | null;
  note: string | null;
  /** The signed-in user logged this one, so they may remove it. */
  mine: boolean;
};

export type CaseProgress = {
  role: PartyRole;
  readOnly: boolean;
  targetPct: number | null;
  targetGrade: string | null;
  scores: AssessmentEntry[];
  /** #736: sum of verified_completed ledger hours on the case. */
  verifiedHours: number;
  /** #736: running verified hours by log date, oldest first. */
  hoursSeries: HoursPoint[];
};

/** #736: Ops sees the same graph read-only, without being a party of the case. */
export type StaffCaseProgress = Omit<CaseProgress, "role"> & { role: "staff" };

function assertCleanText(...texts: (string | undefined)[]): void {
  if (texts.some((text) => homeworkTextError(text))) throw new Error("CONTACT_DETAILS");
}

async function writableParty(db: Db, caseId: string, userId: string) {
  const party = await partyCase(db, caseId, userId);
  if (party.c.sor_status && ENDED_STATUSES.has(party.c.sor_status)) {
    throw new Error("CASE_ENDED");
  }
  return party;
}

/** admin / super_admin / staff, the same has_role gate the desk fns use. */
async function requireStaff(db: Db, userId: string): Promise<void> {
  for (const role of ["admin", "super_admin", "staff"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

type ProgressRead = Pick<
  CaseProgress,
  "targetPct" | "targetGrade" | "scores" | "verifiedHours" | "hoursSeries"
>;

/**
 * #653/#736: the one read behind both the party tab and the staff panel, so
 * the graph cannot disagree with itself.
 */
async function readProgress(db: Db, caseId: string, viewerId: string): Promise<ProgressRead> {
  const [rows, targets, hours, homework] = await Promise.all([
    selectRows<{
      id: string;
      name: string;
      assessed_on: string;
      category: AssessmentCategory;
      marks: number | string;
      max_marks: number | string;
      grade_label: string | null;
      note: string | null;
      created_by: string;
      created_at: string;
    }>(
      db,
      "case_assessments",
      "id, name, assessed_on, category, marks, max_marks, grade_label, note, created_by, created_at",
      [{ col: "case_id", op: "eq", value: caseId }],
    ),
    selectRows<{ target_pct: number | null; target_grade: string | null }>(
      db,
      "case_demand_side",
      "target_pct, target_grade",
      [{ col: "case_id", op: "eq", value: caseId }],
    ),
    // #736: the verified hours log, oldest first, so the running total is a scan.
    selectRows<{ occurred_at: string; duration_hours: number | string }>(
      db,
      "verified_hours_ledger",
      "occurred_at, duration_hours",
      [
        { col: "case_id", op: "eq", value: caseId },
        { col: "status", op: "eq", value: "verified_completed" },
      ],
      { col: "occurred_at", asc: true },
    ),
    // #736 AC1: reviewed, scored homework joins the same gradebook. Deploy
    // safety: before the score migration lands this column does not exist, so
    // the tab renders without homework points instead of failing.
    selectRows<{ id: string; title: string; reviewed_at: string | null; score_pct: number | null }>(
      db,
      "case_homework",
      "id, title, reviewed_at, score_pct",
      [{ col: "case_id", op: "eq", value: caseId }],
    ).catch((error: unknown) => {
      if (isUndefinedColumn(error)) return [];
      throw error;
    }),
  ]);
  const hoursSeries = cumulativeHours(
    hours.map((r) => ({ occurredOn: r.occurred_at.slice(0, 10), hours: Number(r.duration_hours) })),
  );
  const homeworkPoints = homeworkScoreEntries(
    homework.flatMap((r) =>
      r.reviewed_at === null || r.score_pct === null
        ? []
        : [
            {
              id: r.id,
              title: r.title,
              reviewedAt: r.reviewed_at,
              scorePct: Number(r.score_pct),
            },
          ],
    ),
  );
  return {
    targetPct: targets[0]?.target_pct ?? null,
    targetGrade: targets[0]?.target_grade || null,
    // Ascending date order, so the log and the chart read the same list.
    scores: sortAssessments([
      ...rows.map((r) => ({
        id: r.id,
        name: r.name,
        assessedOn: r.assessed_on,
        category: r.category,
        // numeric columns come back from PostgREST as numbers or strings.
        marks: Number(r.marks),
        maxMarks: Number(r.max_marks),
        gradeLabel: r.grade_label,
        note: r.note,
        createdAt: r.created_at,
        mine: r.created_by === viewerId,
        source: "assessment" as const,
      })),
      ...homeworkPoints.map((p) => ({
        id: p.id,
        name: p.name,
        assessedOn: p.assessedOn,
        category: "homework" as const,
        marks: p.marks,
        maxMarks: p.maxMarks,
        gradeLabel: null,
        note: null,
        createdAt: p.createdAt,
        mine: false,
        source: p.source,
      })),
    ]),
    verifiedHours:
      hoursSeries.length === 0 ? 0 : hoursSeries[hoursSeries.length - 1].cumulativeHours,
    hoursSeries,
  };
}

export const getCaseProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseProgress> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await partyCase(db, data.caseId, context.userId);
    return {
      role,
      readOnly: c.sor_status !== null && ENDED_STATUSES.has(c.sor_status),
      ...(await readProgress(db, c.id, context.userId)),
    };
  });

/**
 * #736: the Admin Case Management read of the same graph. Ops is not a party
 * of the case, so this gates on has_role instead of partyCase, and it never
 * writes: readOnly is always true.
 */
export const getCaseProgressForStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<StaffCaseProgress> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireStaff(db, context.userId);
    const cases = await selectRows<{ id: string }>(db, "tutoring_cases", "id", [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    if (!cases[0]) throw new Error("CASE_NOT_FOUND");
    return {
      role: "staff",
      readOnly: true,
      ...(await readProgress(db, cases[0].id, context.userId)),
    };
  });

export const logAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        name: z.string().trim().min(1).max(ASSESSMENT_NAME_MAX),
        assessedOn: z.string(),
        category: z.enum(ASSESSMENT_CATEGORIES),
        marks: z.number(),
        maxMarks: z.number(),
        gradeLabel: z.string().trim().max(GRADE_LABEL_MAX).optional(),
        note: z.string().trim().max(ASSESSMENT_NOTE_MAX).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c } = await writableParty(db, data.caseId, context.userId);
    const error = assessmentError({ ...data, now: new Date() });
    if (error) throw new Error(error);
    assertCleanText(data.name, data.gradeLabel, data.note);
    const { data: row, error: insertError } = await db
      .from<Row>("case_assessments")
      .insert({
        case_id: c.id,
        name: data.name,
        assessed_on: data.assessedOn,
        category: data.category,
        marks: data.marks,
        max_marks: data.maxMarks,
        grade_label: data.gradeLabel || null,
        note: data.note || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);
    return { id: String((row as { id: string }).id) };
  });

export const deleteAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid(), assessmentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<void> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c } = await writableParty(db, data.caseId, context.userId);
    const { error } = await db
      .from<Row>("case_assessments")
      .delete()
      .eq("id", data.assessmentId)
      .eq("case_id", c.id)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);
  });

/** Writes through to the #637 row, the one source for the target. */
export const setProgressTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        targetPct: z.number().int().min(0).max(100),
        targetGrade: z.string().trim().max(TARGET_GRADE_MAX).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ targetPct: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c } = await writableParty(db, data.caseId, context.userId);
    assertCleanText(data.targetGrade);
    // Omitted grade keeps the current one; an empty string clears it.
    const target = {
      target_pct: data.targetPct,
      ...(data.targetGrade === undefined ? {} : { target_grade: data.targetGrade }),
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const existing = await selectRows<{ case_id: string }>(db, "case_demand_side", "case_id", [
      { col: "case_id", op: "eq", value: c.id },
    ]);
    // The #637 panel only seeds while no row exists, so a first write carries the seed.
    const seed = existing[0] ? {} : await seededDemandRow(db, c.id);
    const { error } = await db
      .from<Row>("case_demand_side")
      .upsert({ case_id: c.id, ...seed, ...target }, { onConflict: "case_id" });
    if (error) throw new Error(error.message);
    return { targetPct: data.targetPct };
  });
