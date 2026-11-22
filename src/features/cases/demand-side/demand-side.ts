// Issue #637: Demand-Side self-info. Party Case Hub only, never public. These
// fields live in their own table, so editing them cannot touch the agreed rate,
// lesson length, fee or assigned tutor.

import { sanitizeCaseUniText } from "@/features/cases/case-verticals";

export const PRIMARY_GOALS = [
  "exam_boost",
  "foundation",
  "homework",
  "top_grade",
  "coursework",
] as const;
export const LANGUAGE_MEDIUMS = ["cantonese_en_terms", "english", "putonghua"] as const;
export const FEEDBACK_STYLES = ["weekly", "monthly"] as const;
export const LEARNING_STYLES = ["past_papers", "concepts", "worked_examples"] as const;
/** #796: the one-blocker chip group (skip = null). */
export const BOTTLENECKS = [
  "weak_concepts",
  "careless_mistakes",
  "slow_exam_speed",
  "exam_technique",
] as const;
/** #796: how the family wants lessons run (skip = null). */
export const PREFERRED_STYLES = [
  "patient_step_by_step",
  "fast_paced",
  "past_paper_focused",
] as const;

export type Bottleneck = (typeof BOTTLENECKS)[number];
export type PreferredStyle = (typeof PREFERRED_STYLES)[number];

const NOTES_MAX = 1000;
const SHORT_TEXT_MAX = 40;
const TOPIC_MAX = 80;
const TOPICS_MAX = 12;
const TARGET_EXAM_MAX = 80;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIVE_LESSON_STATUSES = new Set(["planned", "confirmed"]);
const ENDED_SOR_STATUSES = new Set(["closed", "replaced"]);

export type DemandSide = {
  primaryGoal: string | null;
  languageMedium: string | null;
  householdNotes: string;
  feedbackStyle: string | null;
  currentLevel: string;
  targetGrade: string;
  weakTopics: string[];
  learningStyles: string[];
  /** #796 study plan: additive, every field skippable (null). */
  bottleneck: string | null;
  preferredStyle: string | null;
  targetExam: string;
  targetExamDate: string | null;
};

export type HouseholdDefaults = {
  savedAt: string;
  primaryGoal: string | null;
  languageMedium: string | null;
  householdNotes: string;
  feedbackStyle: string | null;
};

export function emptyDemandSide(): DemandSide {
  return {
    primaryGoal: null,
    languageMedium: null,
    householdNotes: "",
    feedbackStyle: null,
    currentLevel: "",
    targetGrade: "",
    weakTopics: [],
    learningStyles: [],
    bottleneck: null,
    preferredStyle: null,
    targetExam: "",
    targetExamDate: null,
  };
}

export type DemandSideAccess = "edit" | "read" | null;

export function demandSideAccess(input: {
  userId: string;
  isAdmin: boolean;
  parentId: string | null;
  studentOwnerId: string | null;
  tutorUserId: string | null;
}): DemandSideAccess {
  const { userId, isAdmin, parentId, studentOwnerId, tutorUserId } = input;
  if (isAdmin || userId === parentId || userId === studentOwnerId) return "edit";
  return userId === tutorUserId ? "read" : null;
}

function mediumFromCase(language: string | null): string | null {
  if (language === "en" || language === "english" || language === "english_only") return "english";
  if (language === "zh-HK" || language === "cantonese") return "cantonese_en_terms";
  return null;
}

/** First view of a case: this case's request first, then saved household defaults. */
export function seedDemandSide(
  c: {
    description: string | null;
    languageOfInstruction: string | null;
    gradeCurrent: string | null;
    createdAt: string;
  },
  defaults: HouseholdDefaults | null,
): DemandSide {
  const usable =
    defaults && Date.parse(c.createdAt) > Date.parse(defaults.savedAt) ? defaults : null;
  return sanitizeDemandSide({
    ...emptyDemandSide(),
    primaryGoal: usable?.primaryGoal ?? null,
    languageMedium: mediumFromCase(c.languageOfInstruction) ?? usable?.languageMedium ?? null,
    householdNotes: c.description?.trim() || usable?.householdNotes || "",
    feedbackStyle: usable?.feedbackStyle ?? null,
    currentLevel: c.gradeCurrent ?? "",
  });
}

function asListed<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** #796: an unlisted chip value degrades to "skip", never an invalid write. */
export function sanitizeBottleneck(raw: unknown): Bottleneck | null {
  return asListed(raw, BOTTLENECKS);
}

/** #796: an unlisted chip value degrades to "skip", never an invalid write. */
export function sanitizePreferredStyle(raw: unknown): PreferredStyle | null {
  return asListed(raw, PREFERRED_STYLES);
}

/** #796: free text, trimmed and capped at 80. */
export function sanitizeTargetExam(raw: unknown): string {
  return (sanitizeCaseUniText(raw, TARGET_EXAM_MAX) ?? "").trim();
}

/** #796: a real calendar day only (rejects junk and 2026-02-31 rollovers). */
export function sanitizeTargetExamDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!ISO_DATE_RE.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10) === value ? value : null;
}

export function sanitizeDemandSide(input: DemandSide): DemandSide {
  const topics = input.weakTopics
    .map((topic) => sanitizeCaseUniText(topic, TOPIC_MAX) ?? "")
    .map((topic) => topic.trim())
    .filter(Boolean);
  return {
    ...input,
    householdNotes: (sanitizeCaseUniText(input.householdNotes, NOTES_MAX) ?? "").trim(),
    currentLevel: (sanitizeCaseUniText(input.currentLevel, SHORT_TEXT_MAX) ?? "").trim(),
    targetGrade: (sanitizeCaseUniText(input.targetGrade, SHORT_TEXT_MAX) ?? "").trim(),
    weakTopics: [...new Set(topics)].slice(0, TOPICS_MAX),
    bottleneck: sanitizeBottleneck(input.bottleneck),
    preferredStyle: sanitizePreferredStyle(input.preferredStyle),
    targetExam: sanitizeTargetExam(input.targetExam),
    targetExamDate: sanitizeTargetExamDate(input.targetExamDate),
  };
}

export type HouseholdRowInput = {
  caseId: string;
  caseCode: string;
  sorStatus: string | null;
  studentName: string | null;
  subject: string;
  tutorName: string | null;
  primaryGoal: string | null;
  targetGrade: string | null;
  lessons: { startsAt: string; status: string }[];
};

export type HouseholdRow = Omit<HouseholdRowInput, "lessons" | "sorStatus"> & {
  nextLessonAt: string | null;
};

/** Household summary: running cases only, soonest next lesson first. */
export function buildHouseholdRows(cases: HouseholdRowInput[], now: Date): HouseholdRow[] {
  const nextLesson = (lessons: HouseholdRowInput["lessons"]) =>
    lessons
      .filter((l) => LIVE_LESSON_STATUSES.has(l.status) && Date.parse(l.startsAt) > now.getTime())
      .map((l) => l.startsAt)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
  const when = (row: HouseholdRow) =>
    row.nextLessonAt ? Date.parse(row.nextLessonAt) : Number.POSITIVE_INFINITY;
  return cases
    .filter((c) => c.sorStatus !== null && !ENDED_SOR_STATUSES.has(c.sorStatus))
    .map(({ lessons, sorStatus: _sorStatus, ...rest }) => ({
      ...rest,
      nextLessonAt: nextLesson(lessons),
    }))
    .sort((a, b) => when(a) - when(b));
}
