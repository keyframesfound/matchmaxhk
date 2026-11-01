import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";

/**
 * Issue #545: Lifelong Academic Records & Education CV. All tables are
 * service-role only (RLS deny-all), so every read/write is scoped here:
 * users touch only records they own ("Myself") or that belong to a child
 * sub-profile they manage; tutor-facing reads require a real matched case.
 */

export type Db_ = Db;

export const RECORD_CATEGORIES = [
  "early_years",
  "primary",
  "secondary",
  "post_secondary",
  "extracurricular_award",
  "certification_language",
] as const;

export type RecordCategory = (typeof RECORD_CATEGORIES)[number];

export type AcademicRecord = {
  id: string;
  child_profile_id: string | null;
  category: RecordCategory;
  institution_or_issuer: string;
  title_or_program: string;
  curriculum_or_body: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
  grades_or_results: string | null;
  notes: string | null;
  visibility: "private" | "matched_tutors" | "public_tutor";
  updated_at: string;
};

export type LearnerSnapshot = {
  id: string | null;
  child_profile_id: string | null;
  current_level: string | null;
  strengths_text: string | null;
  weaknesses_text: string | null;
  target_goal_text: string | null;
  share_with_tutors: boolean;
};

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const yearish = z
  .number()
  .int()
  .min(1990)
  .max(2100)
  .nullish()
  .transform((v) => v ?? null);

const recordInput = z.object({
  childProfileId: z.string().uuid().nullish(),
  category: z.enum(RECORD_CATEGORIES),
  institutionOrIssuer: z.string().trim().min(1).max(120),
  titleOrProgram: z.string().trim().min(1).max(160),
  curriculumOrBody: optionalString(60),
  startYear: yearish,
  endYear: yearish,
  isCurrent: z.boolean().default(false),
  gradesOrResults: optionalString(300),
  notes: optionalString(300),
  visibility: z.enum(["private", "matched_tutors", "public_tutor"]).default("matched_tutors"),
});

const snapshotInput = z.object({
  childProfileId: z.string().uuid().nullish(),
  currentLevel: optionalString(60),
  strengthsText: optionalString(200),
  weaknessesText: optionalString(200),
  targetGoalText: optionalString(200),
  shareWithTutors: z.boolean().default(true),
});

type Row = Record<string, unknown>;

/**
 * Resolve the (owner, child) pair for a caller: `childProfileId === null`
 * means the caller's own "Myself" CV. A child id must belong to the caller
 * and still be parent-managed (claimed CVs belong to the child's account).
 */
async function resolveOwnership(
  db: Db,
  userId: string,
  childProfileId: string | null | undefined,
): Promise<{ ownerId: string; childId: string | null }> {
  if (!childProfileId) return { ownerId: userId, childId: null };
  const children = await selectRows<{
    id: string;
    parent_user_id: string;
    owner_user_id: string | null;
  }>(db, "students", "id, parent_user_id, owner_user_id", [
    { col: "id", op: "eq", value: childProfileId },
  ]);
  const child = children[0];
  if (!child || child.parent_user_id !== userId || child.owner_user_id) {
    throw new Error("NOT_YOUR_CHILD");
  }
  return { ownerId: userId, childId: child.id };
}

async function listRecords(
  db: Db,
  ownerId: string,
  childId: string | null,
): Promise<AcademicRecord[]> {
  const { data, error } = await db
    .from<AcademicRecord>("academic_records")
    .select(
      "id, child_profile_id, category, institution_or_issuer, title_or_program, curriculum_or_body, start_year, end_year, is_current, grades_or_results, notes, visibility, updated_at",
    )
    .eq("owner_user_id", ownerId)
    .eq("child_profile_id", childId)
    .order("start_year", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const getMyEducationCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ childProfileId: z.string().uuid().nullish() })
      .optional()
      .parse(input ?? {}),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ snapshot: LearnerSnapshot; records: AcademicRecord[] }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      const { ownerId, childId } = await resolveOwnership(db, context.userId, data?.childProfileId);

      const { data: snaps } = await db
        .from<LearnerSnapshot>("learner_snapshots")
        .select(
          "id, child_profile_id, current_level, strengths_text, weaknesses_text, target_goal_text, share_with_tutors",
        )
        .eq("owner_user_id", ownerId)
        .eq("child_profile_id", childId)
        .limit(1);
      const records = await listRecords(db, ownerId, childId);
      return {
        snapshot: snaps?.[0] ?? {
          id: null,
          child_profile_id: childId,
          current_level: null,
          strengths_text: null,
          weaknesses_text: null,
          target_goal_text: null,
          share_with_tutors: true,
        },
        records,
      };
    },
  );

