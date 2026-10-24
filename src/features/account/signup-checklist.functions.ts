import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";

/**
 * Issue #141: post-signup checklist server functions. One read path computes
 * the account's role and ticks each step live from the DB (so the checklist
 * can never lie about state the account already has), then merges the
 * account_checklist row's stored completed_steps overrides and dismissal.
 * Dismissal is the only write. account_checklist is owner-only by RLS, but
 * the reads here walk several owner-owned tables in one call, so everything
 * runs through the service-role client scoped to context.userId, the same
 * convention as the notes/checkout server functions.
 */

type DbError = { message: string } | null;

/**
 * Structural client type for the tables this file touches (Rows<T> pattern
 * from storage-helpers, extended with head-count and upsert-free writes).
 */
type ChecklistRows<T> = {
  eq: (col: string, value: unknown) => ChecklistRows<T>;
  limit: (n: number) => ChecklistRows<T>;
  maybeSingle: () => Promise<{
    data: T | null;
    error: DbError;
    count?: number | null;
  }>;
} & PromiseLike<{ data: T[] | null; error: DbError; count?: number | null }>;

type ChecklistTable<T> = {
  select: (
    cols: string,
    opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
  ) => ChecklistRows<T>;
  insert: (row: unknown) => PromiseLike<{ error: DbError }>;
  update: (row: unknown) => {
    eq: (col: string, value: unknown) => Promise<{ error: DbError }>;
  };
};

type ChecklistDb = { from: <T>(table: string) => ChecklistTable<T> };

export const CHECKLIST_STEP_IDS = [
  "tutor_card",
  "tutor_verify",
  "tutor_capacity",
  "tutor_listing",
  "parent_save",
  "parent_case",
  "parent_bought",
] as const;

export type ChecklistStepId = (typeof CHECKLIST_STEP_IDS)[number];

export type ChecklistRole = "tutor" | "parent";

export type ChecklistStep = { id: ChecklistStepId; done: boolean };

export type SignupChecklist = {
  role: ChecklistRole;
  dismissedAt: string | null;
  steps: ChecklistStep[];
};

/** A slice of the tutors row that decides role + live tutor steps. */
type TutorRoleRow = {
  id: string;
  display_name: string;
  subjects: string[] | null;
  self_introduction: string | null;
  hourly_rate: number;
  verification_tier: string | null;
  is_accepting_students: boolean | null;
  remaining_student_slots: number | null;
};

type ChecklistStateRow = {
  completed_steps: string[];
  dismissed_at: string | null;
};

/**
 * Stored completed_steps are overrides: once a step has been recorded as
 * done it stays done even if the live data moves (e.g. an admin resets a
 * field). Extracted pure for tests.
 */
export function mergeChecklistSteps(
  live: ChecklistStep[],
  storedCompleted: string[],
): ChecklistStep[] {
  const stored = new Set(storedCompleted);
  return live.map((step) => ({ id: step.id, done: step.done || stored.has(step.id) }));
}

/**
 * "Complete your card" = the four fields a parent actually reads: name,
 * subjects, intro, rate. Extracted pure for tests.
 */
export function tutorCardIsComplete(tutor: TutorRoleRow): boolean {
  return (
    tutor.display_name.trim().length > 0 &&
    (tutor.subjects ?? []).length > 0 &&
    (tutor.self_introduction ?? "").trim().length > 0 &&
    tutor.hourly_rate > 0
  );
}

async function countOwnedRows(
  db: ChecklistDb,
  table: string,
  column: string,
  userId: string,
): Promise<number> {
  const { count, error } = await db
    .from<unknown>(table)
    .select(column, { count: "exact", head: true })
    .eq(column, userId);
  if (error) throw new Error(error.message || `Failed to read ${table}`);
  return count ?? 0;
}

/** Tutor steps, in the order the issue lists them (≤5 items). */
async function tutorChecklistSteps(db: ChecklistDb, tutor: TutorRoleRow): Promise<ChecklistStep[]> {
  const { data: material, error } = await db
    .from<{ id: string }>("digital_materials")
    .select("id")
    .eq("tutor_id", tutor.id)
    .limit(1);
  if (error) throw new Error(error.message || "Failed to read materials");

  return [
    { id: "tutor_card", done: tutorCardIsComplete(tutor) },
    // Verification is admin-entry: verification_tier only moves to
    // tier_2_verified once staff have processed the documents, so "verified"
    // is the only honest completion signal the tutors row carries.
    { id: "tutor_verify", done: tutor.verification_tier === "tier_2_verified" },
    {
      id: "tutor_capacity",
      done: (tutor.is_accepting_students ?? false) && (tutor.remaining_student_slots ?? 0) > 0,
    },
    { id: "tutor_listing", done: (material?.length ?? 0) > 0 },
  ];
}

/** Parent steps: save tutors → request a tutor → bought notes. */
async function parentChecklistSteps(db: ChecklistDb, userId: string): Promise<ChecklistStep[]> {
  const [saved, cases, bought] = await Promise.all([
    countOwnedRows(db, "saved_tutors", "user_id", userId),
    countOwnedRows(db, "tutoring_cases", "parent_id", userId),
    countOwnedRows(db, "material_orders", "buyer_account_id", userId),
  ]);
  return [
    { id: "parent_save", done: saved > 0 },
    { id: "parent_case", done: cases > 0 },
    { id: "parent_bought", done: bought > 0 },
  ];
}

/**
 * The single Account-load read: role, live-ticked steps, stored overrides
 * and dismissal, one server roundtrip for the whole checklist.
 */
export const getSignupChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignupChecklist> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin) as unknown as ChecklistDb;

    const [tutorRes, stateRes] = await Promise.all([
      db
        .from<TutorRoleRow>("tutors")
        .select(
          "id, display_name, subjects, self_introduction, hourly_rate, verification_tier, is_accepting_students, remaining_student_slots",
        )
        .eq("user_id", context.userId)
        .maybeSingle(),
      db
        .from<ChecklistStateRow>("account_checklist")
        .select("completed_steps, dismissed_at")
        .eq("account_id", context.userId)
        .maybeSingle(),
    ]);
    if (tutorRes.error) throw new Error(tutorRes.error.message || "Failed to load checklist");
    if (stateRes.error) throw new Error(stateRes.error.message || "Failed to load checklist");

    const tutor = tutorRes.data;
    const live = tutor
      ? await tutorChecklistSteps(db, tutor)
      : await parentChecklistSteps(db, context.userId);

    return {
      role: tutor ? "tutor" : "parent",
      dismissedAt: stateRes.data?.dismissed_at ?? null,
      steps: mergeChecklistSteps(live, stateRes.data?.completed_steps ?? []),
    };
  });

/**
 * Dismissal persists on the account (account_checklist.dismissed_at, owner
 * scoped to context.userId). Insert-or-update: the row may not exist yet on
 * a fresh account.
 */
export const dismissSignupChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ dismissed: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin) as unknown as ChecklistDb;

    const { data: existing, error: loadError } = await db
      .from<{ account_id: string }>("account_checklist")
      .select("account_id")
      .eq("account_id", context.userId)
      .maybeSingle();
    if (loadError) throw new Error(loadError.message || "Failed to load checklist state");

    const dismissedAt = new Date().toISOString();
    const { error } = existing
      ? await db
          .from("account_checklist")
          .update({ dismissed_at: dismissedAt })
          .eq("account_id", context.userId)
      : await db.from("account_checklist").insert({
          account_id: context.userId,
          completed_steps: [],
          dismissed_at: dismissedAt,
        });
    if (error) throw new Error(error.message || "Failed to dismiss checklist");
    return { dismissed: true };
  });
