import {
  AlertCircle,
  Users,
  Bell,
  CalendarClock,
  CalendarX,
  CheckCheck,
  GraduationCap,
  Package,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * #671 notification coherence: the ONE view layer both bell surfaces share.
 *
 * The dropdown (components/layout/bell-menu.tsx) and the full inbox page
 * (routes/_authenticated.notifications.tsx) previously kept drifted copies of
 * the icon + label + group maps (the dropdown fell back to a generic label for
 * the #461/#654 schedule and billing events). This module is the single source
 * so every bus event renders, groups and deep-links the same way everywhere.
 * Pure on purpose — vitest covers it (tests/cases/bell-view.test.ts).
 */

/** Inbox families (AC: Cases · Schedule · Ratings · Account). */
export type BellGroup = "cases" | "schedule" | "ratings" | "account";

/**
 * #671: one pipeline, grouped views — every consumer (schedule changes,
 * request status, ratings, statements, demand-side, account actions) lands
 * in the SAME bell, so the inbox groups by family instead of by feature.
 * (Moved verbatim from the shipped /notifications mapping so the two
 * surfaces can never drift again.)
 */
export function bellGroup(eventType: string): BellGroup {
  // Order matters: lesson.review_prompt is a RATING prompt (#649) even though
  // it starts with "lesson." — the shipped page mapping had this check after
  // the lesson. prefix, so it was dead code and prompts landed in Schedule.
  if (eventType === "lesson.review_prompt" || eventType.startsWith("review.")) return "ratings";
  if (eventType.startsWith("lesson.") || eventType.startsWith("billing.")) return "schedule";
  if (eventType.startsWith("action.")) return "account";
  return "cases";
}

/** Structural subset of the bus BellItem the view layer needs. */
export type BellLabelInput = {
  event_type: string;
  role_hint?: "tutor" | "parent" | "concierge" | "unknown";
  payload?: Record<string, unknown>;
};

/** i18next-compatible translate fn (keeps this module pure and testable). */
export type BellTranslate = (key: string, vars?: Record<string, unknown>) => string;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/**
 * #671 copy samples (issue text, EN + 繁中). These render with the
 * interpolation fields when a producer supplies them; otherwise the event
 * falls back to its standing static label. New producers (#648 request
 * status, richer billing statements) only need to add payload fields.
 */
export function bellLabel(item: BellLabelInput, t: BellTranslate): string {
  const p = item.payload ?? {};
  switch (item.event_type) {
    // Schedule Updated (#636/#461): "Schedule updated on {CaseTitle}" /
    // 「{個案標題}」時間表已更新. Producers pass case_code; the sample
    // renders with it. Without it the actor-split static labels stand.
    case "lesson.scheduled_by_parent":
    case "lesson.scheduled_by_tutor": {
      const caseTitle =
        str(p.caseTitle) ?? str(p.case_title) ?? str(p.caseCode) ?? str(p.case_code);
      if (caseTitle) return t("sor.nf_sample_schedule_updated", { caseTitle });
      return t(
        item.event_type === "lesson.scheduled_by_parent"
          ? "sor.bell_lesson_scheduled_parent"
          : "sor.bell_lesson_scheduled_tutor",
      );
    }
    // Rating prompt (#649): "Rate your lesson with {Tutor}" / 為同 {Tutor}
    // 嘅課堂評分. The current producer carries tutor_id only, so the sample
    // renders once the producer adds the display name.
    case "lesson.review_prompt": {
      const tutor = str(p.tutorName) ?? str(p.tutor_name);
      if (tutor) return t("sor.nf_sample_rating_prompt", { tutor });
      return t("sor.bell_review_prompt");
    }
    // Statement paid (#654): "{Name} marked tuition paid for {Month}" /
    // {Name} 已將 {Month} 學費標記為已付. billing.notice producers own the
    // payload; the sample renders when they pass the payer + month.
    case "billing.notice_by_parent":
    case "billing.notice_by_tutor": {
      const name = str(p.payerName) ?? str(p.payer_name);
      const month = str(p.month) ?? str(p.statement_month);
      if (name && month) return t("sor.nf_sample_statement_paid", { name, month });
      return t("sor.bell_billing_notice");
    }
    // "{Tutor} accepted your request" / {Tutor} 已接受你的申請 — reserved
    // for the request-status producer (no event type exists yet); added so
    // the template ships with the pipeline, per the issue copy samples.
    default:
      return t(bellLabelKey(item));
  }
}

/** The static fallback key for an item (used by tests and plain rendering). */
export function bellLabelKey(item: BellLabelInput): string {
  switch (item.event_type) {
    case "note_order.draft_needed":
      return "sor.bell_draft_needed";
    case "note_order.delivered":
      return item.role_hint === "tutor" ? "sor.bell_note_sold" : "sor.bell_order_delivered";
    case "review.published":
      return "sor.bell_new_review";
    case "lesson.review_prompt":
      return "sor.bell_review_prompt";
    case "lesson.reminder_due":
      return "sor.bell_lesson_tomorrow";
    case "experience.session_logged":
      return "sor.bell_session_logged";
    case "case.end_requested_by_parent":
      return "sor.bell_case_end_by_parent";
    case "case.end_requested_by_tutor":
      return "sor.bell_case_end_by_tutor";
    case "admin_fee.invoiced":
      return "sor.bell_fee_due";
    case "admin_fee.unpaid":
      return "sor.bell_fee_unpaid";
    case "admin_fee.digest":
      return "sor.bell_unpaid_digest";
    // #461 addendum Triggers 8-9: actor-split event types, so the label
    // always describes the OTHER side's action.
    case "lesson.cancelled_by_parent":
      return "sor.bell_lesson_cancelled_parent";
    case "lesson.cancelled_by_tutor":
      return "sor.bell_lesson_cancelled_tutor";
    case "billing.notice_by_parent":
    case "billing.notice_by_tutor":
      return "sor.bell_billing_notice";
    case "lesson.scheduled_by_parent":
      return "sor.bell_lesson_scheduled_parent";
    case "lesson.scheduled_by_tutor":
      return "sor.bell_lesson_scheduled_tutor";
    // #542 V1 triggers + #561 action scenarios.
    case "case.lead_new":
      return "sor.bell_lead_new";
    case "case.match_alert":
      return "sor.bell_case_match";
    case "case.already_taken":
      return "sor.bell_case_taken";
    case "case.match_waves_exhausted":
      return "sor.bell_waves_exhausted";
    case "case.demand_side_updated":
      return "sor.bell_demand_side";
    case "intro.shared_parent":
      return "sor.bell_intro_parent";
    case "intro.shared_tutor":
      return "sor.bell_intro_tutor";
    case "verification.approved":
      return "sor.bell_verify_approved";
    case "verification.rejected":
      return "sor.bell_verify_rejected";
    case "material.rejected":
      return "sor.bell_material_rejected";
    case "content.rejected":
      return "sor.bell_content_rejected";
    case "report.filed":
      return "sor.bell_report_filed";
    case "action.profile_fields":
      return "sor.bell_profile_fields";
    case "action.onboarding":
      return "sor.bell_onboarding";
    case "action.admin_task":
      return "sor.bell_admin_task";
    default:
      return "sor.bell_update";
  }
}

export function bellIcon(eventType: string): LucideIcon {
  if (eventType === "note_order.delivered") return Package;
  // #617 Tutor Connect: requests and acceptances share the people icon.
  if (eventType === "connect.request" || eventType === "connect.accepted") return Users;
  if (eventType === "review.published" || eventType === "lesson.review_prompt") return Star;
  if (eventType.startsWith("lesson.cancelled")) return CalendarX;
  if (eventType.startsWith("lesson.scheduled") || eventType === "lesson.reminder_due")
    return CalendarClock;
  if (eventType === "experience.session_logged") return GraduationCap;
  if (eventType === "case.end_requested_by_parent" || eventType === "case.end_requested_by_tutor")
    return CheckCheck;
  if (eventType.startsWith("admin_fee")) return Wallet;
  // #561/#542 action-class items carry the attention icon.
  if (
    eventType.startsWith("action.") ||
    eventType.startsWith("verification.") ||
    eventType === "case.lead_new" ||
    eventType.startsWith("intro.shared") ||
    eventType === "material.rejected" ||
    eventType === "content.rejected" ||
    eventType === "report.filed"
  )
    return AlertCircle;
  return Bell;
}
