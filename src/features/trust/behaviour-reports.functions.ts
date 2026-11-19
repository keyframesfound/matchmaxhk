/**
 * #782 §2.5 (was #703): private pre-lesson behaviour reports and concierge
 * strikes. Ops only (staff / admin / super_admin); never surfaced on a public
 * card or parent profile, and never a substitute for the §2.4 Urgent Safety
 * quarantine. Thresholds / rematch consequences from the rebuilt #703 body
 * are [UNVERIFIED], so this ships the locked minimum: private, strike-tracked,
 * visible to ops.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db, type Row } from "@/features/cases/desk-db";

export const BEHAVIOUR_CATEGORIES = [
  "unresponsive",
  "hostile",
  "boundary",
  "safety_concern",
  "other",
] as const;
export type BehaviourCategory = (typeof BEHAVIOUR_CATEGORIES)[number];

async function staffDb(userId: string): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = asAdminDb(supabaseAdmin);
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return db;
  }
  throw new Error("FORBIDDEN");
}

/** The case's two parties as account ids (parent, tutor's user). */
async function caseParties(
  db: Db,
  caseId: string,
): Promise<{ parent: string | null; tutor: string | null }> {
  const rows = await selectRows<{
    parent_id: string | null;
    tutors: { user_id: string | null } | null;
  }>(db, "tutoring_cases", "parent_id, tutors(user_id)", [{ col: "id", op: "eq", value: caseId }]);
  if (!rows[0]) throw new Error("CASE_NOT_FOUND");
  return { parent: rows[0].parent_id, tutor: rows[0].tutors?.user_id ?? null };
}

export type BehaviourReportRow = {
  id: string;
  subject_role: "parent" | "tutor";
  category: BehaviourCategory;
  note: string;
  strike: boolean;
  created_at: string;
  voided_at: string | null;
};

/** Active (not voided) strikes on an account across all cases. */
export function countStrikes(
  rows: readonly { strike: boolean; voided_at: string | null }[],
): number {
  return rows.filter((r) => r.strike && !r.voided_at).length;
}

export const getCaseBehaviourReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId: z.string().uuid() }).parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      reports: BehaviourReportRow[];
      strikes: { parent: number; tutor: number };
    }> => {
      const db = await staffDb(context.userId);
      const parties = await caseParties(db, data.caseId);
      const reports = await selectRows<BehaviourReportRow>(
        db,
        "behaviour_reports",
        "id, subject_role, category, note, strike, created_at, voided_at",
        [{ col: "case_id", op: "eq", value: data.caseId }],
        { col: "created_at", asc: false },
      );
      const strikesFor = async (accountId: string | null) =>
        accountId
          ? countStrikes(
              await selectRows<{ strike: boolean; voided_at: string | null }>(
                db,
                "behaviour_reports",
                "strike, voided_at",
                [{ col: "subject_account_id", op: "eq", value: accountId }],
              ),
            )
          : 0;
      return {
        reports,
        strikes: {
          parent: await strikesFor(parties.parent),
          tutor: await strikesFor(parties.tutor),
        },
      };
    },
  );

export const fileBehaviourReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        subject: z.enum(["parent", "tutor"]),
        category: z.enum(BEHAVIOUR_CATEGORIES),
        note: z.string().trim().min(3).max(1000),
        strike: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await staffDb(context.userId);
    const parties = await caseParties(db, data.caseId);
    const { error } = await db.from<Row>("behaviour_reports").insert({
      case_id: data.caseId,
      subject_role: data.subject,
      subject_account_id: data.subject === "parent" ? parties.parent : parties.tutor,
      category: data.category,
      note: data.note,
      strike: data.strike,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const voidBehaviourReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ reportId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await staffDb(context.userId);
    const { error } = await db
      .from<Row>("behaviour_reports")
      .update({ voided_at: new Date().toISOString(), voided_by: context.userId })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
