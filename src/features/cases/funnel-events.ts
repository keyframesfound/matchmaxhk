import type { asAdminDb } from "@/features/materials/storage-helpers";

/**
 * Issue #428 Phase 1: Outcome Event Ledger emitter. Best-effort, append-only:
 * a failed analytics insert must never fail the business action, mirroring
 * emitActionEvent. One funnel row per milestone; nothing here ranks or
 * decides anything (Phase 2 consumption is a later issue).
 */

type Db = ReturnType<typeof asAdminDb>;

export type FunnelEvent = {
  case_id: string;
  tutor_id?: string | null;
  client_id?: string | null;
  event_type:
    | "tutor_profile_viewed"
    | "tutor_requested"
    | "recommendation_used"
    | "tutor_pinged"
    | "tutor_replied_yes"
    | "tutor_replied_no"
    | "parent_approved_ok"
    | "intro_group_opened"
    | "lesson_1_confirmed"
    | "lesson_2_confirmed"
    | "fee_invoiced"
    | "fee_marked_paid"
    | "case_stopped_early"
    | "case_rematch_requested"
    | "verified_review_published"
    | "notes_or_shop_purchase"
    | "session_logged";
  request_source?: "parent_clicked_specific" | "staff_shortlist" | null;
  rank_position?: number | null;
  stop_reason?:
    | "schedule_mismatch"
    | "rate_mismatch"
    | "teaching_style"
    | "tutor_unresponsive"
    | "parent_ghosted"
    | "other"
    | null;
  session_focus?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logFunnelEvent(
  db: Db,
  event: FunnelEvent,
  createdBy?: string | null,
): Promise<void> {
  try {
    const { error } = await db.from<Record<string, unknown>>("case_funnel_events").insert({
      case_id: event.case_id,
      tutor_id: event.tutor_id ?? null,
      client_id: event.client_id ?? null,
      event_type: event.event_type,
      request_source: event.request_source ?? null,
      rank_position: event.rank_position ?? null,
      stop_reason: event.stop_reason ?? null,
      session_focus: event.session_focus ?? null,
      metadata: event.metadata ?? {},
      created_by: createdBy ?? null,
    });
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.warn(`[funnel] ${event.event_type} not recorded: ${error.message}`);
    }
  } catch (e) {
    console.warn(`[funnel] ${event.event_type} not recorded:`, e instanceof Error ? e.message : e);
  }
}
