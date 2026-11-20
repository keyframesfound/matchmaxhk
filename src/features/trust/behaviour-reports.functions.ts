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
import {
  FREEZE_REVIEW_STRIKES,
  isStrikeCategory,
  type StrikeLadderState,
} from "@/features/trust/strike-ladder";

export const BEHAVIOUR_CATEGORIES = [
  "unresponsive",
  "no_show",
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
      ladder: { parent: StrikeLadderState; tutor: StrikeLadderState };
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
      const { ladderByAccount } = await import("@/features/trust/match-eligibility.server");
      const ids = [parties.parent, parties.tutor].filter((v): v is string => Boolean(v));
      const ladders = await ladderByAccount(db, ids);
      const none: StrikeLadderState = {
        strikes: 0,
        level: 0,
        matchPaused: false,
        pausedUntil: null,
        needsFreezeReview: false,
      };
      return {
        reports,
        strikes: {
          parent: parties.parent ? (ladders.get(parties.parent)?.strikes ?? 0) : 0,
          tutor: parties.tutor ? (ladders.get(parties.tutor)?.strikes ?? 0) : 0,
        },
        ladder: {
          parent: (parties.parent && ladders.get(parties.parent)) || none,
          tutor: (parties.tutor && ladders.get(parties.tutor)) || none,
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
    const subjectId = data.subject === "parent" ? parties.parent : parties.tutor;
    // AC-703-3: only no-reply / no-show / bad-behaviour reports count on the
    // ladder; non-urgent safety notes and "other" never become strikes.
    const strike = data.strike && isStrikeCategory(data.category);
    const { error } = await db.from<Row>("behaviour_reports").insert({
      case_id: data.caseId,
      subject_role: data.subject,
      subject_account_id: subjectId,
      category: data.category,
      note: data.note,
      strike,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);

    // Level 3: tell the Trust & Safety desk to decide on Freeze & Suspend.
    // The system never freezes or bans on its own.
    if (strike && subjectId) {
      const { ladderByAccount } = await import("@/features/trust/match-eligibility.server");
      const state = (await ladderByAccount(db, [subjectId])).get(subjectId);
      if (state && state.strikes === FREEZE_REVIEW_STRIKES) {
        try {
          const { notifyOps } = await import("@/lib/ops-webhook.server");
          void notifyOps("safety.strike_ladder_level_3", {
            case_id: data.caseId,
            subject_role: data.subject,
          }).catch(() => {});
        } catch {
          // advisory
        }
      }
      return { ok: true, ladder: state ?? null };
    }
    return { ok: true, ladder: null };
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

export type LadderReviewRow = {
  accountId: string;
  displayName: string | null;
  strikes: number;
  lastStrikeAt: string;
  suspended: boolean;
};

/** AC-703-3 level 3: accounts waiting for a staff Freeze & Suspend decision. */
export const listStrikeLadderReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LadderReviewRow[]> => {
    const db = await staffDb(context.userId);
    const rows = await selectRows<{
      subject_account_id: string | null;
      strike: boolean;
      voided_at: string | null;
      created_at: string;
    }>(db, "behaviour_reports", "subject_account_id, strike, voided_at, created_at", [
      { col: "strike", op: "eq", value: true },
    ]);
    const byAccount = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.subject_account_id || r.voided_at) continue;
      byAccount.set(r.subject_account_id, [
        ...(byAccount.get(r.subject_account_id) ?? []),
        r.created_at,
      ]);
    }
    const due = [...byAccount.entries()].filter(
      ([, times]) => times.length >= FREEZE_REVIEW_STRIKES,
    );
    if (due.length === 0) return [];
    const profiles = await selectRows<{
      id: string;
      display_name: string | null;
      account_status: string | null;
    }>(db, "profiles", "id, display_name, account_status", [
      { col: "id", op: "in", value: due.map(([id]) => id) },
    ]);
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return due
      .map(([accountId, times]) => ({
        accountId,
        displayName: byId.get(accountId)?.display_name ?? null,
        strikes: times.length,
        lastStrikeAt: [...times].sort().at(-1) ?? "",
        suspended: byId.get(accountId)?.account_status === "suspended",
      }))
      .sort((a, b) => b.lastStrikeAt.localeCompare(a.lastStrikeAt));
  });
