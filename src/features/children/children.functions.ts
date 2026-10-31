/**
 * Issue #459 slice 2 — parent-managed child sub-profiles (public.students).
 *
 * students is service-role only (RLS on, no client grants), so every read
 * and write here is scoped to context.userId. Parents archive instead of
 * delete: credit_accounts reference students ON DELETE RESTRICT.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { ChildInput, type ChildProfile } from "@/features/children/children";

type StudentRow = {
  id: string;
  display_name: string;
  school: string | null;
  curriculum: string | null;
  grad_year: number | null;
  status: "managed_by_parent" | "linked_independent" | "claimed_independent";
  archived_at: string | null;
  created_at: string;
  can_view_schedule: boolean;
  can_manage_billing: boolean;
};

const STUDENT_COLS =
  "id, display_name, school, curriculum, grad_year, status, archived_at, created_at, can_view_schedule, can_manage_billing";

function toChildProfile(row: StudentRow): ChildProfile {
  return {
    id: row.id,
    nickname: row.display_name,
    school: row.school,
    curriculum: row.curriculum,
    gradYear: row.grad_year,
    status: row.status,
    canViewSchedule: row.can_view_schedule !== false,
    canManageBilling: row.can_manage_billing !== false,
  };
}

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

async function requireOwnedChild(db: Db, userId: string, childId: string): Promise<StudentRow> {
  const rows = await selectRows<StudentRow>(db, "students", STUDENT_COLS, [
    { col: "id", op: "eq", value: childId },
    { col: "parent_user_id", op: "eq", value: userId },
  ]);
  const row = rows[0];
  if (!row || row.archived_at) throw new Error("CHILD_NOT_FOUND");
  return row;
}

export const listMyChildren = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChildProfile[]> => {
    const db = await adminDb();
    const rows = await selectRows<StudentRow>(
      db,
      "students",
      STUDENT_COLS,
      [{ col: "parent_user_id", op: "eq", value: context.userId }],
      { col: "created_at", asc: true },
    );
    return rows.filter((row) => !row.archived_at).map(toChildProfile);
  });

export const saveChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().nullish(), child: ChildInput }).parse(input),
  )
  .handler(async ({ context, data }): Promise<ChildProfile> => {
    const db = await adminDb();
    const fields = {
      display_name: data.child.nickname,
      school: data.child.school,
      curriculum: data.child.curriculum,
      grad_year: data.child.gradYear,
    };

    if (data.id) {
      const row = await requireOwnedChild(db, context.userId, data.id);
      const { error } = await db
        .from("students")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .eq("parent_user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ...toChildProfile(row), ...data.child };
    }

    const { data: row, error } = await db
      .from<StudentRow>("students")
      .insert({ ...fields, parent_user_id: context.userId })
      .select(STUDENT_COLS)
      .single();
    if (error) throw new Error(error.message);
    return toChildProfile(row);
  });

export const archiveChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    await requireOwnedChild(db, context.userId, data.id);
    const now = new Date().toISOString();
    const { error } = await db
      .from("students")
      .update({ archived_at: now, updated_at: now })
      .eq("id", data.id)
      .eq("parent_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * #459 §4.4 / §15.3: after a child claims their profile the parent chooses
 * whether to keep seeing the schedule and paying. Only claimed children —
 * a managed child is the parent's to run.
 */
export const setChildRetain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        canViewSchedule: z.boolean(),
        canManageBilling: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ChildProfile> => {
    const db = await adminDb();
    const row = await requireOwnedChild(db, context.userId, data.id);
    if (row.status !== "claimed_independent") throw new Error("CHILD_NOT_CLAIMED");
    const { error } = await db
      .from("students")
      .update({
        can_view_schedule: data.canViewSchedule,
        can_manage_billing: data.canManageBilling,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("parent_user_id", context.userId);
    if (error) throw new Error(error.message);
    return toChildProfile({
      ...row,
      can_view_schedule: data.canViewSchedule,
      can_manage_billing: data.canManageBilling,
    });
  });
