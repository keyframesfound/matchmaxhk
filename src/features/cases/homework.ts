/**
 * Issue #652: Homework & Submission Tracker, pure half. Optional self-service
 * for the parties of one matched case; MatchMax does not set or supervise
 * coursework (Cap.57), and nothing here reaches a public surface.
 */

import { hasContactDetails } from "@/lib/contact-filter";

export const HOMEWORK_TITLE_MAX = 120;
export const HOMEWORK_TEXT_MAX = 1000;
export const HOMEWORK_NOTE_MAX = 500;
export const HOMEWORK_REVIEW_MAX = 200;
export const HOMEWORK_LINK_MAX = 500;

/** Exam-paper wording the shared contact filter would read as a phone or a channel. */
const YEAR_PAIR = /\b(?:19|20)\d{2}[\s\-–]+(?:19|20)\d{2}\b/g;
const EXAM_BOARD_IG = /\b(?:edexcel|cie|caie|cambridge)\s+ig\b/gi;

const CONTACT_HOSTS = [
  "wa.me",
  "whatsapp.com",
  "t.me",
  "telegram.me",
  "instagram.com",
  "wechat.com",
  "weixin.qq.com",
  "facebook.com",
  "m.me",
];

export type HomeworkStatus =
  "assigned" | "submitted_on_time" | "submitted_late" | "overdue" | "reviewed";

// ---------------------------------------------------------------------------
// #785 AC-CONV-3 — material areas (Pre-Class / Homework / Post-Class Notes)
// ---------------------------------------------------------------------------

/** The four areas a case file belongs to. `general` is an unfiled upload. */
export type MaterialCategory = "general" | "pre_class" | "homework" | "post_class";

/** The tab's filter pills. `all` is the unfiltered view. */
export type MaterialFilter = "all" | "pre_class" | "homework" | "post_class";

/** Pill order, as the AC names them: All / Pre-Class / Homework / Post-Class Notes. */
export const MATERIAL_FILTERS: readonly MaterialFilter[] = [
  "all",
  "pre_class",
  "homework",
  "post_class",
];

/** `general` files are unfiled: they show under All and under no single area. */
export function matchesMaterialFilter(category: MaterialCategory, filter: MaterialFilter): boolean {
  return filter === "all" || category === filter;
}

/**
 * Only homework moves the completion rate. Pre-class and post-class uploads are
 * materials, not submissions, and neither is an unfiled `general` file.
 */
export function countsTowardCompletion(category: MaterialCategory = "homework"): boolean {
  return category === "homework";
}

/**
 * The tutor (and Ops) may file anywhere; a learner may only add pre-class and
 * post-class material. This is the same split as the assignment flow, where only
 * the tutor sets due-dated homework.
 */
export function canCreateMaterial(
  role: "ops" | "learner" | "tutor",
  category: MaterialCategory,
): boolean {
  if (role !== "learner") return true;
  return category === "pre_class" || category === "post_class";
}

export type HomeworkItem = {
  dueAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  /**
   * #785 AC-CONV-3: the material area. Absent means homework, so every existing
   * caller keeps counting; a pre-class or post-class item never moves the rate.
   */
  category?: MaterialCategory;
};

export type HomeworkSummary = {
  total: number;
  submitted: number;
  onTime: number;
  late: number;
  overdue: number;
  /** Whole percent of submitted against submitted + overdue; null when neither exists. */
  completionRate: number | null;
};

function isLate(item: HomeworkItem): boolean {
  return item.submittedAt !== null && Date.parse(item.submittedAt) > Date.parse(item.dueAt);
}

export function homeworkStatus(item: HomeworkItem, now: Date): HomeworkStatus {
  if (item.reviewedAt) return "reviewed";
  if (item.submittedAt) return isLate(item) ? "submitted_late" : "submitted_on_time";
  return now.getTime() > Date.parse(item.dueAt) ? "overdue" : "assigned";
}

export function summarizeHomework(items: readonly HomeworkItem[], now: Date): HomeworkSummary {
  // #785 AC-CONV-3: pre/post materials are not submissions, so they are dropped
  // before anything is counted. A pre-class file with a past date must never
  // turn into an overdue homework.
  const graded = items.filter((i) => countsTowardCompletion(i.category ?? "homework"));
  const submitted = graded.filter((i) => i.submittedAt !== null);
  const late = submitted.filter(isLate).length;
  const overdue = graded.filter((i) => homeworkStatus(i, now) === "overdue").length;
  const counted = submitted.length + overdue;
  return {
    total: graded.length,
    submitted: submitted.length,
    onTime: submitted.length - late,
    late,
    overdue,
    completionRate: counted === 0 ? null : Math.round((submitted.length / counted) * 100),
  };
}

/** Active work by due time, then reviewed work, newest first. */
export function splitHomework<T extends HomeworkItem>(
  items: readonly T[],
  now: Date,
): { active: T[]; completed: T[] } {
  const byDue = [...items].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  return {
    active: byDue.filter((i) => homeworkStatus(i, now) !== "reviewed"),
    completed: byDue.filter((i) => homeworkStatus(i, now) === "reviewed").reverse(),
  };
}

/** https only, and not a direct-contact link that would sidestep the desk. */
export function isAllowedHomeworkLink(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return !CONTACT_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

export function homeworkTextError(text: string | null | undefined): "CONTACT_DETAILS" | null {
  if (!text) return null;
  const cleaned = text.replace(YEAR_PAIR, " ").replace(EXAM_BOARD_IG, " ");
  return hasContactDetails(cleaned) ? "CONTACT_DETAILS" : null;
}
