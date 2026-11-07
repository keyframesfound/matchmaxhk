// Issue #637: Demand-Side self-info. Party Case Hub only, never public. These
// fields live in their own table, so editing them cannot touch the agreed rate,
// lesson length, fee or assigned tutor.

import { sanitizeCaseUniText } from "@/features/cases/case-verticals";

export const PRIMARY_GOALS = ["exam_boost", "foundation", "homework"] as const;
export const LANGUAGE_MEDIUMS = ["cantonese_en_terms", "english", "putonghua"] as const;
export const FEEDBACK_STYLES = ["weekly", "monthly"] as const;
export const LEARNING_STYLES = ["past_papers", "concepts", "worked_examples"] as const;

const NOTES_MAX = 1000;
const SHORT_TEXT_MAX = 40;
const TOPIC_MAX = 80;
const TOPICS_MAX = 12;
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
