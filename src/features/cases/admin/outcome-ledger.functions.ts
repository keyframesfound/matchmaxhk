/**
 * Issue #816 §2.7 / #428 Phase 1 — the outcome ledger, read back.
 *
 * `case_funnel_events` has been written since #428 Phase 1 and **never read**:
 * the table's own comment defers Phase 2 to the #454 cockpit, and the cockpit
 * shipped without it. A write-only ledger answers nothing, so this is the
 * cheapest honest Phase 2: one case, its events, in order, with the two fields
 * that carry meaning — where a tutor ranked on the shortlist, and why a case
 * stopped.
 *
 * Admin-only. The rows are already staff-gated at the table (service role has
 * INSERT/SELECT only, nothing for browser roles), and nothing here is rankable
 * or public.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { requireDeskStaff, selectRows, type Db } from "@/features/cases/desk-db";

const MAX_EVENTS = 100;

export type OutcomeLedgerRow = {
  id: string;
  eventType: string;
  tutorName: string | null;
  tutorCode: string | null;
  requestSource: string | null;
  rankPosition: number | null;
  stopReason: string | null;
  sessionFocus: string | null;
  createdAt: string;
};

/** Readable labels for the 17 event types the table's CHECK allows. */
export const OUTCOME_EVENT_LABELS: Record<string, string> = {
  tutor_profile_viewed: "Tutor profile viewed",
  tutor_requested: "Tutor requested",
  recommendation_used: "Recommendation used",
  tutor_pinged: "Tutor pinged",
  tutor_replied_yes: "Tutor said yes",
  tutor_replied_no: "Tutor said no",
  parent_approved_ok: "Parent approved",
  intro_group_opened: "Intro group opened",
  lesson_1_confirmed: "Lesson 1 confirmed",
  lesson_2_confirmed: "Lesson 2 confirmed",
  fee_invoiced: "Fee invoiced",
  fee_marked_paid: "Fee marked paid",
  case_stopped_early: "Case stopped early",
  case_rematch_requested: "Rematch requested",
  verified_review_published: "Review published",
  notes_or_shop_purchase: "Notes or shop purchase",
  session_logged: "Session logged",
};

export function outcomeEventLabel(eventType: string): string {
  return OUTCOME_EVENT_LABELS[eventType] ?? eventType;
}

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

export const getCaseOutcomeLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<OutcomeLedgerRow[]> => {
    const db = await adminDb();
    await requireDeskStaff(db, context.userId);

    const rows = await selectRows<{
      id: string;
      event_type: string;
      tutor_id: string | null;
      request_source: string | null;
      rank_position: number | null;
      stop_reason: string | null;
      session_focus: string | null;
      created_at: string;
    }>(
      db,
      "case_funnel_events",
      "id, event_type, tutor_id, request_source, rank_position, stop_reason, session_focus, created_at",
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "created_at", asc: false, limit: MAX_EVENTS },
    );

    const tutorIds = [...new Set(rows.map((r) => r.tutor_id).filter(Boolean))] as string[];
    const tutors = tutorIds.length
      ? await selectRows<{ id: string; display_name: string | null; tutor_code: string | null }>(
          db,
          "tutors",
          "id, display_name, tutor_code",
          [{ col: "id", op: "in", value: tutorIds }],
        )
      : [];
    const byId = new Map(tutors.map((t) => [t.id, t] as const));

    return rows.map((r) => {
      const tutor = r.tutor_id ? byId.get(r.tutor_id) : undefined;
      return {
        id: r.id,
        eventType: r.event_type,
        tutorName: tutor?.display_name ?? null,
        tutorCode: tutor?.tutor_code ?? null,
        requestSource: r.request_source,
        rankPosition: r.rank_position,
        stopReason: r.stop_reason,
        sessionFocus: r.session_focus,
        createdAt: r.created_at,
      };
    });
  });
