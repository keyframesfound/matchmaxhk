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
  type AssessmentCategory,
  type AssessmentScore,
} from "@/features/cases/case-progress";
import { homeworkTextError } from "@/features/cases/homework";

const ENDED_STATUSES = new Set(["closed", "replaced"]);

export type AssessmentEntry = AssessmentScore & {
  id: string;
  name: string;
  category: AssessmentCategory;
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
};

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

export const getCaseProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseProgress> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await partyCase(db, data.caseId, context.userId);
    const [rows, targets] = await Promise.all([
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
        [{ col: "case_id", op: "eq", value: c.id }],
      ),
      selectRows<{ target_pct: number | null; target_grade: string | null }>(
        db,
        "case_demand_side",
        "target_pct, target_grade",
        [{ col: "case_id", op: "eq", value: c.id }],
      ),
    ]);
    return {
      role,
      readOnly: c.sor_status !== null && ENDED_STATUSES.has(c.sor_status),
      targetPct: targets[0]?.target_pct ?? null,
      targetGrade: targets[0]?.target_grade || null,
      scores: rows.map((r) => ({
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
        mine: r.created_by === context.userId,
      })),
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
