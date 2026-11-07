/**
 * Issue #652: Homework & Submission Tracker, pure half. Optional self-service
 * for the parties of one matched case; MatchMax does not set or supervise
 * coursework (Cap.57), and nothing here reaches a public surface.
 */

import { contactFilterError } from "@/lib/contact-filter";

export const HOMEWORK_TITLE_MAX = 120;
export const HOMEWORK_TEXT_MAX = 1000;
export const HOMEWORK_NOTE_MAX = 500;
export const HOMEWORK_REVIEW_MAX = 200;
export const HOMEWORK_LINK_MAX = 500;

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

export type HomeworkItem = {
  dueAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
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
  const submitted = items.filter((i) => i.submittedAt !== null);
  const late = submitted.filter(isLate).length;
  const overdue = items.filter((i) => homeworkStatus(i, now) === "overdue").length;
  const counted = submitted.length + overdue;
  return {
    total: items.length,
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
  return contactFilterError(text) ? "CONTACT_DETAILS" : null;
}
