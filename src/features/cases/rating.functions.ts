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
import { selectRows } from "@/features/cases/desk-db";
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

/**
 * #794 §2.1 — the desk's view of the two artefacts only it can act on: the
 * author's private note to the desk, and a review the contact filter or a
 * moderator put on hold. Both were write-only before this: `desk_note` was
 * stored and never read, and a `held`/`hidden` row had no staff screen.
 *
 * Admin-only. Never returns anything to a case party, and never makes a
 * tutor→parent rating public — hiding here only removes a row from the
 * public aggregate the same way a moderator would.
 */
export type DeskCaseReviewRow = {
  id: string;
  direction: "parent_to_tutor" | "tutor_to_parent";
  status: "visible" | "held" | "hidden";
  rating: number;
  comment: string;
  held_reason: string | null;
  desk_note: string | null;
  desk_note_at: string | null;
  author_display_line: string;
  updated_at: string | null;
};

export const listCaseReviewsForDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<DeskCaseReviewRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const rows = await selectRows<DeskCaseReviewRow>(
      db,
      "case_reviews",
      "id, direction, status, rating, comment, held_reason, desk_note, desk_note_at, author_display_line, updated_at",
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "updated_at", asc: false },
    );
    return rows;
  });

/** Hide (or restore) one review. Hiding keeps the row, the window and the note. */
export const setCaseReviewHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reviewId: z.string().uuid(), hidden: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const hiddenAt = data.hidden ? new Date().toISOString() : null;
    const { error } = await db
      .from<Record<string, unknown>>("case_reviews")
      .update({
        status: data.hidden ? "hidden" : "visible",
        hidden_by: data.hidden ? context.userId : null,
        hidden_at: hiddenAt,
      })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true };
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
