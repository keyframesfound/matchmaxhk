export type CaseStatus =
  "new" | "contacted" | "compliance_hold" | "matched" | "closed" | "rejected";

export type CaseRow = {
  id: string;
  case_code: string;
  title: string;
  description: string | null;
  subjects: string[];
  exam_system: string | null;
  student_level: string;
  student_grade_current: string | null;
  student_school: string | null;
  district: string | null;
  mode: "online" | "in_person" | "either";
  sessions_per_week: number;
  session_length_minutes: number;
  schedule_note: string | null;
  start_timing: string | null;
  preferred_gender: "any" | "male" | "female";
  // Issue #437: case-level demographics (absent on pre-migration rows).
  who_for?: "my_child" | "myself" | "someone_else" | null;
  student_gender?: "female" | "male" | "prefer_not_to_say" | null;
  language_of_instruction: string;
  urgency: "low" | "normal" | "high";
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  budget_min_hkd: number | null;
  budget_max_hkd: number | null;
  contact_name: string;
  contact_phone: string;
  status: CaseStatus;
  matched_tutor_id: string | null;
  matched_at: string | null;
  fee_collected_at: string | null;
  fee_amount_cents: number | null;
  tags: string[];
  source: string;
  // Issue #190: vertical columns (absent on rows selected before the
  // migration, hence optional).
  academic_tier?: string | null;
  uni_field?: string | null;
  uni_name?: string | null;
  uni_program?: string | null;
  uni_course_codes?: string | null;
  kindergarten_focus?: string[] | null;
  last_contacted_at: string | null;
  board_published_at: string | null;
  // Issue #412: triage answers + hold note (absent on pre-migration rows).
  compliance_triage?: Record<string, unknown> | null;
  compliance_note?: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseNoteRow = {
  id: string;
  case_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
};

export const CASE_STATUSES: CaseStatus[] = [
  "new",
  "contacted",
  "compliance_hold",
  "matched",
  "closed",
  "rejected",
];

export const STATUS_LABEL: Record<CaseStatus, string> = {
  new: "New",
  contacted: "Contacted",
  compliance_hold: "Compliance hold",
  matched: "Matched",
  closed: "Closed",
  rejected: "Rejected",
};

export const STATUS_PILL_CLASS: Record<CaseStatus, string> = {
  new: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  contacted: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  compliance_hold: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  matched: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export const MODE_LABEL: Record<string, string> = {
  online: "Online",
  in_person: "In-person",
  either: "Hybrid",
};

export const START_LABEL: Record<string, string> = {
  asap: "Starts ASAP",
  two_weeks: "Within 2 weeks",
  flexible: "Flexible start",
};

export const GENDER_LABEL: Record<string, string> = {
  any: "No preference",
  female: "Female tutor",
  male: "Male tutor",
};

/** Issue #437: readable labels for the case-level demographics fields. */
export const WHO_FOR_LABEL: Record<string, string> = {
  my_child: "My child",
  myself: "Myself",
  someone_else: "Someone else",
};

export const STUDENT_GENDER_LABEL: Record<string, string> = {
  female: "Female",
  male: "Male",
  prefer_not_to_say: "Prefer not to say",
};

export function whatsappUrl(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export function formatBudget(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Not set";
  return `HK$${min ?? "?"}-${max ?? "?"}/hr`;
}

/**
 * Budget bounds as stored by the requester (native currency) vs the
 * HKD-normalized snapshots the DB trigger maintains (issue #112). Admin
 * surfaces show normalized values so mixed-currency cases stay comparable;
 * the fallback covers pre-migration rows where snapshots are still null.
 */
export function caseBudgetHkdBounds(
  row: Pick<CaseRow, "budget_min" | "budget_max" | "budget_min_hkd" | "budget_max_hkd">,
): { min: number | null; max: number | null } {
  return {
    min: row.budget_min_hkd ?? row.budget_min,
    max: row.budget_max_hkd ?? row.budget_max,
  };
}

/**
 * The explicit column list the desk's client list query selects (admin
 * cases route). The table grants authenticated a column-level SELECT
 * (admin-only fields — internal_note, whatsapp_group_url, hourly_rate_hkd —
 * are excluded DB-side), so select(*) would fail with permission denied.
 * Shared with findCasesByTutorCode (#55) so both surfaces stay in lockstep.
 */
export const ADMIN_CASE_SELECT_COLUMNS =
  "id, case_code, title, description, subjects, exam_system, student_level, student_grade_current, student_school, academic_tier, uni_field, uni_name, uni_program, uni_course_codes, kindergarten_focus, district, mode, sessions_per_week, session_length_minutes, schedule_note, start_timing, preferred_gender, who_for, student_gender, language_of_instruction, urgency, budget_min, budget_max, budget_currency, budget_min_hkd, budget_max_hkd, contact_name, contact_phone, status, matched_tutor_id, matched_at, fee_collected_at, fee_amount_cents, tags, source, last_contacted_at, board_published_at, compliance_triage, compliance_note, created_at, updated_at";
