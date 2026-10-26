/**
 * SoR batch (#201/#204/#205/#287/#292), structural DB types.
 *
 * The new SoR tables are intentionally NOT in the generated Database types
 * (types.ts surgery is error-prone; see the stale-tables lesson). Server fns
 * use the service-role client cast through `AdminDb` (storage-helpers.ts
 * pattern) with these row types.
 */

import type { AdminDb, DbError, Rows } from "@/features/materials/storage-helpers";

export type AdminClient = AdminDb;

export type OrganisationKind = "individual" | "centre";

export type OrganisationRow = {
  id: string;
  name: string;
  slug: string;
  kind: OrganisationKind;
  status: string;
  created_by: string | null;
  created_at: string;
};

export type OrganisationMemberRow = {
  id: string;
  organisation_id: string;
  account_id: string;
  role: "owner" | "tutor";
  created_at: string;
};

export type SorStatus =
  | "draft"
  | "introduced"
  | "lesson_1_scheduled"
  | "lesson_1_done"
  | "lesson_2_scheduled"
  | "lesson_2_done"
  | "fee_invoiced"
  | "fee_paid"
  | "active"
  | "replaced"
  | "closed"
  | "waived";

/** tutoring_cases with the SoR columns included (board fields abbreviated). */
export type SorCaseRow = {
  id: string;
  case_code: string;
  parent_id: string | null;
  title: string;
  exam_system: string | null;
  subjects: string[] | null;
  student_level: string | null;
  student_grade_current: string | null;
  student_school: string | null;
  district: string | null;
  mode: "online" | "in_person" | "either" | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: string; // board status (case_request_status), different axis from sor_status
  source: string | null;
  matched_tutor_id: string | null;
  organisation_id: string | null;
  concierge_id: string | null;
  hourly_rate_hkd: number | null;
  /** #391: per-case seat count (NOT NULL, default 1), scales the admin fee. */
  student_count: number;
  whatsapp_group_url: string | null;
  replacement_of_case_id: string | null;
  internal_note: string | null;
  /** #443: desk-set short-case flag; the fee-math source of truth while true. */
  is_short_case: boolean;
  sor_status: SorStatus | null;
  sor_status_at: string | null;
  created_at: string;
};

export type LessonStatus =
  "planned" | "confirmed" | "done" | "no_show" | "cancelled" | "late_cancel";

export type CaseLessonRow = {
  id: string;
  case_id: string;
  sequence: number;
  tutor_id: string | null;
  starts_at: string;
  duration_min: number;
  location_or_link: string | null;
  status: LessonStatus;
  confirmed_by_parent_at: string | null;
  confirmed_by_tutor_at: string | null;
  marked_done_by: string | null;
  done_at: string | null;
  private_note: string | null;
  buffer_exempt: boolean;
  created_by: string | null;
  created_at: string;
};

export type FeeStatus = "not_due" | "invoiced" | "paid" | "waived" | "refunded";

export type CaseFeeRow = {
  id: string;
  case_id: string;
  rate_hkd: number;
  multiplier: number;
  amount_hkd: number;
  status: FeeStatus;
  fps_reference: string | null;
  due_at: string | null;
  paid_at: string | null;
  marked_paid_by: string | null;
  waive_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseAuditRow = {
  id: string;
  case_id: string;
  actor_id: string | null;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
};

export type CaseEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  source_table: string | null;
  source_id: string | null;
  status: "pending" | "processed" | "failed";
  process_attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
};

export type EventDeliveryRow = {
  id: string;
  event_id: string;
  channel: "in_app" | "email";
  recipient_account_id: string;
  status: "pending" | "sent" | "skipped" | "failed";
  attempts: number;
  sent_at: string | null;
  read_at: string | null;
  error: string | null;
  created_at: string;
};

export type CaseReviewRow = {
  id: string;
  case_id: string;
  lesson_id: string | null;
  direction: "parent_to_tutor" | "tutor_to_parent";
  author_account_id: string;
  tutor_id: string;
  rating: number;
  comment: string;
  author_display_line: string;
  status: "visible" | "held" | "hidden" | "replaced";
  held_reason: string | null;
  hidden_by: string | null;
  hidden_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WeeklyWindowRow = {
  id: string;
  tutor_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  station: string | null;
  created_at: string;
};

export type BlackoutRow = {
  id: string;
  tutor_id: string;
  blackout_date: string;
  reason: string | null;
  created_at: string;
};

export type TutorReviewSummary = {
  average: number | null;
  count: number;
  latest: {
    rating: number;
    comment: string;
    display_line: string;
    created_at: string;
  }[];
};

export type { DbError, Rows };
