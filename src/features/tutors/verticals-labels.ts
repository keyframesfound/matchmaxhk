import { useTranslation } from "react-i18next";

import i18n from "@/features/i18n/config";

import {
  KINDERGARTEN_TOPICS,
  TARGET_TEACHING_LEVELS,
  YEARS_OF_STUDY,
  type KindergartenTopic,
  type TargetTeachingLevel,
  type YearOfStudy,
} from "./verticals";

/**
 * Issue #190: display labels for the stored vertical vocabularies
 * (src/features/tutors/verticals.ts). The stored values are DATA, they
 * appear in tutors.target_students, tutors.subjects and
 * tutoring_cases.academic_tier / kindergarten_focus and never change;
 * labels localize through literal i18n keys (verticals.* in
 * src/features/i18n/locales/{en,zh-HK}.json). Unknown values pass through
 * unchanged, matching the sen-labels pattern.
 */

const LEVEL_LABEL_KEYS: Record<TargetTeachingLevel, string> = {
  Kindergarten: "verticals.level.kindergarten",
  Primary: "verticals.level.primary",
  Secondary: "verticals.level.secondary",
  University: "verticals.level.university",
};

const TOPIC_LABEL_KEYS: Record<KindergartenTopic, string> = {
  "Kindergarten Phonics": "verticals.topic.phonics",
  "Kindergarten English Reading": "verticals.topic.reading",
  "Kindergarten English Writing": "verticals.topic.writing",
  "Kindergarten Mandarin Immersion": "verticals.topic.mandarin",
  "Kindergarten Basic Mathematics": "verticals.topic.basic_maths",
  "P1 Interview, Communication & Etiquette": "verticals.topic.p1_etiquette",
  "P1 Interview, Group Play Observation": "verticals.topic.p1_group_play",
  "P1 Interview, Storytelling & Role-play": "verticals.topic.p1_storytelling",
  "P1 Interview, General Knowledge": "verticals.topic.p1_general",
};

const YEAR_LABEL_KEYS: Record<YearOfStudy, string> = {
  "Year 1": "verticals.year.y1",
  "Year 2": "verticals.year.y2",
  "Year 3": "verticals.year.y3",
  "Year 4": "verticals.year.y4",
  Postgraduate: "verticals.year.postgrad",
  "Alumni / Graduate": "verticals.year.alumni",
};

/** Module-level (non-hook) variants for pure render helpers. */
export function targetLevelLabel(level: string): string {
  const key = LEVEL_LABEL_KEYS[level as TargetTeachingLevel];
  return key ? i18n.t(key) : level;
}

export function kindergartenTopicLabel(topic: string): string {
  const key = TOPIC_LABEL_KEYS[topic as KindergartenTopic];
  return key ? i18n.t(key) : topic;
}

export function yearOfStudyLabel(year: string): string {
  const key = YEAR_LABEL_KEYS[year as YearOfStudy];
  return key ? i18n.t(key) : year;
}

export function academicTierLabel(tier: string): string {
  switch (tier) {
    case "kindergarten":
      return i18n.t("verticals.tier.kindergarten");
    case "university":
      return i18n.t("verticals.tier.university");
    case "primary_secondary":
      return i18n.t("verticals.tier.primary_secondary");
    default:
      return tier;
  }
}

/** Component-side label maps for form pickers. */
export function useVerticalLabels(): {
  levels: Record<TargetTeachingLevel, string>;
  topics: Record<KindergartenTopic, string>;
  years: Record<YearOfStudy, string>;
} {
  const { t } = useTranslation();
  return {
    levels: Object.fromEntries(
      TARGET_TEACHING_LEVELS.map((level) => [level, t(LEVEL_LABEL_KEYS[level])]),
    ) as Record<TargetTeachingLevel, string>,
    topics: Object.fromEntries(
      KINDERGARTEN_TOPICS.map((topic) => [topic, t(TOPIC_LABEL_KEYS[topic])]),
    ) as Record<KindergartenTopic, string>,
    years: Object.fromEntries(
      YEARS_OF_STUDY.map((year) => [year, t(YEAR_LABEL_KEYS[year])]),
    ) as Record<YearOfStudy, string>,
  };
}