export const saveLearnerSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => snapshotInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { ownerId, childId } = await resolveOwnership(db, context.userId, data.childProfileId);
    const now = new Date().toISOString();
    const fields = {
      owner_user_id: ownerId,
      child_profile_id: childId,
      current_level: data.currentLevel,
      strengths_text: data.strengthsText,
      weaknesses_text: data.weaknessesText,
      target_goal_text: data.targetGoalText,
      share_with_tutors: data.shareWithTutors,
      updated_at: now,
    };
    // Upsert by select-then-write: the (owner, child) uniqueness rides on the
    // expression index uq_learner_snapshot, which PostgREST's ON CONFLICT
    // column list cannot target.
    const { data: existing } = await db
      .from<{ id: string }>("learner_snapshots")
      .select("id")
      .eq("owner_user_id", ownerId)
      .eq("child_profile_id", childId)
      .limit(1);
    const write = async () => {
      if (existing && existing[0]) {
        const { error } = await db
          .from<Row>("learner_snapshots")
          .update(fields)
          .eq("id", existing[0].id);
        return error;
      }
      const { error } = await db.from<Row>("learner_snapshots").insert(fields);
      return error;
    };
    const writeError = await write();
    if (writeError && /duplicate|unique/i.test(writeError.message)) {
      // Race: another tab created the snapshot first — update instead.
      const { data: retry } = await db
        .from<{ id: string }>("learner_snapshots")
        .select("id")
        .eq("owner_user_id", ownerId)
        .eq("child_profile_id", childId)
        .limit(1);
      if (retry?.[0]) {
        const { error } = await db
          .from<Row>("learner_snapshots")
          .update(fields)
          .eq("id", retry[0].id);
        if (error) throw new Error(error.message);
        return { ok: true };
      }
    }
    if (writeError) throw new Error(writeError.message);
    return { ok: true };
  });

export const saveAcademicRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    recordInput.extend({ id: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { ownerId, childId } = await resolveOwnership(db, context.userId, data.childProfileId);
    const fields = {
      owner_user_id: ownerId,
      child_profile_id: childId,
      category: data.category,
      institution_or_issuer: data.institutionOrIssuer,
      title_or_program: data.titleOrProgram,
      curriculum_or_body: data.curriculumOrBody,
      start_year: data.startYear,
      end_year: data.endYear,
      is_current: data.isCurrent,
      grades_or_results: data.gradesOrResults,
      notes: data.notes,
      visibility: childId
        ? data.visibility === "public_tutor"
          ? "matched_tutors"
          : data.visibility
        : data.visibility,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      // Only the owning user may edit; claimed children lock parents out.
      const { data: owned } = await db
        .from<{ id: string }>("academic_records")
        .select("id")
        .eq("id", data.id)
        .eq("owner_user_id", ownerId)
        .eq("child_profile_id", childId)
        .limit(1);
      if ((owned ?? []).length === 0) throw new Error("RECORD_NOT_FOUND");
      const { error } = await db.from<Row>("academic_records").update(fields).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await db
      .from<Row>("academic_records")
      .insert(fields)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: String((inserted as { id: string }).id) };
  });

