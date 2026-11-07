/**
 * Issue #637: Party Case Hub read/write for Demand-Side self-info. Every read and
 * write re-checks party access server-side; public surfaces never call these.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { emitActionEvent } from "@/features/cases/action-required.functions";
import {
  buildHouseholdRows,
  demandSideAccess,
  FEEDBACK_STYLES,
  LANGUAGE_MEDIUMS,
  LEARNING_STYLES,
  PRIMARY_GOALS,
  sanitizeDemandSide,
  seedDemandSide,
  type DemandSide,
  type DemandSideAccess,
  type HouseholdDefaults,
  type HouseholdRow,
} from "@/features/cases/demand-side/demand-side";

type CaseParties = {
  id: string;
  case_code: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
  description: string | null;
  language_of_instruction: string | null;
  student_grade_current: string | null;
  created_at: string;
};

type DemandRow = {
  primary_goal: string | null;
  language_medium: string | null;
  household_notes: string;
  feedback_style: string | null;
  current_level: string;
  target_grade: string;
  weak_topics: string[] | null;
  learning_styles: string[] | null;
  updated_by: string | null;
  updated_at: string;
};

const DEMAND_COLUMNS =
  "primary_goal, language_medium, household_notes, feedback_style, current_level, target_grade, weak_topics, learning_styles, updated_by, updated_at";

async function isAdminUser(db: Db, userId: string): Promise<boolean> {
  for (const role of ["admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

async function loadAccess(
  db: Db,
  caseId: string,
  userId: string,
): Promise<{ c: CaseParties; access: DemandSideAccess } | null> {
  const cases = await selectRows<CaseParties>(
    db,
    "tutoring_cases",
    "id, case_code, parent_id, student_id, matched_tutor_id, description, language_of_instruction, student_grade_current, created_at",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const c = cases[0];
  if (!c) return null;
  const students = c.student_id
    ? await selectRows<{ owner_user_id: string | null }>(db, "students", "owner_user_id", [
        { col: "id", op: "eq", value: c.student_id },
      ])
    : [];
  const tutors = c.matched_tutor_id
    ? await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
        { col: "id", op: "eq", value: c.matched_tutor_id },
      ])
    : [];
  return {
    c,
    access: demandSideAccess({
      userId,
      isAdmin: await isAdminUser(db, userId),
      parentId: c.parent_id,
      studentOwnerId: students[0]?.owner_user_id ?? null,
      tutorUserId: tutors[0]?.user_id ?? null,
    }),
  };
}

export type DemandSideState = {
  access: Exclude<DemandSideAccess, null>;
  values: DemandSide;
  updatedAt: string | null;
  updatedByName: string | null;
};

const fromRow = (row: DemandRow): DemandSide => ({
  primaryGoal: row.primary_goal,
  languageMedium: row.language_medium,
  householdNotes: row.household_notes,
  feedbackStyle: row.feedback_style,
  currentLevel: row.current_level,
  targetGrade: row.target_grade,
  weakTopics: row.weak_topics ?? [],
  learningStyles: row.learning_styles ?? [],
});

async function parentDefaults(db: Db, parentId: string | null): Promise<HouseholdDefaults | null> {
  if (!parentId) return null;
  const rows = await selectRows<{ defaults: HouseholdDefaults }>(
    db,
    "household_defaults",
    "defaults",
    [{ col: "user_id", op: "eq", value: parentId }],
  );
  return rows[0]?.defaults ?? null;
}

export const getCaseDemandSide = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<DemandSideState | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const loaded = await loadAccess(db, data.caseId, context.userId);
    if (!loaded?.access) return null;
    const rows = await selectRows<DemandRow>(db, "case_demand_side", DEMAND_COLUMNS, [
      { col: "case_id", op: "eq", value: data.caseId },
    ]);
    const row = rows[0];
    if (!row) {
      const { c } = loaded;
      return {
        access: loaded.access,
        values: seedDemandSide(
          {
            description: c.description,
            languageOfInstruction: c.language_of_instruction,
            gradeCurrent: c.student_grade_current,
            createdAt: c.created_at,
          },
          await parentDefaults(db, c.parent_id),
        ),
        updatedAt: null,
        updatedByName: null,
      };
    }
    const editors = row.updated_by
      ? await selectRows<{ display_name: string | null }>(db, "profiles", "display_name", [
          { col: "id", op: "eq", value: row.updated_by },
        ])
      : [];
    return {
      access: loaded.access,
      values: fromRow(row),
      updatedAt: row.updated_at,
      updatedByName: editors[0]?.display_name ?? null,
    };
  });

const SaveSchema = z.object({
  caseId: z.string().uuid(),
  saveAsDefault: z.boolean(),
  values: z.object({
    primaryGoal: z.enum(PRIMARY_GOALS).nullable(),
    languageMedium: z.enum(LANGUAGE_MEDIUMS).nullable(),
    householdNotes: z.string().max(2000),
    feedbackStyle: z.enum(FEEDBACK_STYLES).nullable(),
    currentLevel: z.string().max(100),
    targetGrade: z.string().max(100),
    weakTopics: z.array(z.string().max(200)).max(40),
    learningStyles: z.array(z.enum(LEARNING_STYLES)).max(LEARNING_STYLES.length),
  }),
});

export const saveCaseDemandSide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ context, data }): Promise<void> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const loaded = await loadAccess(db, data.caseId, context.userId);
    if (loaded?.access !== "edit") throw new Error("You can't edit this case's notes.");
    const values = sanitizeDemandSide(data.values);
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("case_demand_side" as never).upsert(
      {
        case_id: data.caseId,
        primary_goal: values.primaryGoal,
        language_medium: values.languageMedium,
        household_notes: values.householdNotes,
        feedback_style: values.feedbackStyle,
        current_level: values.currentLevel,
        target_grade: values.targetGrade,
        weak_topics: values.weakTopics,
        learning_styles: values.learningStyles,
        updated_by: context.userId,
        updated_at: now,
      } as never,
      { onConflict: "case_id" },
    );
    if (error) throw new Error(error.message);

    // Only the parent's own saved notes seed their later cases. Never public.
    if (data.saveAsDefault && loaded.c.parent_id === context.userId) {
      const defaults: HouseholdDefaults = {
        savedAt: now,
        primaryGoal: values.primaryGoal,
        languageMedium: values.languageMedium,
        householdNotes: values.householdNotes,
        feedbackStyle: values.feedbackStyle,
      };
      const { error: defaultsError } = await supabaseAdmin
        .from("household_defaults" as never)
        .upsert({ user_id: context.userId, defaults, updated_at: now } as never, {
          onConflict: "user_id",
        });
      if (defaultsError) throw new Error(defaultsError.message);
    }

    const { c } = loaded;
    if (c.matched_tutor_id) {
      await emitActionEvent(
        db,
        "case.demand_side_updated",
        { case_id: c.id, case_code: c.case_code, tutor_id: c.matched_tutor_id },
        null,
      );
    }
  });

/** Household summary across the caller's own running cases. */
export const getMyHouseholdSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HouseholdRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const cases = await selectRows<{
      id: string;
      case_code: string;
      sor_status: string | null;
      subjects: string[] | null;
      student_id: string | null;
      learner_nickname: string | null;
      matched_tutor_id: string | null;
    }>(
      db,
      "tutoring_cases",
      "id, case_code, sor_status, subjects, student_id, learner_nickname, matched_tutor_id",
      [{ col: "parent_id", op: "eq", value: context.userId }],
    );
    const running = cases.filter((c) => c.sor_status !== null);
    if (running.length === 0) return [];
    const ids = running.map((c) => c.id);
    const inIds = (list: (string | null)[]) => [...new Set(list.flatMap((v) => v ?? []))];
    const studentIds = inIds(running.map((c) => c.student_id));
    const tutorIds = inIds(running.map((c) => c.matched_tutor_id));
    const [lessons, demand, students, tutors] = await Promise.all([
      selectRows<{ case_id: string; starts_at: string; status: string }>(
        db,
        "case_lessons",
        "case_id, starts_at, status",
        [{ col: "case_id", op: "in", value: ids }],
      ),
      selectRows<{ case_id: string; primary_goal: string | null; target_grade: string | null }>(
        db,
        "case_demand_side",
        "case_id, primary_goal, target_grade",
        [{ col: "case_id", op: "in", value: ids }],
      ),
      studentIds.length
        ? selectRows<{ id: string; display_name: string | null }>(
            db,
            "students",
            "id, display_name",
            [{ col: "id", op: "in", value: studentIds }],
          )
        : Promise.resolve([]),
      tutorIds.length
        ? selectRows<{ id: string; display_name: string | null; tutor_code: string | null }>(
            db,
            "tutors",
            "id, display_name, tutor_code",
            [{ col: "id", op: "in", value: tutorIds }],
          )
        : Promise.resolve([]),
    ]);
    const demandById = new Map(demand.map((row) => [row.case_id, row]));
    const studentById = new Map(students.map((row) => [row.id, row.display_name]));
    const tutorById = new Map(tutors.map((row) => [row.id, row.display_name || row.tutor_code]));
    return buildHouseholdRows(
      running.map((c) => ({
        caseId: c.id,
        caseCode: c.case_code,
        sorStatus: c.sor_status,
        studentName: (c.student_id && studentById.get(c.student_id)) || c.learner_nickname,
        subject: (c.subjects ?? [])[0] ?? "",
        tutorName: c.matched_tutor_id ? (tutorById.get(c.matched_tutor_id) ?? null) : null,
        primaryGoal: demandById.get(c.id)?.primary_goal ?? null,
        targetGrade: demandById.get(c.id)?.target_grade || null,
        lessons: lessons
          .filter((lesson) => lesson.case_id === c.id)
          .map((lesson) => ({ startsAt: lesson.starts_at, status: lesson.status })),
      })),
      new Date(),
    );
  });
