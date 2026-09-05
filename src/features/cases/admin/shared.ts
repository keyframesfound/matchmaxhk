export type CaseStatus = "new" | "contacted" | "matched" | "closed" | "rejected";

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
  language_of_instruction: string;
  urgency: "low" | "normal" | "high";
  budget_min: number | null;
  budget_max: number | null;
  contact_name: string;
  contact_phone: string;
  status: CaseStatus;
  tags: string[];
  source: string;
  last_contacted_at: string | null;
  board_published_at: string | null;
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

export const CASE_STATUSES: CaseStatus[] = ["new", "contacted", "matched", "closed", "rejected"];

export const STATUS_LABEL: Record<CaseStatus, string> = {
  new: "New",
  contacted: "Contacted",
  matched: "Matched",
  closed: "Closed",
  rejected: "Rejected",
};

export const STATUS_PILL_CLASS: Record<CaseStatus, string> = {
  new: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  contacted: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
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

export function whatsappUrl(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export function formatBudget(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Not set";
  return `HK$${min ?? "?"}-${max ?? "?"}/hr`;
}