export const deleteAcademicRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    // Scope by owner: a parent manages their children's rows; a claimed
    // child's rows moved to the child's account and no longer match.
    const { data: rows } = await db
      .from<{ id: string; child_profile_id: string | null }>("academic_records")
      .select("id, child_profile_id")
      .eq("id", data.id)
      .eq("owner_user_id", context.userId)
      .limit(1);
    const row = rows?.[0];
    if (!row) throw new Error("RECORD_NOT_FOUND");
    if (row.child_profile_id) {
      await resolveOwnership(db, context.userId, row.child_profile_id);
    }
    const { error } = await db.from<Row>("academic_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Tutor/staff-facing read: the shared "Student Academic Snapshot" for a
 * case (#545 C3). Only surfaces the snapshot + timeline when the learner
 * (or their parent) has the share toggle on; record-level `private` rows
 * never leave this function.
 */
export const getCaseLearnerCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      allowed: boolean;
      nickname: string | null;
      snapshot: LearnerSnapshot | null;
      records: AcademicRecord[];
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);

      const cases = await selectRows<{
        id: string;
        parent_id: string | null;
        matched_tutor_id: string | null;
        concierge_id: string | null;
        student_id: string | null;
        who_for: string | null;
      }>(
        db,
        "tutoring_cases",
        "id, parent_id, matched_tutor_id, concierge_id, student_id, who_for",
        [{ col: "id", op: "eq", value: data.caseId }],
      );
      const c = cases[0];
      if (!c) throw new Error("CASE_NOT_FOUND");

      // Access: the matched tutor, the case's parent/owner, or staff.
      let isStaff = false;
      for (const role of ["staff", "admin", "super_admin"] as const) {
        const { data: ok } = await db.rpc("has_role", { _user_id: context.userId, _role: role });
        if (ok === true) isStaff = true;
      }
      let tutorUserId: string | null = null;
      if (c.matched_tutor_id) {
        const tutors = await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
          { col: "id", op: "eq", value: c.matched_tutor_id },
        ]);
        tutorUserId = tutors[0]?.user_id ?? null;
      }
      const isParty =
        context.userId === c.parent_id ||
        context.userId === tutorUserId ||
        context.userId === c.concierge_id;
      if (!isParty && !isStaff)
        return { allowed: false, nickname: null, snapshot: null, records: [] };

      // Resolve the learner: a linked child sub-profile, or the requester's
      // own "Myself" CV for independent-student / myself cases.
      let ownerId: string | null = null;
      let childId: string | null = null;
      let nickname: string | null = null;
      if (c.student_id) {
        const students = await selectRows<{
          id: string;
          parent_user_id: string;
          owner_user_id: string | null;
          nickname: string;
        }>(db, "students", "id, parent_user_id, owner_user_id, nickname", [
          { col: "id", op: "eq", value: c.student_id },
        ]);
        const s = students[0];
        if (s) {
          // Claimed child: the CV owner is the child's account.
          ownerId = s.owner_user_id ?? s.parent_user_id;
          childId = s.owner_user_id ? null : s.id;
          nickname = s.nickname;
        }
      } else if (c.parent_id) {
        ownerId = c.parent_id;
        childId = null;
      }
      if (!ownerId) return { allowed: true, nickname: null, snapshot: null, records: [] };

      const { data: snaps } = await db
        .from<LearnerSnapshot>("learner_snapshots")
        .select(
          "id, child_profile_id, current_level, strengths_text, weaknesses_text, target_goal_text, share_with_tutors",
        )
        .eq("owner_user_id", ownerId)
        .eq("child_profile_id", childId)
        .limit(1);
      const snapshot = snaps?.[0] ?? null;
      if (!snapshot || !snapshot.share_with_tutors) {
        return { allowed: true, nickname, snapshot: null, records: [] };
      }
      const all = await listRecords(db, ownerId, childId);
      return {
        allowed: true,
        nickname,
        snapshot,
        records: all.filter((r) => r.visibility !== "private"),
      };
    },
  );

/**
 * /en/join prefill (#545 A4): self-owned records populate the tutor
 * education step so applicants never re-type their academic history.
 */
export const getJoinEducationPrefill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AcademicRecord[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    return listRecords(db, context.userId, null);
  });
