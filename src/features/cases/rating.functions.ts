/**
 * #794 §2.1 — rating + private desk-report server fns.
 *
 * All three entry points (parent case page, tutor case hub, post-Mark-done
 * sheet) go through rating-core.server so the CEO-lock gates are single-
 * sourced. No public read path touches case_reviews directly: RLS is enabled
 * with service-role-only grants, and the anon-facing aggregate is the
 * SECURITY DEFINER get_tutor_review_summary RPC.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  getCaseRatingStateCore,
  reportCaseToDeskCore,
  saveCaseRatingCore,
  type CaseRatingState,
  type SaveCaseRatingResult,
} from "@/features/cases/rating-core.server";
import { DESK_REPORT_REASONS, RATING_DESK_NOTE_MAX } from "@/features/cases/rating-window";
import { requireAdmin } from "@/features/cases/desk-db";

const directionSchema = z.enum(["parent_to_tutor", "tutor_to_parent"]);

export const saveCaseRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        direction: directionSchema,
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(600).default(""),
        deskNote: z.string().max(RATING_DESK_NOTE_MAX).default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<SaveCaseRatingResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    return saveCaseRatingCore(db, context.userId, data);
  });

export const getCaseRatingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid(), direction: directionSchema }).parse(input),
  )
  .handler(async ({ context, data }): Promise<CaseRatingState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    return getCaseRatingStateCore(db, context.userId, data.caseId, data.direction);
  });

export const reportCaseToDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        reason: z.enum(DESK_REPORT_REASONS as unknown as [string, ...string[]]),
        detail: z.string().max(1000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    return reportCaseToDeskCore(db, context.userId, {
      caseId: data.caseId,
      reason: data.reason as (typeof DESK_REPORT_REASONS)[number],
      detail: data.detail,
    });
  });

// ---------------------------------------------------------------------------
// Desk queue for the private reports (#794 §2.1). Standalone table, admin-only.
// ---------------------------------------------------------------------------

export type CaseDeskReportRow = {
  id: string;
  case_id: string;
  author_account_id: string;
  author_side: "parent" | "tutor";
  reason: string;
  detail: string;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  created_at: string;
};

export const listCaseDeskReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseDeskReportRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const { data: rows, error } = await db
      .from<CaseDeskReportRow>("case_desk_reports")
      .select("id, case_id, author_account_id, author_side, reason, detail, status, created_at")
      .eq("case_id", data.caseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CaseDeskReportRow[];
  });

export const setDeskReportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        reportId: z.string().uuid(),
        status: z.enum(["open", "reviewing", "actioned", "dismissed"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const { error } = await db
      .from<Record<string, unknown>>("case_desk_reports")
      .update({ status: data.status })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
